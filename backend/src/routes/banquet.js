import { Router } from 'express';
import { body, param, query as qv, validationResult } from 'express-validator';
import { query } from '../db/pool.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';
import { banquetFbGstPercent, splitCgstSgst } from '../services/financial.js';

const router = Router();
router.use(requireAuth);

function assertPropertyAccess(user, propertyId) {
  const pid = Number(propertyId);
  if (['super_admin', 'sales_manager', 'finance'].includes(user.role)) return true;
  return user.propertyIds?.includes(pid);
}

router.get('/venues', qv('property_id').isInt(), async (req, res) => {
  const propertyId = Number(req.query.property_id);
  if (!assertPropertyAccess(req.user, propertyId)) {
    return res.status(403).json({ error: 'Property access denied' });
  }
  const { rows } = await query(`SELECT * FROM venues WHERE property_id = $1 AND active = TRUE`, [propertyId]);
  res.json({ venues: rows });
});

router.post(
  '/venues',
  requireRoles('super_admin', 'branch_manager', 'banquet_coordinator'),
  body('property_id').isInt(),
  body('name').isString(),
  body('venue_type').isIn(['banquet_hall', 'lawn', 'conference_room', 'terrace', 'other']),
  async (req, res) => {
    const propertyId = Number(req.body.property_id);
    if (!assertPropertyAccess(req.user, propertyId)) {
      return res.status(403).json({ error: 'Property access denied' });
    }
    const { rows } = await query(
      `INSERT INTO venues (property_id, name, venue_type, capacity_min, capacity_max, floor_plan_notes)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [
        propertyId,
        req.body.name,
        req.body.venue_type,
        req.body.capacity_min ?? null,
        req.body.capacity_max ?? null,
        req.body.floor_plan_notes ?? null,
      ]
    );
    res.status(201).json({ venue: rows[0] });
  }
);

router.get('/venue-slots', qv('venue_id').optional().isInt(), qv('property_id').optional().isInt(), async (req, res) => {
  if (req.query.venue_id) {
    const { rows } = await query(`SELECT * FROM venue_time_slots WHERE venue_id = $1 ORDER BY start_time`, [
      Number(req.query.venue_id),
    ]);
    return res.json({ slots: rows });
  }
  if (req.query.property_id) {
    const pid = Number(req.query.property_id);
    if (!assertPropertyAccess(req.user, pid)) {
      return res.status(403).json({ error: 'Property access denied' });
    }
    const { rows } = await query(`SELECT * FROM venue_time_slots WHERE property_id = $1 ORDER BY venue_id, start_time`, [pid]);
    return res.json({ slots: rows });
  }
  return res.status(400).json({ error: 'venue_id or property_id required' });
});

router.post(
  '/banquet-bookings',
  requireRoles('super_admin', 'branch_manager', 'sales_manager', 'sales_executive', 'banquet_coordinator'),
  body('property_id').isInt(),
  body('venue_id').isInt(),
  body('event_date').isISO8601().toDate(),
  body('event_category').isIn(['corporate', 'social', 'group']),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const propertyId = Number(req.body.property_id);
    if (!assertPropertyAccess(req.user, propertyId)) {
      return res.status(403).json({ error: 'Property access denied' });
    }
    const venueId = Number(req.body.venue_id);
    const slotId = req.body.venue_slot_id ? Number(req.body.venue_slot_id) : null;
    const eventDate = req.body.event_date;

    const clash = await query(
      `SELECT id FROM banquet_bookings
       WHERE venue_id = $1 AND event_date = $2
         AND ($3::int IS NULL OR venue_slot_id IS NOT DISTINCT FROM $3)
         AND status NOT IN ('CXL')`,
      [venueId, eventDate, slotId]
    );
    if (clash.rows.length) {
      return res.status(409).json({ error: 'Venue slot conflict', conflicting_ids: clash.rows.map((r) => r.id) });
    }

    const withRoom = Boolean(req.body.with_room);
    const gstPct = banquetFbGstPercent(withRoom);
    const { cgstPct, sgstPct } = splitCgstSgst(gstPct);

    const { rows } = await query(
      `INSERT INTO banquet_bookings (
        property_id, venue_id, event_date, venue_slot_id, event_category, event_sub_type,
        with_room, linked_booking_id, status, slot_color, guaranteed_pax, menu_package, pricing, gst_split, lead_id
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
      [
        propertyId,
        venueId,
        eventDate,
        slotId,
        req.body.event_category,
        req.body.event_sub_type ?? null,
        withRoom,
        req.body.linked_booking_id ?? null,
        req.body.status ?? 'INQ',
        req.body.slot_color ?? 'red',
        req.body.guaranteed_pax ?? null,
        req.body.menu_package ?? null,
        JSON.stringify(req.body.pricing ?? {}),
        JSON.stringify({ gst_pct: gstPct, cgst_pct: cgstPct, sgst_pct: sgstPct }),
        req.body.lead_id ?? null,
      ]
    );
    res.status(201).json({ banquet_booking: rows[0] });
  }
);

router.patch(
  '/banquet-bookings/:id',
  param('id').isInt(),
  requireRoles('super_admin', 'branch_manager', 'banquet_coordinator', 'sales_manager'),
  async (req, res) => {
    const id = Number(req.params.id);
    const allowed = ['status', 'slot_color', 'guaranteed_pax', 'actual_pax', 'menu_package', 'pricing', 'gst_split'];
    const sets = [];
    const vals = [];
    let i = 1;
    for (const k of allowed) {
      if (req.body[k] !== undefined) {
        sets.push(`${k} = $${i++}`);
        vals.push(k === 'pricing' || k === 'gst_split' ? JSON.stringify(req.body[k]) : req.body[k]);
      }
    }
    if (!sets.length) return res.status(400).json({ error: 'No fields' });
    vals.push(id);
    const { rows } = await query(
      `UPDATE banquet_bookings SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${i} RETURNING *`,
      vals
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json({ banquet_booking: rows[0] });
  }
);

router.get('/banquet-bookings', qv('property_id').optional().isInt(), async (req, res) => {
  let sql = `SELECT bb.*, v.name AS venue_name FROM banquet_bookings bb JOIN venues v ON v.id = bb.venue_id WHERE 1=1`;
  const params = [];
  if (req.query.property_id) {
    const pid = Number(req.query.property_id);
    if (!assertPropertyAccess(req.user, pid)) {
      return res.status(403).json({ error: 'Property access denied' });
    }
    params.push(pid);
    sql += ` AND bb.property_id = $${params.length}`;
  } else if (!['super_admin', 'sales_manager', 'finance'].includes(req.user.role)) {
    if (!req.user.propertyIds?.length) return res.json({ banquet_bookings: [] });
    params.push(req.user.propertyIds);
    sql += ` AND bb.property_id = ANY($${params.length}::int[])`;
  }
  sql += ` ORDER BY bb.event_date DESC LIMIT 200`;
  const { rows } = await query(sql, params);
  res.json({ banquet_bookings: rows });
});

export default router;
