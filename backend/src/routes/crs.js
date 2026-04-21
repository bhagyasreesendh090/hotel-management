import { Router } from 'express';
import { body, param, query as qv, validationResult } from 'express-validator';
import { pool, query } from '../db/pool.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';
import { canAccessAllProperties } from '../constants/roles.js';
import { availabilityByRoomType } from '../services/availability.js';
import {
  calcLineAmounts,
  nightsBetween,
  roomGstPercent,
} from '../services/financial.js';
import { nextDsNumber } from '../services/dsNumber.js';
import { writeAudit } from '../utils/audit.js';

const router = Router();
router.use(requireAuth);

function assertPropertyAccess(user, propertyId) {
  const pid = Number(propertyId);
  if (canAccessAllProperties(user.role)) return true;
  return user.propertyIds?.includes(pid);
}

async function resolveNightlyRate(client, line, corporateAccountId) {
  if (line.nightly_rate != null && line.nightly_rate !== '') {
    return Number(line.nightly_rate);
  }
  const { rows } = await client.query(
    `SELECT base_rate_rbi FROM room_types WHERE id = $1`,
    [line.room_type_id]
  );
  const base = Number(rows[0]?.base_rate_rbi ?? 0);
  if (line.rate_type === 'CONTRACT' && corporateAccountId) {
    const cr = await client.query(
      `SELECT contract_rate FROM corporate_rate_lines
       WHERE corporate_account_id = $1 AND room_type_id = $2
       ORDER BY valid_from DESC NULLS LAST LIMIT 1`,
      [corporateAccountId, line.room_type_id]
    );
    if (cr.rows[0]) return Number(cr.rows[0].contract_rate);
  }
  return base;
}

/** ---------- Room types ---------- */
router.get('/room-types', qv('property_id').isInt(), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const propertyId = Number(req.query.property_id);
  if (!assertPropertyAccess(req.user, propertyId)) {
    return res.status(403).json({ error: 'Property access denied' });
  }
  const { rows } = await query(
    `SELECT
       rt.*,
       p.name AS property_name,
       COALESCE(room_counts.total_rooms, 0) AS total_rooms
     FROM room_types rt
     JOIN properties p ON p.id = rt.property_id
     LEFT JOIN (
       SELECT room_type_id, COUNT(*)::int AS total_rooms
       FROM rooms
       WHERE property_id = $1
       GROUP BY room_type_id
     ) AS room_counts ON room_counts.room_type_id = rt.id
     WHERE rt.property_id = $1 AND rt.active = TRUE
     ORDER BY rt.category`,
    [propertyId]
  );
  res.json({ room_types: rows });
});

router.post(
  '/room-types',
  requireRoles('super_admin', 'branch_manager'),
  body('property_id').isInt(),
  body('category').isString(),
  body('base_rate_rbi').isFloat(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const propertyId = Number(req.body.property_id);
    if (!assertPropertyAccess(req.user, propertyId)) {
      return res.status(403).json({ error: 'Property access denied' });
    }
    const {
      category,
      floor_wing,
      occupancy_max,
      base_rate_rbi,
      gst_rate_override,
      meal_plan_options,
      amenities,
      extra_person_charge,
    } = req.body;
    const { rows } = await query(
      `INSERT INTO room_types (property_id, category, floor_wing, occupancy_max, base_rate_rbi, gst_rate_override, add_on_options, amenities, extra_person_charge)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [
        propertyId,
        category,
        floor_wing ?? null,
        occupancy_max ?? 2,
        base_rate_rbi,
        gst_rate_override ?? null,
        JSON.stringify(meal_plan_options ?? []),
        JSON.stringify(amenities ?? []),
        extra_person_charge ?? 0,
      ]
    );
    await writeAudit(req.user.id, 'room_type', rows[0].id, 'create', null, rows[0]);
    res.status(201).json({ room_type: rows[0] });
  }
);

router.put(
  '/room-types/:id',
  requireRoles('super_admin', 'branch_manager'),
  param('id').isInt(),
  body('category').isString(),
  body('base_rate_rbi').isFloat(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const id = Number(req.params.id);
    const cur = await query(`SELECT * FROM room_types WHERE id = $1 AND active = TRUE`, [id]);
    if (!cur.rows[0]) return res.status(404).json({ error: 'Room type not found' });
    if (!assertPropertyAccess(req.user, cur.rows[0].property_id)) {
      return res.status(403).json({ error: 'Property access denied' });
    }
    const {
      category,
      floor_wing,
      occupancy_max,
      base_rate_rbi,
      gst_rate_override,
      meal_plan_options,
      amenities,
      extra_person_charge,
    } = req.body;
    const { rows } = await query(
      `UPDATE room_types
       SET category=$2, floor_wing=$3, occupancy_max=$4, base_rate_rbi=$5,
           gst_rate_override=$6, add_on_options=$7, amenities=$8, extra_person_charge=$9, updated_at=NOW()
       WHERE id=$1 AND active=TRUE RETURNING *`,
      [
        id,
        category,
        floor_wing ?? cur.rows[0].floor_wing,
        occupancy_max ?? cur.rows[0].occupancy_max,
        base_rate_rbi,
        gst_rate_override ?? cur.rows[0].gst_rate_override,
        JSON.stringify(meal_plan_options ?? cur.rows[0].add_on_options ?? []),
        JSON.stringify(amenities ?? cur.rows[0].amenities ?? []),
        extra_person_charge ?? cur.rows[0].extra_person_charge,
      ]
    );
    await writeAudit(req.user.id, 'room_type', id, 'update', cur.rows[0], rows[0]);
    res.json({ room_type: rows[0] });
  }
);

router.delete(
  '/room-types/:id',
  requireRoles('super_admin', 'branch_manager'),
  param('id').isInt(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const id = Number(req.params.id);
    const cur = await query(`SELECT * FROM room_types WHERE id = $1 AND active = TRUE`, [id]);
    if (!cur.rows[0]) return res.status(404).json({ error: 'Room type not found' });
    if (!assertPropertyAccess(req.user, cur.rows[0].property_id)) {
      return res.status(403).json({ error: 'Property access denied' });
    }
    await query(`UPDATE room_types SET active=FALSE, updated_at=NOW() WHERE id=$1`, [id]);
    await writeAudit(req.user.id, 'room_type', id, 'delete', cur.rows[0], null);
    res.json({ success: true });
  }
);

/** ---------- Rooms ---------- */
router.get('/rooms', qv('property_id').isInt(), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const propertyId = Number(req.query.property_id);
  if (!assertPropertyAccess(req.user, propertyId)) {
    return res.status(403).json({ error: 'Property access denied' });
  }
  const { rows } = await query(
    `SELECT r.*, rt.category AS room_type_category
     FROM rooms r
     JOIN room_types rt ON rt.id = r.room_type_id
     WHERE r.property_id = $1
     ORDER BY rt.category, r.room_number`,
    [propertyId]
  );
  res.json({ rooms: rows });
});

router.post(
  '/rooms',
  requireRoles('super_admin', 'branch_manager'),
  body('property_id').isInt(),
  body('room_type_id').isInt(),
  body('room_number').isString(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const propertyId = Number(req.body.property_id);
    if (!assertPropertyAccess(req.user, propertyId)) {
      return res.status(403).json({ error: 'Property access denied' });
    }
    const { room_type_id, room_number, status } = req.body;
    const { rows } = await query(
      `INSERT INTO rooms (property_id, room_type_id, room_number, status)
       VALUES ($1,$2,$3, COALESCE($4,'available'))
       RETURNING *`,
      [propertyId, room_type_id, room_number, status ?? null]
    );
    await writeAudit(req.user.id, 'room', rows[0].id, 'create', null, rows[0]);
    res.status(201).json({ room: rows[0] });
  }
);

router.put(
  '/rooms/:id',
  requireRoles('super_admin', 'branch_manager'),
  param('id').isInt(),
  body('room_number').isString(),
  body('room_type_id').isInt(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const id = Number(req.params.id);
    const cur = await query(`SELECT * FROM rooms WHERE id = $1`, [id]);
    if (!cur.rows[0]) return res.status(404).json({ error: 'Room not found' });
    if (!assertPropertyAccess(req.user, cur.rows[0].property_id)) {
      return res.status(403).json({ error: 'Property access denied' });
    }
    const { room_number, room_type_id, status } = req.body;
    const { rows } = await query(
      `UPDATE rooms SET room_number=$2, room_type_id=$3, status=COALESCE($4,status), updated_at=NOW()
       WHERE id=$1 RETURNING *`,
      [id, room_number, room_type_id, status ?? null]
    );
    await writeAudit(req.user.id, 'room', id, 'update', cur.rows[0], rows[0]);
    res.json({ room: rows[0] });
  }
);

router.delete(
  '/rooms/:id',
  requireRoles('super_admin', 'branch_manager'),
  param('id').isInt(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const id = Number(req.params.id);
    const cur = await query(`SELECT * FROM rooms WHERE id = $1`, [id]);
    if (!cur.rows[0]) return res.status(404).json({ error: 'Room not found' });
    if (!assertPropertyAccess(req.user, cur.rows[0].property_id)) {
      return res.status(403).json({ error: 'Property access denied' });
    }
    // Hard delete only if no active bookings reference this room
    const inUse = await query(
      `SELECT 1 FROM booking_room_lines WHERE room_id = $1 LIMIT 1`,
      [id]
    );
    if (inUse.rows.length > 0) {
      return res.status(409).json({ error: 'Cannot delete room — it is referenced by existing bookings.' });
    }
    await query(`DELETE FROM rooms WHERE id = $1`, [id]);
    await writeAudit(req.user.id, 'room', id, 'delete', cur.rows[0], null);
    res.json({ success: true });
  }
);

/** ---------- Availability ---------- */
router.get(
  '/availability',
  qv('property_id').isInt(),
  qv('from').isISO8601().toDate(),
  qv('to').isISO8601().toDate(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const propertyId = Number(req.query.property_id);
    if (!assertPropertyAccess(req.user, propertyId)) {
      return res.status(403).json({ error: 'Property access denied' });
    }
    const from = req.query.from;
    const to = req.query.to;
    const rows = await availabilityByRoomType(propertyId, from, to);
    res.json({ from, to, property_id: propertyId, availability: rows });
  }
);

/** ---------- Room blocks ---------- */
router.post(
  '/room-blocks',
  requireRoles('super_admin', 'branch_manager', 'front_desk'),
  body('property_id').isInt(),
  body('start_date').isISO8601().toDate(),
  body('end_date').isISO8601().toDate(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const propertyId = Number(req.body.property_id);
    if (!assertPropertyAccess(req.user, propertyId)) {
      return res.status(403).json({ error: 'Property access denied' });
    }
    const { room_id, room_type_id, reason, slot_color } = req.body;
    const { rows } = await query(
      `INSERT INTO room_blocks (property_id, room_id, room_type_id, start_date, end_date, reason, slot_color)
       VALUES ($1,$2,$3,$4,$5,$6, COALESCE($7,'red'))
       RETURNING *`,
      [
        propertyId,
        room_id ?? null,
        room_type_id ?? null,
        req.body.start_date,
        req.body.end_date,
        reason ?? null,
        slot_color ?? null,
      ]
    );
    res.status(201).json({ block: rows[0] });
  }
);

/** ---------- Bookings ---------- */
router.get('/bookings', qv('property_id').optional().isInt(), async (req, res) => {
  const propertyId = req.query.property_id ? Number(req.query.property_id) : null;
  if (propertyId && !assertPropertyAccess(req.user, propertyId)) {
    return res.status(403).json({ error: 'Property access denied' });
  }
  let sql = `
    SELECT
      b.*,
      p.code AS property_code,
      line_summary.check_in,
      line_summary.check_out,
      line_summary.total_adults,
      line_summary.total_children,
      line_summary.total_rooms,
      line_summary.meal_plan,
      line_summary.room_types
    FROM bookings b
    JOIN properties p ON p.id = b.property_id
    LEFT JOIN (
      SELECT
        brl.booking_id,
        MIN(brl.id)::int AS primary_room_line_id,
        MIN(brl.check_in) AS check_in,
        MAX(brl.check_out) AS check_out,
        SUM(brl.adults)::int AS total_adults,
        SUM(brl.children)::int AS total_children,
        COUNT(*)::int AS total_rooms,
        STRING_AGG(DISTINCT brl.meal_plan, ', ' ORDER BY brl.meal_plan) AS meal_plan,
        STRING_AGG(DISTINCT rt.category, ', ' ORDER BY rt.category) AS room_types
      FROM booking_room_lines brl
      JOIN room_types rt ON rt.id = brl.room_type_id
      GROUP BY brl.booking_id
    ) AS line_summary ON line_summary.booking_id = b.id
    WHERE 1=1`;
  const params = [];
  if (propertyId) {
    params.push(propertyId);
    sql += ` AND b.property_id = $${params.length}`;
  } else if (!canAccessAllProperties(req.user.role)) {
    if (!req.user.propertyIds?.length) return res.json({ bookings: [] });
    params.push(req.user.propertyIds);
    sql += ` AND b.property_id = ANY($${params.length}::int[])`;
  }
  sql += ` ORDER BY b.created_at DESC LIMIT 200`;
  const { rows } = await query(sql, params);
  res.json({ bookings: rows });
});

router.get('/bookings/:id', param('id').isInt(), async (req, res) => {
  const id = Number(req.params.id);
  const b = await query(`SELECT * FROM bookings WHERE id = $1`, [id]);
  const booking = b.rows[0];
  if (!booking) return res.status(404).json({ error: 'Not found' });
  if (!assertPropertyAccess(req.user, booking.property_id)) {
    return res.status(403).json({ error: 'Property access denied' });
  }
  const lines = await query(`SELECT * FROM booking_room_lines WHERE booking_id = $1`, [id]);
  res.json({ booking, lines: lines.rows });
});

router.post(
  '/bookings',
  requireRoles(
    'super_admin',
    'branch_manager',
    'sales_manager',
    'sales_executive',
    'front_desk'
  ),
  body('property_id').isInt(),
  body('lines').isArray({ min: 1 }),
  body('lines.*.room_type_id').isInt(),
  body('lines.*.check_in').isISO8601().toDate(),
  body('lines.*.check_out').isISO8601().toDate(),
  body('lines.*.meal_plan').isIn(['CP', 'AP', 'MAP', 'ROOM_ONLY', 'CUSTOM']),
  body('lines.*.rate_type').isIn(['RBI', 'CONTRACT', 'GUEST', 'KINGS_DISCOUNT', 'SPECIFIC']),
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

      const {
        status,
        booker_type,
        booker_same_as_guest,
        booker_name,
        booker_email,
        booker_phone,
        booker_company,
        guest_name,
        guest_email,
        guest_phone,
        booking_source,
        corporate_account_id,
        travel_agent_id,
        lead_id,
        is_group,
        group_discount_note,
        kids_zone,
        special_notes,
        advance_received,
        btc_flag,
        lines,
      } = req.body;

      const corpId = corporate_account_id ? Number(corporate_account_id) : null;

      const ins = await client.query(
        `INSERT INTO bookings (
          property_id, status, booker_type, booker_same_as_guest,
          booker_name, booker_email, booker_phone, booker_company,
          guest_name, guest_email, guest_phone, booking_source,
          corporate_account_id, travel_agent_id, lead_id,
          is_group, group_discount_note, kids_zone, special_notes,
          advance_received, btc_flag, created_by
        ) VALUES (
          $1, COALESCE($2,'INQ'), $3, COALESCE($4,false),
          $5,$6,$7,$8,
          $9,$10,$11,$12,
          $13,$14,$15,
          COALESCE($16,false), $17, COALESCE($18,false), $19,
          COALESCE($20,0), COALESCE($21,false), $22
        ) RETURNING *`,
        [
          propertyId,
          status ?? 'INQ',
          booker_type ?? null,
          booker_same_as_guest,
          booker_name ?? null,
          booker_email ?? null,
          booker_phone ?? null,
          booker_company ?? null,
          guest_name ?? null,
          guest_email ?? null,
          guest_phone ?? null,
          booking_source ?? null,
          corpId,
          travel_agent_id ?? null,
          lead_id ?? null,
          is_group,
          group_discount_note ?? null,
          kids_zone,
          special_notes ?? null,
          advance_received,
          btc_flag,
          req.user.id,
        ]
      );
      const booking = ins.rows[0];

      let subTotal = 0;
      let gstTotal = 0;

      for (const line of lines) {
        const nights = nightsBetween(line.check_in, line.check_out);
        const pax = Number(line.adults ?? 1) + Number(line.children ?? 0);
        const nightly = await resolveNightlyRate(client, line, corpId);
        const rtRow = await client.query(
          `SELECT gst_rate_override FROM room_types WHERE id = $1`,
          [line.room_type_id]
        );
        const gstPct = roomGstPercent(nightly, rtRow.rows[0]?.gst_rate_override);
        const { line_sub_total, line_gst, line_total } = calcLineAmounts({
          nightlyRate: nightly,
          nights,
          pax,
          gstPct,
        });

        await client.query(
          `INSERT INTO booking_room_lines (
            booking_id, room_type_id, room_id, check_in, check_out,
            adults, children, meal_plan, rate_type, nightly_rate, rate_override_note,
            add_ons, complimentaries, line_sub_total, line_gst, line_total
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
          [
            booking.id,
            line.room_type_id,
            line.room_id ?? null,
            line.check_in,
            line.check_out,
            line.adults ?? 1,
            line.children ?? 0,
            line.meal_plan,
            line.rate_type,
            nightly,
            line.rate_override_note ?? null,
            JSON.stringify(line.add_ons ?? []),
            JSON.stringify(line.complimentaries ?? []),
            line_sub_total,
            line_gst,
            line_total,
          ]
        );
        subTotal += line_sub_total;
        gstTotal += line_gst;
      }

      const total = subTotal + gstTotal;
      const adv = Number(advance_received ?? 0);
      const balanceDue = Math.max(0, total - adv);

      await client.query(
        `UPDATE bookings SET sub_total = $1, gst_amount = $2, total_amount = $3, advance_received = $4, balance_due = $5, updated_at = NOW()
         WHERE id = $6`,
        [subTotal, gstTotal, total, adv, balanceDue, booking.id]
      );

      await client.query('COMMIT');

      const fixBal = await query(`SELECT * FROM bookings WHERE id = $1`, [booking.id]);
      const b = fixBal.rows[0];
      await writeAudit(req.user.id, 'booking', b.id, 'create', null, b);
      const lr = await query(`SELECT * FROM booking_room_lines WHERE booking_id = $1`, [b.id]);
      res.status(201).json({ booking: b, lines: lr.rows });
    } catch (e) {
      await client.query('ROLLBACK');
      console.error(e);
      res.status(500).json({ error: e.message || 'Booking failed' });
    } finally {
      client.release();
    }
  }
);

const DS_STATUSES = new Set(['CONF-U', 'CONF-P']);

router.patch(
  '/bookings/:id/status',
  requireRoles('super_admin', 'branch_manager', 'sales_manager', 'sales_executive', 'front_desk'),
  param('id').isInt(),
  body('status').isIn(['INQ', 'QTN-HOLD', 'TENT', 'CONF-U', 'CONF-P', 'SOLD', 'CXL', 'CI', 'CO']),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const id = Number(req.params.id);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const cur = await client.query(`SELECT * FROM bookings WHERE id = $1 FOR UPDATE`, [id]);
      const booking = cur.rows[0];
      if (!booking) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Not found' });
      }
      if (!assertPropertyAccess(req.user, booking.property_id)) {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: 'Property access denied' });
      }

      const newStatus = req.body.status;
      let ds = booking.ds_number;
      if (DS_STATUSES.has(newStatus) && !ds) {
        const p = await client.query(`SELECT code FROM properties WHERE id = $1`, [booking.property_id]);
        ds = await nextDsNumber(client, booking.property_id, p.rows[0].code);
      }

      await client.query(
        `UPDATE bookings SET status = $2, ds_number = COALESCE($3, ds_number), updated_at = NOW() WHERE id = $1`,
        [id, newStatus, ds]
      );
      await client.query('COMMIT');
      const { rows } = await query(`SELECT * FROM bookings WHERE id = $1`, [id]);
      await writeAudit(req.user.id, 'booking', id, 'status_change', booking, rows[0]);
      res.json({ booking: rows[0] });
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
  '/bookings/:id/check-in',
  requireRoles('super_admin', 'branch_manager', 'front_desk'),
  param('id').isInt(),
  body('room_line_id').isInt(),
  body('room_id').isInt(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const bookingId = Number(req.params.id);
    const b = await query(`SELECT * FROM bookings WHERE id = $1`, [bookingId]);
    if (!b.rows[0]) return res.status(404).json({ error: 'Not found' });
    if (!assertPropertyAccess(req.user, b.rows[0].property_id)) {
      return res.status(403).json({ error: 'Property access denied' });
    }
    await query(
      `UPDATE booking_room_lines SET room_id = $3 WHERE id = $1 AND booking_id = $2`,
      [req.body.room_line_id, bookingId, req.body.room_id]
    );
    await query(`UPDATE bookings SET status = 'CI', updated_at = NOW() WHERE id = $1`, [bookingId]);
    const { rows } = await query(`SELECT * FROM bookings WHERE id = $1`, [bookingId]);
    res.json({ booking: rows[0] });
  }
);

router.post(
  '/bookings/:id/check-out',
  requireRoles('super_admin', 'branch_manager', 'front_desk'),
  param('id').isInt(),
  async (req, res) => {
    const bookingId = Number(req.params.id);
    const b = await query(`SELECT * FROM bookings WHERE id = $1`, [bookingId]);
    if (!b.rows[0]) return res.status(404).json({ error: 'Not found' });
    if (!assertPropertyAccess(req.user, b.rows[0].property_id)) {
      return res.status(403).json({ error: 'Property access denied' });
    }
    const { billing_mode } = req.body;
    await query(
      `UPDATE bookings SET status = 'CO', billing_mode = COALESCE($2, billing_mode), updated_at = NOW() WHERE id = $1`,
      [bookingId, billing_mode ?? null]
    );
    const { rows } = await query(`SELECT * FROM bookings WHERE id = $1`, [bookingId]);
    res.json({ booking: rows[0] });
  }
);

export default router;
