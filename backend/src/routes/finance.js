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

function round2(n) {
  return Math.round(Number(n || 0) * 100) / 100;
}

function normalizeInvoiceStatus(balanceDue, requestedStatus = null) {
  if (requestedStatus) return requestedStatus;
  if (balanceDue <= 0) return 'paid';
  return 'outstanding';
}

async function loadBanquetBookingSummary(banquetBookingId) {
  const { rows } = await query(
    `SELECT bb.*, v.name AS venue_name
     FROM banquet_bookings bb
     JOIN venues v ON v.id = bb.venue_id
     WHERE bb.id = $1`,
    [banquetBookingId]
  );
  const booking = rows[0];
  if (!booking) return null;

  const pricing = booking.pricing ?? {};
  const gstSplit = booking.gst_split ?? {};
  const billingPax = Math.max(Number(booking.guaranteed_pax ?? 0), Number(booking.actual_pax ?? 0), 0);
  const perPlateRate = Number(pricing.per_plate_rate ?? 0);
  const hallCharges = Number(pricing.hall_charges ?? 0);
  const venueCharges = Number(pricing.venue_charges ?? 0);
  const subTotal = round2(perPlateRate * billingPax + hallCharges + venueCharges);
  const gstPercent = Number(gstSplit.gst_pct ?? 0);

  return {
    booking,
    summary: {
      sub_total: subTotal,
      gst_percent: gstPercent,
      guest_snapshot: {
        banquet_booking_id: booking.id,
        venue_name: booking.venue_name,
        event_category: booking.event_category,
        event_sub_type: booking.event_sub_type,
        with_room: booking.with_room,
        billing_pax: billingPax,
      },
      line_items: [
        { label: 'Per Plate', quantity: billingPax, rate: perPlateRate, amount: round2(perPlateRate * billingPax) },
        { label: 'Hall Charges', quantity: 1, rate: hallCharges, amount: hallCharges },
        { label: 'Venue Charges', quantity: 1, rate: venueCharges, amount: venueCharges },
      ].filter((line) => Number(line.amount) > 0),
    },
  };
}

router.get(
  '/invoices',
  qv('property_id').optional().isInt(),
  async (req, res) => {
    const propertyId = req.query.property_id ? Number(req.query.property_id) : null;
    if (propertyId && !assertPropertyAccess(req.user, propertyId)) {
      return res.status(403).json({ error: 'Property access denied' });
    }
    let sql = `
      SELECT i.*,
             p.code AS property_code,
             bb.event_category AS banquet_event_category,
             bb.event_sub_type AS banquet_event_sub_type,
             v.name AS banquet_venue_name
      FROM invoices i
      JOIN properties p ON p.id = i.property_id
      LEFT JOIN banquet_bookings bb ON bb.id = i.banquet_booking_id
      LEFT JOIN venues v ON v.id = bb.venue_id
      WHERE 1 = 1`;
    const params = [];
    if (propertyId) {
      params.push(propertyId);
      sql += ` AND i.property_id = $${params.length}`;
    } else if (!canAccessAllProperties(req.user.role)) {
      if (!req.user.propertyIds?.length) return res.json({ invoices: [] });
      params.push(req.user.propertyIds);
      sql += ` AND i.property_id = ANY($${params.length}::int[])`;
    }
    sql += ` ORDER BY i.created_at DESC LIMIT 300`;
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
  body('sub_total').optional().isFloat(),
  body('gst_percent').optional().isFloat(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const propertyId = Number(req.body.property_id);
    if (!assertPropertyAccess(req.user, propertyId)) {
      return res.status(403).json({ error: 'Property access denied' });
    }

    let invoiceInput = {
      booking_id: req.body.booking_id ?? null,
      banquet_booking_id: req.body.banquet_booking_id ?? null,
      sub_total: req.body.sub_total != null ? Number(req.body.sub_total) : null,
      gst_percent: req.body.gst_percent != null ? Number(req.body.gst_percent) : null,
      guest_snapshot: req.body.guest_snapshot ?? {},
      line_items: req.body.line_items ?? [],
    };

    if (invoiceInput.banquet_booking_id && (invoiceInput.sub_total == null || invoiceInput.gst_percent == null)) {
      const banquetSummary = await loadBanquetBookingSummary(invoiceInput.banquet_booking_id);
      if (!banquetSummary) {
        return res.status(400).json({ error: 'Invalid banquet booking' });
      }
      if (Number(banquetSummary.booking.property_id) !== propertyId) {
        return res.status(400).json({ error: 'Banquet booking does not belong to selected property' });
      }
      invoiceInput = {
        ...invoiceInput,
        sub_total: banquetSummary.summary.sub_total,
        gst_percent: banquetSummary.summary.gst_percent,
        guest_snapshot: banquetSummary.summary.guest_snapshot,
        line_items: banquetSummary.summary.line_items,
        booking_id: banquetSummary.booking.linked_booking_id ?? invoiceInput.booking_id,
      };
    }

    if (invoiceInput.sub_total == null || invoiceInput.gst_percent == null) {
      return res.status(400).json({ error: 'sub_total and gst_percent are required' });
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

      const sub = round2(invoiceInput.sub_total);
      const gstPct = Number(invoiceInput.gst_percent);
      const gstTotal = round2((sub * gstPct) / 100);
      const total = round2(sub + gstTotal);
      const { cgstPct, sgstPct } = splitCgstSgst(gstPct);
      const cgst = round2((sub * cgstPct) / 100);
      const sgst = round2((sub * sgstPct) / 100);
      const advanceApplied = round2(req.body.advance_applied ?? 0);
      const balanceDue = round2(Math.max(0, total - advanceApplied));

      const ins = await client.query(
        `INSERT INTO invoices (
          property_id, booking_id, banquet_booking_id, ds_number,
          invoice_date, transaction_date, guest_snapshot, line_items,
          sub_total, cgst, sgst, gst_total, total_amount, advance_applied, balance_due, status
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
        RETURNING *`,
        [
          propertyId,
          invoiceInput.booking_id,
          invoiceInput.banquet_booking_id,
          ds,
          req.body.invoice_date ?? null,
          req.body.transaction_date ?? null,
          JSON.stringify(invoiceInput.guest_snapshot ?? {}),
          JSON.stringify(invoiceInput.line_items ?? []),
          sub,
          cgst,
          sgst,
          round2(cgst + sgst),
          total,
          advanceApplied,
          balanceDue,
          normalizeInvoiceStatus(balanceDue),
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
  body('invoice_id').optional().isInt(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { invoice_id, amount, mode, payment_type, reference } = req.body;
    let bookingId = req.body.booking_id ?? null;
    let banquetBookingId = req.body.banquet_booking_id ?? null;
    let propertyId = req.body.property_id ? Number(req.body.property_id) : null;

    if (invoice_id) {
      const invoiceResult = await query(`SELECT * FROM invoices WHERE id = $1`, [Number(invoice_id)]);
      const invoice = invoiceResult.rows[0];
      if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
      if (!assertPropertyAccess(req.user, invoice.property_id)) {
        return res.status(403).json({ error: 'Property access denied' });
      }
      bookingId = bookingId ?? invoice.booking_id;
      banquetBookingId = banquetBookingId ?? invoice.banquet_booking_id;
      propertyId = invoice.property_id;

      const nextAdvance = round2(Number(invoice.advance_applied ?? 0) + Number(amount));
      const nextBalance = round2(Math.max(0, Number(invoice.total_amount ?? 0) - nextAdvance));
      const nextStatus = nextBalance <= 0 ? 'paid' : 'partial';
      await query(
        `UPDATE invoices
         SET advance_applied = $2, balance_due = $3, status = $4
         WHERE id = $1`,
        [Number(invoice_id), nextAdvance, nextBalance, nextStatus]
      );
    }

    if (propertyId && !assertPropertyAccess(req.user, propertyId)) {
      return res.status(403).json({ error: 'Property access denied' });
    }

    const { rows } = await query(
      `INSERT INTO payments (booking_id, banquet_booking_id, amount, mode, payment_type, reference, recorded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [bookingId, banquetBookingId, amount, mode, payment_type, reference ?? null, req.user.id]
    );

    if (bookingId) {
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
        [bookingId, amount]
      );
    }

    res.status(201).json({ payment: rows[0] });
  }
);

router.get(
  '/payments',
  qv('property_id').optional().isInt(),
  qv('booking_id').optional().isInt(),
  async (req, res) => {
    const params = [];
    let sql = `
      SELECT pay.*,
             bb.property_id AS banquet_property_id,
             b.property_id AS booking_property_id
      FROM payments pay
      LEFT JOIN banquet_bookings bb ON bb.id = pay.banquet_booking_id
      LEFT JOIN bookings b ON b.id = pay.booking_id
      WHERE 1=1`;

    if (req.query.booking_id) {
      params.push(Number(req.query.booking_id));
      sql += ` AND pay.booking_id = $${params.length}`;
    }
    if (req.query.property_id) {
      const propertyId = Number(req.query.property_id);
      if (!assertPropertyAccess(req.user, propertyId)) {
        return res.status(403).json({ error: 'Property access denied' });
      }
      params.push(propertyId);
      sql += ` AND (bb.property_id = $${params.length} OR b.property_id = $${params.length})`;
    }
    sql += ` ORDER BY pay.created_at DESC LIMIT 300`;
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

router.patch(
  '/invoices/:id/status',
  requireRoles('super_admin', 'finance', 'branch_manager'),
  param('id').isInt(),
  body('status').isIn(['outstanding', 'partial', 'paid', 'cancelled']),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const id = Number(req.params.id);
    const cur = await query(`SELECT * FROM invoices WHERE id = $1`, [id]);
    if (!cur.rows[0]) return res.status(404).json({ error: 'Invoice not found' });
    if (!assertPropertyAccess(req.user, cur.rows[0].property_id)) {
      return res.status(403).json({ error: 'Property access denied' });
    }
    const { rows } = await query(
      `UPDATE invoices SET status = $2 WHERE id = $1 RETURNING *`,
      [id, req.body.status]
    );
    res.json({ invoice: rows[0] });
  }
);

export default router;
