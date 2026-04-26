import { Router } from 'express';
import { body, param, query as qv, validationResult } from 'express-validator';
import { query } from '../db/pool.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';
import { canAccessAllProperties } from '../constants/roles.js';
import { banquetFbGstPercent, splitCgstSgst } from '../services/financial.js';

const router = Router();
router.use(requireAuth);

const eventSubTypes = {
  corporate: ['conference', 'seminar', 'meeting', 'team_offsite'],
  social: ['wedding', 'birthday', 'anniversary', 'engagement'],
  group: ['tour_groups', 'association_gatherings'],
};

const editableStatuses = ['INQ', 'QTN-HOLD', 'TENT', 'CONF-U', 'CONF-P', 'CXL'];
const statusColorMap = {
  INQ: 'red',
  'QTN-HOLD': 'red',
  TENT: 'amber',
  'CONF-U': 'blue',
  'CONF-P': 'blue',
  CXL: 'red',
};

function assertPropertyAccess(user, propertyId) {
  const pid = Number(propertyId);
  if (canAccessAllProperties(user.role)) return true;
  return user.propertyIds?.includes(pid);
}

function deriveSlotColor(status, requestedColor) {
  if (statusColorMap[status]) return statusColorMap[status];
  return requestedColor ?? 'red';
}

function validateEventSubType(category, subType) {
  if (!subType) return true;
  const allowed = eventSubTypes[category];
  return Array.isArray(allowed) ? allowed.includes(subType) : false;
}

async function getVenueForProperty(propertyId, venueId) {
  const { rows } = await query(`SELECT * FROM venues WHERE id = $1 AND property_id = $2 AND active = TRUE`, [
    venueId,
    propertyId,
  ]);
  return rows[0] ?? null;
}

async function getSlotForVenue(propertyId, venueId, slotId) {
  const { rows } = await query(
    `SELECT * FROM venue_time_slots WHERE id = $1 AND venue_id = $2 AND property_id = $3`,
    [slotId, venueId, propertyId]
  );
  return rows[0] ?? null;
}

async function findBookingConflict({ venueId, eventDate, slotId }) {
  const requestedSlot = await query(`SELECT * FROM venue_time_slots WHERE id = $1`, [slotId]);
  const requested = requestedSlot.rows[0];
  if (!requested) return [];

  const existing = await query(
    `SELECT bb.id, bb.status, bb.slot_color, bb.venue_slot_id, vts.label, vts.session_kind
     FROM banquet_bookings bb
     LEFT JOIN venue_time_slots vts ON vts.id = bb.venue_slot_id
     WHERE bb.venue_id = $1
       AND bb.event_date = $2
       AND bb.status NOT IN ('CXL')`,
    [venueId, eventDate]
  );

  return existing.rows.filter((row) => {
    if (row.venue_slot_id == null) return true;
    if (row.venue_slot_id === slotId) return true;
    if (row.session_kind === 'full_day' || requested.session_kind === 'full_day') return true;
    return false;
  });
}

router.get('/metadata', async (_req, res) => {
  res.json({
    event_categories: Object.keys(eventSubTypes),
    event_sub_types: eventSubTypes,
    banquet_types: [
      { value: 'without_room', label: 'Without Room', gst_percent: 5 },
      { value: 'with_room', label: 'With Room', gst_percent: 18 },
    ],
    menu_packages: [
      {
        code: 'deluxe',
        label: 'Deluxe',
        per_plate_rate: 899,
        event_categories: ['corporate', 'social', 'group'],
        items: ['Welcome drink', '2 veg starters', '3 main course dishes', 'Rice', 'Bread', 'Dessert'],
      },
      {
        code: 'premium',
        label: 'Premium',
        per_plate_rate: 1199,
        event_categories: ['corporate', 'social', 'group'],
        items: ['Mocktail', '3 veg starters', '1 non-veg starter', '4 mains', 'Live counter', '2 desserts'],
      },
      {
        code: 'super',
        label: 'Super',
        per_plate_rate: 1499,
        event_categories: ['social', 'group'],
        items: ['Signature drink', '4 starters', '2 non-veg mains', '5 veg mains', 'Live counter', '3 desserts'],
      },
      {
        code: 'banquet',
        label: 'Banquet',
        per_plate_rate: 999,
        event_categories: ['corporate', 'group'],
        items: ['Soup', '2 starters', 'Buffet spread', 'Rice', 'Bread', 'Dessert'],
      },
      {
        code: 'custom',
        label: 'Custom',
        per_plate_rate: 0,
        event_categories: ['corporate', 'social', 'group'],
        items: ['Custom menu pricing applies'],
      },
    ],
    statuses: editableStatuses,
  });
});

router.get('/venues', qv('property_id').isInt(), async (req, res) => {
  const propertyId = Number(req.query.property_id);
  if (!assertPropertyAccess(req.user, propertyId)) {
    return res.status(403).json({ error: 'Property access denied' });
  }
  const { rows } = await query(`SELECT * FROM venues WHERE property_id = $1 AND active = TRUE ORDER BY name`, [propertyId]);
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
    if (
      req.body.capacity_min != null &&
      req.body.capacity_max != null &&
      Number(req.body.capacity_min) > Number(req.body.capacity_max)
    ) {
      return res.status(400).json({ error: 'Min capacity cannot exceed max capacity' });
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

router.put(
  '/venues/:id',
  requireRoles('super_admin', 'branch_manager', 'banquet_coordinator'),
  param('id').isInt(),
  body('name').isString(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    if (
      req.body.capacity_min != null &&
      req.body.capacity_max != null &&
      Number(req.body.capacity_min) > Number(req.body.capacity_max)
    ) {
      return res.status(400).json({ error: 'Min capacity cannot exceed max capacity' });
    }
    const id = Number(req.params.id);
    const cur = await query(`SELECT * FROM venues WHERE id = $1 AND active = TRUE`, [id]);
    if (!cur.rows[0]) return res.status(404).json({ error: 'Venue not found' });
    if (!assertPropertyAccess(req.user, cur.rows[0].property_id)) {
      return res.status(403).json({ error: 'Property access denied' });
    }
    const { name, venue_type, capacity_min, capacity_max, floor_plan_notes } = req.body;
    const { rows } = await query(
      `UPDATE venues
       SET name = $2,
           venue_type = COALESCE($3, venue_type),
           capacity_min = $4,
           capacity_max = $5,
           floor_plan_notes = $6
       WHERE id = $1 AND active = TRUE
       RETURNING *`,
      [id, name, venue_type ?? null, capacity_min ?? null, capacity_max ?? null, floor_plan_notes ?? null]
    );
    res.json({ venue: rows[0] });
  }
);

router.delete(
  '/venues/:id',
  requireRoles('super_admin', 'branch_manager', 'banquet_coordinator'),
  param('id').isInt(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const id = Number(req.params.id);
    const cur = await query(`SELECT * FROM venues WHERE id = $1 AND active = TRUE`, [id]);
    if (!cur.rows[0]) return res.status(404).json({ error: 'Venue not found' });
    if (!assertPropertyAccess(req.user, cur.rows[0].property_id)) {
      return res.status(403).json({ error: 'Property access denied' });
    }
    const inUse = await query(
      `SELECT 1 FROM banquet_bookings WHERE venue_id = $1 AND status NOT IN ('CXL') AND event_date >= CURRENT_DATE LIMIT 1`,
      [id]
    );
    if (inUse.rows.length > 0) {
      return res.status(409).json({ error: 'Cannot delete venue - it has active upcoming bookings.' });
    }
    await query(`UPDATE venues SET active = FALSE WHERE id = $1`, [id]);
    res.json({ success: true });
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
  '/venue-slots',
  requireRoles('super_admin', 'branch_manager', 'banquet_coordinator'),
  body('venue_id').isInt(),
  body('property_id').isInt(),
  body('label').isString().notEmpty(),
  body('start_time').matches(/^\d{2}:\d{2}$/),
  body('end_time').matches(/^\d{2}:\d{2}$/),
  body('session_kind').isIn(['morning', 'afternoon', 'evening', 'full_day', 'custom']),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const propertyId = Number(req.body.property_id);
    if (!assertPropertyAccess(req.user, propertyId)) {
      return res.status(403).json({ error: 'Property access denied' });
    }
    const { venue_id, label, start_time, end_time, session_kind } = req.body;
    const { rows } = await query(
      `INSERT INTO venue_time_slots (venue_id, property_id, label, start_time, end_time, session_kind)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [venue_id, propertyId, label, start_time, end_time, session_kind]
    );
    res.status(201).json({ slot: rows[0] });
  }
);

router.put(
  '/venue-slots/:id',
  requireRoles('super_admin', 'branch_manager', 'banquet_coordinator'),
  param('id').isInt(),
  body('label').isString().notEmpty(),
  body('start_time').matches(/^\d{2}:\d{2}$/),
  body('end_time').matches(/^\d{2}:\d{2}$/),
  body('session_kind').isIn(['morning', 'afternoon', 'evening', 'full_day', 'custom']),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const id = Number(req.params.id);
    const cur = await query(`SELECT * FROM venue_time_slots WHERE id = $1`, [id]);
    if (!cur.rows[0]) return res.status(404).json({ error: 'Slot not found' });
    if (!assertPropertyAccess(req.user, cur.rows[0].property_id)) {
      return res.status(403).json({ error: 'Property access denied' });
    }
    const { label, start_time, end_time, session_kind } = req.body;
    const { rows } = await query(
      `UPDATE venue_time_slots SET label=$2, start_time=$3, end_time=$4, session_kind=$5 WHERE id=$1 RETURNING *`,
      [id, label, start_time, end_time, session_kind]
    );
    res.json({ slot: rows[0] });
  }
);

router.delete(
  '/venue-slots/:id',
  requireRoles('super_admin', 'branch_manager', 'banquet_coordinator'),
  param('id').isInt(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const id = Number(req.params.id);
    const cur = await query(`SELECT * FROM venue_time_slots WHERE id = $1`, [id]);
    if (!cur.rows[0]) return res.status(404).json({ error: 'Slot not found' });
    if (!assertPropertyAccess(req.user, cur.rows[0].property_id)) {
      return res.status(403).json({ error: 'Property access denied' });
    }
    const inUse = await query(
      `SELECT 1 FROM banquet_bookings WHERE venue_slot_id = $1 AND status NOT IN ('CXL') LIMIT 1`,
      [id]
    );
    if (inUse.rows.length > 0) {
      return res.status(409).json({ error: 'Cannot delete slot — it has active bookings.' });
    }
    await query(`DELETE FROM venue_time_slots WHERE id = $1`, [id]);
    // Also remove any maintenance blocks for this slot
    await query(`DELETE FROM venue_maintenance_blocks WHERE venue_slot_id = $1`, [id]);
    res.json({ success: true });
  }
);

/* ── Maintenance / buffer blocks ─────────────────────────────────────────── */
router.get('/maintenance-blocks', qv('property_id').isInt(), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const pid = Number(req.query.property_id);
  if (!assertPropertyAccess(req.user, pid)) {
    return res.status(403).json({ error: 'Property access denied' });
  }
  const { rows } = await query(
    `SELECT mb.*, v.name AS venue_name, vts.label AS slot_label
     FROM venue_maintenance_blocks mb
     JOIN venues v ON v.id = mb.venue_id
     LEFT JOIN venue_time_slots vts ON vts.id = mb.venue_slot_id
     WHERE mb.property_id = $1
     ORDER BY mb.block_date DESC, v.name`,
    [pid]
  );
  res.json({ blocks: rows });
});

router.post(
  '/maintenance-blocks',
  requireRoles('super_admin', 'branch_manager', 'banquet_coordinator'),
  body('venue_id').isInt(),
  body('property_id').isInt(),
  body('block_date').isISO8601(),
  body('reason').isString().notEmpty(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const propertyId = Number(req.body.property_id);
    if (!assertPropertyAccess(req.user, propertyId)) {
      return res.status(403).json({ error: 'Property access denied' });
    }
    const { venue_id, venue_slot_id, block_date, reason } = req.body;
    const { rows } = await query(
      `INSERT INTO venue_maintenance_blocks (venue_id, property_id, venue_slot_id, block_date, reason)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [venue_id, propertyId, venue_slot_id ?? null, block_date, reason]
    );
    res.status(201).json({ block: rows[0] });
  }
);

router.delete(
  '/maintenance-blocks/:id',
  requireRoles('super_admin', 'branch_manager', 'banquet_coordinator'),
  param('id').isInt(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const id = Number(req.params.id);
    const cur = await query(`SELECT * FROM venue_maintenance_blocks WHERE id = $1`, [id]);
    if (!cur.rows[0]) return res.status(404).json({ error: 'Block not found' });
    if (!assertPropertyAccess(req.user, cur.rows[0].property_id)) {
      return res.status(403).json({ error: 'Property access denied' });
    }
    await query(`DELETE FROM venue_maintenance_blocks WHERE id = $1`, [id]);
    res.json({ success: true });
  }
);

router.get(
  '/availability',
  qv('property_id').isInt(),
  qv('event_date').isISO8601(),
  async (req, res) => {
    const propertyId = Number(req.query.property_id);
    const eventDate = String(req.query.event_date);
    if (!assertPropertyAccess(req.user, propertyId)) {
      return res.status(403).json({ error: 'Property access denied' });
    }

    const venues = await query(`SELECT * FROM venues WHERE property_id = $1 AND active = TRUE ORDER BY name`, [propertyId]);
    const slots = await query(
      `SELECT * FROM venue_time_slots WHERE property_id = $1 ORDER BY venue_id, start_time, label`,
      [propertyId]
    );
    const bookings = await query(
      `SELECT bb.*, v.name AS venue_name, vts.label AS slot_label, vts.session_kind
       FROM banquet_bookings bb
       JOIN venues v ON v.id = bb.venue_id
       LEFT JOIN venue_time_slots vts ON vts.id = bb.venue_slot_id
       WHERE bb.property_id = $1 AND bb.event_date = $2 AND bb.status NOT IN ('CXL')`,
      [propertyId, eventDate]
    );

    const slotsByVenue = new Map();
    for (const slot of slots.rows) {
      const current = slotsByVenue.get(slot.venue_id) ?? [];
      current.push(slot);
      slotsByVenue.set(slot.venue_id, current);
    }

    const bookingsByVenue = new Map();
    for (const booking of bookings.rows) {
      const current = bookingsByVenue.get(booking.venue_id) ?? [];
      current.push(booking);
      bookingsByVenue.set(booking.venue_id, current);
    }

    const availability = venues.rows.map((venue) => {
      const venueSlots = slotsByVenue.get(venue.id) ?? [];
      const venueBookings = bookingsByVenue.get(venue.id) ?? [];

      const sessions = venueSlots.map((slot) => {
        const blockingFullDay = venueBookings.find((booking) => booking.session_kind === 'full_day');
        const directBooking = venueBookings.find((booking) => booking.venue_slot_id === slot.id);
        const booking = blockingFullDay ?? directBooking ?? null;

        return {
          slot_id: slot.id,
          label: slot.label,
          start_time: slot.start_time,
          end_time: slot.end_time,
          session_kind: slot.session_kind,
          state: booking ? booking.slot_color : 'red',
          booking_status: booking?.status ?? null,
          booking_id: booking?.id ?? null,
          event_category: booking?.event_category ?? null,
          event_sub_type: booking?.event_sub_type ?? null,
          menu_package: booking?.menu_package ?? null,
          with_room: booking?.with_room ?? false,
        };
      });

      return {
        venue,
        sessions,
      };
    });

    res.json({ availability });
  }
);

router.post(
  '/banquet-bookings',
  requireRoles('super_admin', 'branch_manager', 'sales_manager', 'sales_executive', 'banquet_coordinator'),
  body('property_id').isInt(),
  body('venue_id').isInt(),
  body('venue_slot_id').isInt(),
  body('event_date').isISO8601(),
  body('event_category').isIn(['corporate', 'social', 'group']),
  body('status').optional().isIn(editableStatuses),
  body('menu_package').optional().isString(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const propertyId = Number(req.body.property_id);
    const venueId = Number(req.body.venue_id);
    const slotId = Number(req.body.venue_slot_id);
    const eventDate = String(req.body.event_date).slice(0, 10);
    const category = req.body.event_category;
    const subType = req.body.event_sub_type ?? null;
    const withRoom = Boolean(req.body.with_room);
    const linkedBookingId = req.body.linked_booking_id ?? null;
    const status = req.body.status ?? 'INQ';

    if (!assertPropertyAccess(req.user, propertyId)) {
      return res.status(403).json({ error: 'Property access denied' });
    }
    if (!validateEventSubType(category, subType)) {
      return res.status(400).json({ error: 'Invalid event sub-type for selected category' });
    }
    if (withRoom && !linkedBookingId) {
      return res.status(400).json({ error: 'With Room banquet must be linked to a room booking' });
    }
    if (!withRoom && linkedBookingId) {
      return res.status(400).json({ error: 'Standalone banquet cannot have a linked room booking' });
    }

    const venue = await getVenueForProperty(propertyId, venueId);
    if (!venue) {
      return res.status(400).json({ error: 'Invalid venue for selected property' });
    }
    const slot = await getSlotForVenue(propertyId, venueId, slotId);
    if (!slot) {
      return res.status(400).json({ error: 'Invalid session for selected venue' });
    }

    const guaranteedPax = req.body.guaranteed_pax != null ? Number(req.body.guaranteed_pax) : null;
    if (guaranteedPax != null && guaranteedPax <= 0) {
      return res.status(400).json({ error: 'Guaranteed PAX must be greater than zero' });
    }
    if (venue.capacity_min != null && guaranteedPax != null && guaranteedPax < venue.capacity_min) {
      return res.status(400).json({ error: `Guaranteed PAX is below the minimum capacity of ${venue.capacity_min}` });
    }
    if (venue.capacity_max != null && guaranteedPax != null && guaranteedPax > venue.capacity_max) {
      return res.status(400).json({ error: `Guaranteed PAX exceeds the maximum capacity of ${venue.capacity_max}` });
    }

    const clash = await findBookingConflict({ venueId, eventDate, slotId });
    if (clash.length) {
      return res.status(409).json({
        error: 'Venue slot conflict',
        conflicting_ids: clash.map((row) => row.id),
        conflicting_statuses: clash.map((row) => ({ id: row.id, status: row.status, slot_color: row.slot_color, label: row.label })),
      });
    }

    const gstPct = banquetFbGstPercent(withRoom);
    const { cgstPct, sgstPct } = splitCgstSgst(gstPct);
    const slotColor = deriveSlotColor(status, req.body.slot_color);

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
        category,
        subType,
        withRoom,
        linkedBookingId,
        status,
        slotColor,
        guaranteedPax,
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
    const current = await query(`SELECT * FROM banquet_bookings WHERE id = $1`, [id]);
    if (!current.rows[0]) return res.status(404).json({ error: 'Not found' });
    if (!assertPropertyAccess(req.user, current.rows[0].property_id)) {
      return res.status(403).json({ error: 'Property access denied' });
    }

    const nextStatus = req.body.status ?? current.rows[0].status;
    const slotColor = deriveSlotColor(nextStatus, req.body.slot_color ?? current.rows[0].slot_color);
    const allowed = ['status', 'guaranteed_pax', 'actual_pax', 'menu_package', 'pricing', 'gst_split', 'event_sub_type'];
    const sets = ['slot_color = $1'];
    const vals = [slotColor];
    let i = 2;

    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        sets.push(`${key} = $${i++}`);
        vals.push(key === 'pricing' || key === 'gst_split' ? JSON.stringify(req.body[key]) : req.body[key]);
      }
    }

    vals.push(id);
    const { rows } = await query(
      `UPDATE banquet_bookings
       SET ${sets.join(', ')}, updated_at = NOW()
       WHERE id = $${i}
       RETURNING *`,
      vals
    );
    res.json({ banquet_booking: rows[0] });
  }
);

router.get('/banquet-bookings', qv('property_id').optional().isInt(), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  let sql = `
    SELECT bb.*, v.name AS venue_name, vts.label AS slot_label, vts.session_kind
    FROM banquet_bookings bb
    JOIN venues v ON v.id = bb.venue_id
    LEFT JOIN venue_time_slots vts ON vts.id = bb.venue_slot_id
    WHERE 1 = 1`;
  const params = [];
  if (req.query.property_id) {
    const pid = Number(req.query.property_id);
    if (!assertPropertyAccess(req.user, pid)) {
      return res.status(403).json({ error: 'Property access denied' });
    }
    params.push(pid);
    sql += ` AND bb.property_id = $${params.length}`;
  } else if (!canAccessAllProperties(req.user.role)) {
    if (!req.user.propertyIds?.length) return res.json({ banquet_bookings: [] });
    params.push(req.user.propertyIds);
    sql += ` AND bb.property_id = ANY($${params.length}::int[])`;
  }
  sql += ` ORDER BY bb.event_date DESC, v.name ASC, vts.start_time ASC NULLS LAST LIMIT 300`;
  const { rows } = await query(sql, params);
  res.json({ banquet_bookings: rows });
});

export default router;
