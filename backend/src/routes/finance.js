import { Router } from 'express';
import { body, param, query as qv, validationResult } from 'express-validator';
import { pool, query } from '../db/pool.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';
import { canAccessAllProperties } from '../constants/roles.js';
import { nextDsNumber } from '../services/dsNumber.js';
import { splitCgstSgst } from '../services/financial.js';

const router = Router();
router.use(requireAuth);

function assertPropertyAccess(user, propertyId) {
  const pid = Number(propertyId);
  if (canAccessAllProperties(user.role)) return true;
  return user.propertyIds?.includes(pid);
}

router.get(
  '/invoices',
  qv('property_id').optional().isInt(),
  async (req, res) => {
    const propertyId = req.query.property_id ? Number(req.query.property_id) : null;
    if (propertyId && !assertPropertyAccess(req.user, propertyId)) {
      return res.status(403).json({ error: 'Property access denied' });
    }
    let sql = `SELECT i.*, p.code AS property_code FROM invoices i JOIN properties p ON p.id = i.property_id WHERE 1=1`;
    const params = [];
    if (propertyId) {
      params.push(propertyId);
      sql += ` AND i.property_id = $${params.length}`;
    } else if (!canAccessAllProperties(req.user.role)) {
      if (!req.user.propertyIds?.length) return res.json({ invoices: [] });
      params.push(req.user.propertyIds);
      sql += ` AND i.property_id = ANY($${params.length}::int[])`;
    }
    sql += ` ORDER BY i.created_at DESC LIMIT 200`;
    const { rows } = await query(sql, params);
    res.json({ invoices: rows });
  }
);

router.post(
  '/invoices',
  requireRoles('super_admin', 'finance', 'branch_manager', 'front_desk'),
  body('property_id').isInt(),
  body('booking_id').optional().isInt(),
  body('banquet_booking_id').optional().isInt(),
  body('sub_total').isFloat(),
  body('gst_percent').isFloat(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const propertyId = Number(req.body.property_id);
    if (!assertPropertyAccess(req.user, propertyId)) {
      return res.status(403).json({ error: 'Property access denied' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const p = await client.query(`SELECT code FROM properties WHERE id = $1`, [propertyId]);
      if (!p.rows[0]) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Invalid property' });
      }
      const ds = await nextDsNumber(client, propertyId, p.rows[0].code);

      const sub = Number(req.body.sub_total);
      const gstPct = Number(req.body.gst_percent);
      const gstTotal = Math.round(((sub * gstPct) / 100) * 100) / 100;
      const total = Math.round((sub + gstTotal) * 100) / 100;
      const { cgstPct, sgstPct } = splitCgstSgst(gstPct);
      const cgst = Math.round(((sub * cgstPct) / 100) * 100) / 100;
      const sgst = Math.round(((sub * sgstPct) / 100) * 100) / 100;
      const advanceApplied = Number(req.body.advance_applied ?? 0);
      const balanceDue = Math.max(0, total - advanceApplied);

      const ins = await client.query(
        `INSERT INTO invoices (
          property_id, booking_id, banquet_booking_id, ds_number,
          invoice_date, transaction_date, guest_snapshot, line_items,
          sub_total, cgst, sgst, gst_total, total_amount, advance_applied, balance_due, status
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
        RETURNING *`,
        [
          propertyId,
          req.body.booking_id ?? null,
          req.body.banquet_booking_id ?? null,
          ds,
          req.body.invoice_date ?? null,
          req.body.transaction_date ?? null,
          JSON.stringify(req.body.guest_snapshot ?? {}),
          JSON.stringify(req.body.line_items ?? []),
          sub,
          cgst,
          sgst,
          cgst + sgst,
          total,
          advanceApplied,
          balanceDue,
          balanceDue === 0 ? 'paid' : advanceApplied > 0 ? 'partial' : 'outstanding',
        ]
      );

      await client.query('COMMIT');
      res.status(201).json({ invoice: ins.rows[0] });
    } catch (e) {
      await client.query('ROLLBACK');
      console.error(e);
      res.status(500).json({ error: e.message });
    } finally {
      client.release();
    }
  }
);

router.post(
  '/payments',
  requireRoles('super_admin', 'finance', 'front_desk', 'branch_manager'),
  body('amount').isFloat(),
  body('mode').isIn(['cash', 'card', 'upi', 'btc', 'bank_transfer']),
  body('payment_type').isIn(['advance', 'balance', 'full_prepay', 'refund']),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const { booking_id, banquet_booking_id, amount, mode, payment_type, reference } = req.body;
    const { rows } = await query(
      `INSERT INTO payments (booking_id, banquet_booking_id, amount, mode, payment_type, reference, recorded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [booking_id ?? null, banquet_booking_id ?? null, amount, mode, payment_type, reference ?? null, req.user.id]
    );

    if (booking_id) {
      await query(
        `UPDATE bookings
         SET advance_received = advance_received + $2,
             balance_due = GREATEST(0, total_amount - (advance_received + $2)),
             status = CASE
               WHEN status IN ('INQ','QTN-HOLD') THEN 'TENT'
               ELSE status
             END,
             updated_at = NOW()
         WHERE id = $1`,
        [booking_id, amount]
      );
    }

    res.status(201).json({ payment: rows[0] });
  }
);

router.get(
  '/payments',
  qv('booking_id').optional().isInt(),
  async (req, res) => {
    const params = [];
    let sql = `SELECT * FROM payments WHERE 1=1`;
    if (req.query.booking_id) {
      params.push(Number(req.query.booking_id));
      sql += ` AND booking_id = $${params.length}`;
    }
    sql += ` ORDER BY created_at DESC LIMIT 300`;
    const { rows } = await query(sql, params);
    res.json({ payments: rows });
  }
);

router.get(
  '/cancellations',
  qv('property_id').optional().isInt(),
  async (req, res) => {
    const propertyId = req.query.property_id ? Number(req.query.property_id) : null;
    let sql = `
      SELECT c.*, b.property_id
      FROM cancellations c
      JOIN bookings b ON b.id = c.booking_id
      WHERE 1=1`;
    const params = [];
    if (propertyId) {
      if (!assertPropertyAccess(req.user, propertyId)) {
        return res.status(403).json({ error: 'Property access denied' });
      }
      params.push(propertyId);
      sql += ` AND b.property_id = $${params.length}`;
    } else if (!canAccessAllProperties(req.user.role)) {
      if (!req.user.propertyIds?.length) return res.json({ cancellations: [] });
      params.push(req.user.propertyIds);
      sql += ` AND b.property_id = ANY($${params.length}::int[])`;
    }
    sql += ` ORDER BY c.cancelled_at DESC LIMIT 200`;
    const { rows } = await query(sql, params);
    res.json({ cancellations: rows });
  }
);

router.post(
  '/cancellations',
  requireRoles('super_admin', 'finance', 'branch_manager'),
  body('booking_id').isInt(),
  async (req, res) => {
    const { booking_id, amount_forfeited, refund_due, notes } = req.body;
    await query(`UPDATE bookings SET status = 'CXL', updated_at = NOW() WHERE id = $1`, [booking_id]);
    const { rows } = await query(
      `INSERT INTO cancellations (booking_id, amount_forfeited, refund_due, notes)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [booking_id, amount_forfeited ?? 0, refund_due ?? 0, notes ?? null]
    );
    res.status(201).json({ cancellation: rows[0] });
  }
);

router.patch(
  '/cancellations/:id/approve',
  requireRoles('super_admin', 'finance'),
  param('id').isInt(),
  async (req, res) => {
    const id = Number(req.params.id);
    const { rows } = await query(
      `UPDATE cancellations SET finance_approved = TRUE WHERE id = $1 RETURNING *`,
      [id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json({ cancellation: rows[0] });
  }
);

export default router;

