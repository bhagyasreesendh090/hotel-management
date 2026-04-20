import { Router } from 'express';
import { query as qv, validationResult } from 'express-validator';
import { query } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';
import { canAccessAllProperties } from '../constants/roles.js';

const router = Router();
router.use(requireAuth);

function propertyFilterSql(req, params, alias = '') {
  const col = alias ? `${alias}.property_id` : 'property_id';
  if (req.query.property_id) {
    params.push(Number(req.query.property_id));
    return ` AND ${col} = $${params.length}`;
  }
  if (!canAccessAllProperties(req.user.role)) {
    if (!req.user.propertyIds?.length) return ' AND 1=0';
    params.push(req.user.propertyIds);
    return ` AND ${col} = ANY($${params.length}::int[])`;
  }
  return '';
}

router.get(
  '/dashboard',
  qv('property_id').optional().isInt(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const bookingsParams = [];
    const pfB = propertyFilterSql(req, bookingsParams, 'b');
    const bookingsToday = await query(
      `SELECT COUNT(*)::int AS count
       FROM bookings b
       WHERE DATE(b.created_at) = CURRENT_DATE ${pfB}`,
      bookingsParams
    );

    const leadsParams = [];
    const pfL = propertyFilterSql(req, leadsParams, 'lp');
    const leadsOpen = await query(
      `SELECT COUNT(DISTINCT l.id)::int AS count
       FROM leads l
       LEFT JOIN lead_properties lp ON lp.lead_id = l.id
       WHERE l.status IN ('new','in_progress','quotation_sent','negotiating') ${pfL}`,
      leadsParams
    );

    const banquetParams = [];
    const pfBB = propertyFilterSql(req, banquetParams, 'bb');
    const banquetWeek = await query(
      `SELECT COUNT(*)::int AS count
       FROM banquet_bookings bb
       WHERE bb.event_date BETWEEN CURRENT_DATE AND (CURRENT_DATE + INTERVAL '7 day') ${pfBB}`,
      banquetParams
    );

    res.json({
      bookings_created_today: bookingsToday.rows[0].count,
      open_leads: leadsOpen.rows[0].count,
      banquet_next_7_days: banquetWeek.rows[0].count,
    });
  }
);

router.get(
  '/crm/pipeline',
  qv('property_id').optional().isInt(),
  async (req, res) => {
    const params = [];
    const pf = propertyFilterSql(req, params, 'lp');
    const { rows } = await query(
      `
      SELECT l.pipeline_stage, COUNT(*)::int AS count
      FROM leads l
      LEFT JOIN lead_properties lp ON lp.lead_id = l.id
      WHERE 1=1 ${pf}
      GROUP BY l.pipeline_stage
      ORDER BY l.pipeline_stage
      `,
      params
    );
    res.json({ pipeline: rows });
  }
);

router.get(
  '/finance/gst-summary',
  qv('property_id').optional().isInt(),
  qv('from').optional().isISO8601().toDate(),
  qv('to').optional().isISO8601().toDate(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const params = [];
    const pf = propertyFilterSql(req, params, 'i');

    if (req.query.from) {
      params.push(req.query.from);
    } else {
      params.push(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
    }
    const fromIdx = params.length;
    if (req.query.to) {
      params.push(req.query.to);
    } else {
      params.push(new Date());
    }
    const toIdx = params.length;

    const { rows } = await query(
      `
      SELECT i.property_id,
             DATE_TRUNC('month', i.invoice_date)::date AS month,
             SUM(i.sub_total)::numeric(14,2) AS sub_total,
             SUM(i.cgst)::numeric(14,2) AS cgst,
             SUM(i.sgst)::numeric(14,2) AS sgst,
             SUM(i.gst_total)::numeric(14,2) AS gst_total,
             SUM(i.total_amount)::numeric(14,2) AS total_amount
      FROM invoices i
      WHERE i.invoice_date BETWEEN $${fromIdx}::date AND $${toIdx}::date
      ${pf}
      GROUP BY i.property_id, DATE_TRUNC('month', i.invoice_date)
      ORDER BY month DESC, property_id
      `,
      params
    );
    res.json({ summary: rows });
  }
);

router.get(
  '/reservations/occupancy',
  qv('property_id').optional().isInt(),
  qv('from').isISO8601().toDate(),
  qv('to').isISO8601().toDate(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const params = [req.query.from, req.query.to];

    const pf = propertyFilterSql(req, params, 'b');
    const { rows } = await query(
      `
      SELECT b.property_id,
             brl.room_type_id,
             COUNT(*)::int AS booked_lines
      FROM booking_room_lines brl
      JOIN bookings b ON b.id = brl.booking_id
      WHERE b.status IN ('TENT','CONF-U','CONF-P','CI','CO')
        AND brl.check_in < $2::date AND brl.check_out > $1::date
        ${pf}
      GROUP BY b.property_id, brl.room_type_id
      ORDER BY b.property_id, brl.room_type_id
      `,
      params
    );
    res.json({ occupancy: rows });
  }
);

export default router;

