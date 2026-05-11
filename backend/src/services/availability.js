import { query } from '../db/pool.js';

const BLOCKING_BOOKING_STATUSES = `('QTN-HOLD','TENT','CONF-U','CONF-P','CI')`;

/**
 * Per room type: total rooms (status available) minus overlapping booking lines and blocks.
 * Checkout date is exclusive vs range end for overlap.
 */
export async function availabilityByRoomType(propertyId, rangeStart, rangeEnd) {
  const pid = Number(propertyId);
  const { rows } = await query(
    `
    WITH rt AS (
      SELECT id, category, base_rate_rbi, occupancy_max, add_on_options
      FROM room_types
      WHERE property_id = $1 AND active = TRUE
    ),
    room_counts AS (
      SELECT room_type_id, COUNT(*)::int AS total
      FROM rooms
      WHERE property_id = $1 AND status = 'available'
      GROUP BY room_type_id
    ),
    type_blocks AS (
      SELECT room_type_id, COUNT(*)::int AS n
      FROM room_blocks
      WHERE property_id = $1
        AND room_type_id IS NOT NULL
        AND start_date < $3::date AND end_date >= $2::date
      GROUP BY room_type_id
    ),
    room_blocks_by_type AS (
      SELECT r.room_type_id, COUNT(DISTINCT rb.id)::int AS n
      FROM room_blocks rb
      JOIN rooms r ON r.id = rb.room_id AND r.property_id = $1
      WHERE rb.property_id = $1
        AND rb.start_date < $3::date AND rb.end_date >= $2::date
      GROUP BY r.room_type_id
    ),
    banquet_blocks AS (
      SELECT 
        (pricing->'room_block'->>'room_type_id')::int AS room_type_id,
        SUM((pricing->'room_block'->>'room_count')::int)::int AS units
      FROM banquet_bookings
      WHERE property_id = $1
        AND status IN ('QTN-HOLD','TENT','CONF-U','CONF-P')
        AND event_date < $3::date AND event_date >= $2::date
        AND pricing->'room_block'->>'room_type_id' IS NOT NULL
      GROUP BY 1
    ),
    blocks_merged AS (
      SELECT room_type_id, SUM(n)::int AS blocked_units
      FROM (
        SELECT room_type_id, n FROM type_blocks
        UNION ALL
        SELECT room_type_id, n FROM room_blocks_by_type
        UNION ALL
        SELECT room_type_id, units FROM banquet_blocks
      ) u
      GROUP BY room_type_id
    ),
    booked AS (
      SELECT brl.room_type_id, COUNT(*)::int AS booked_units
      FROM booking_room_lines brl
      JOIN bookings b ON b.id = brl.booking_id
      WHERE b.property_id = $1
        AND b.status IN ${BLOCKING_BOOKING_STATUSES}
        AND brl.check_in < $3::date AND brl.check_out > $2::date
      GROUP BY brl.room_type_id
    )
    SELECT rt.id AS room_type_id,
           rt.category,
           rt.base_rate_rbi,
      rt.occupancy_max,
      rt.add_on_options,
      COALESCE(rc.total, 0) AS total_rooms,
           COALESCE(bk.booked_units, 0) AS booked_units,
           COALESCE(bm.blocked_units, 0) AS blocked_units,
           GREATEST(
             COALESCE(rc.total, 0) - COALESCE(bk.booked_units, 0) - COALESCE(bm.blocked_units, 0),
             0
           ) AS available_units
    FROM rt
    LEFT JOIN room_counts rc ON rc.room_type_id = rt.id
    LEFT JOIN booked bk ON bk.room_type_id = rt.id
    LEFT JOIN blocks_merged bm ON bm.room_type_id = rt.id
    ORDER BY rt.category
    `,
    [pid, rangeStart, rangeEnd]
  );
  return rows;
}

export async function availabilityCalendarByRoomType(propertyId, rangeStart, rangeEnd) {
  const pid = Number(propertyId);
  const { rows } = await query(
    `
    WITH days AS (
      SELECT generate_series($2::date, $3::date, interval '1 day')::date AS day
    ),
    rt AS (
      SELECT id, category, base_rate_rbi, occupancy_max, add_on_options
      FROM room_types
      WHERE property_id = $1 AND active = TRUE
    ),
    room_counts AS (
      SELECT room_type_id, COUNT(*)::int AS total
      FROM rooms
      WHERE property_id = $1 AND status = 'available'
      GROUP BY room_type_id
    ),
    booked AS (
      SELECT
        brl.room_type_id,
        d.day,
        COUNT(*)::int AS booked_units
      FROM booking_room_lines brl
      JOIN bookings b ON b.id = brl.booking_id
      JOIN days d ON brl.check_in <= d.day AND brl.check_out > d.day
      WHERE b.property_id = $1
        AND b.status IN ${BLOCKING_BOOKING_STATUSES}
      GROUP BY brl.room_type_id, d.day
    ),
    type_blocks AS (
      SELECT
        rb.room_type_id,
        d.day,
        COUNT(*)::int AS blocked_units
      FROM room_blocks rb
      JOIN days d ON rb.start_date <= d.day AND rb.end_date >= d.day
      WHERE rb.property_id = $1
        AND rb.room_type_id IS NOT NULL
      GROUP BY rb.room_type_id, d.day
    ),
    room_blocks_by_type AS (
      SELECT
        r.room_type_id,
        d.day,
        COUNT(DISTINCT rb.id)::int AS blocked_units
      FROM room_blocks rb
      JOIN rooms r ON r.id = rb.room_id AND r.property_id = $1
      JOIN days d ON rb.start_date <= d.day AND rb.end_date >= d.day
      WHERE rb.property_id = $1
      GROUP BY r.room_type_id, d.day
    ),
    banquet_blocks AS (
      SELECT
        (bb.pricing->'room_block'->>'room_type_id')::int AS room_type_id,
        d.day,
        SUM((bb.pricing->'room_block'->>'room_count')::int)::int AS units
      FROM banquet_bookings bb
      JOIN days d ON bb.event_date = d.day
      WHERE bb.property_id = $1
        AND bb.status IN ('QTN-HOLD','TENT','CONF-U','CONF-P')
        AND bb.pricing->'room_block'->>'room_type_id' IS NOT NULL
      GROUP BY 1, 2
    ),
    blocks AS (
      SELECT room_type_id, day, SUM(blocked_units)::int AS blocked_units
      FROM (
        SELECT room_type_id, day, blocked_units FROM type_blocks
        UNION ALL
        SELECT room_type_id, day, blocked_units FROM room_blocks_by_type
        UNION ALL
        SELECT room_type_id, day, units FROM banquet_blocks
      ) merged
      GROUP BY room_type_id, day
    )
    SELECT
      d.day,
      rt.id AS room_type_id,
      rt.category,
      rt.base_rate_rbi,
           rt.occupancy_max,
           rt.add_on_options,
           COALESCE(rc.total, 0) AS total_rooms,
      COALESCE(bk.booked_units, 0) AS booked_units,
      COALESCE(bl.blocked_units, 0) AS blocked_units,
      GREATEST(
        COALESCE(rc.total, 0) - COALESCE(bk.booked_units, 0) - COALESCE(bl.blocked_units, 0),
        0
      )::int AS available_units
    FROM days d
    CROSS JOIN rt
    LEFT JOIN room_counts rc ON rc.room_type_id = rt.id
    LEFT JOIN booked bk ON bk.room_type_id = rt.id AND bk.day = d.day
    LEFT JOIN blocks bl ON bl.room_type_id = rt.id AND bl.day = d.day
    ORDER BY rt.category, d.day
    `,
    [pid, rangeStart, rangeEnd]
  );
  return rows;
}

export async function roomTypeMinimumAvailability(propertyId, roomTypeId, rangeStart, rangeEnd) {
  const pid = Number(propertyId);
  const rtId = Number(roomTypeId);
  const { rows } = await query(
    `
    WITH days AS (
      SELECT generate_series($3::date, ($4::date - interval '1 day')::date, interval '1 day')::date AS day
    ),
    room_counts AS (
      SELECT COUNT(*)::int AS total
      FROM rooms
      WHERE property_id = $1
        AND room_type_id = $2
        AND status = 'available'
    ),
    booked AS (
      SELECT
        d.day,
        COUNT(*)::int AS booked_units
      FROM booking_room_lines brl
      JOIN bookings b ON b.id = brl.booking_id
      JOIN days d ON brl.check_in <= d.day AND brl.check_out > d.day
      WHERE b.property_id = $1
        AND brl.room_type_id = $2
        AND b.status IN ${BLOCKING_BOOKING_STATUSES}
      GROUP BY d.day
    ),
    type_blocks AS (
      SELECT
        d.day,
        COUNT(*)::int AS blocked_units
      FROM room_blocks rb
      JOIN days d ON rb.start_date <= d.day AND rb.end_date >= d.day
      WHERE rb.property_id = $1
        AND rb.room_type_id = $2
      GROUP BY d.day
    ),
    room_blocks_by_type AS (
      SELECT
        d.day,
        COUNT(DISTINCT rb.id)::int AS blocked_units
      FROM room_blocks rb
      JOIN rooms r ON r.id = rb.room_id
      JOIN days d ON rb.start_date <= d.day AND rb.end_date >= d.day
      WHERE rb.property_id = $1
        AND r.property_id = $1
        AND r.room_type_id = $2
      GROUP BY d.day
    ),
    banquet_blocks AS (
      SELECT
        d.day,
        SUM((bb.pricing->'room_block'->>'room_count')::int)::int AS units
      FROM banquet_bookings bb
      JOIN days d ON bb.event_date = d.day
      WHERE bb.property_id = $1
        AND (bb.pricing->'room_block'->>'room_type_id')::int = $2
        AND bb.status IN ('QTN-HOLD','TENT','CONF-U','CONF-P')
      GROUP BY d.day
    ),
    blocks AS (
      SELECT day, SUM(blocked_units)::int AS blocked_units
      FROM (
        SELECT day, blocked_units FROM type_blocks
        UNION ALL
        SELECT day, blocked_units FROM room_blocks_by_type
        UNION ALL
        SELECT day, units FROM banquet_blocks
      ) merged
      GROUP BY day
    )
    SELECT COALESCE(
      MIN(
        GREATEST(
          COALESCE((SELECT total FROM room_counts), 0)
            - COALESCE(booked.booked_units, 0)
            - COALESCE(blocks.blocked_units, 0),
          0
        )
      ),
      COALESCE((SELECT total FROM room_counts), 0)
    )::int AS min_available
    FROM days
    LEFT JOIN booked ON booked.day = days.day
    LEFT JOIN blocks ON blocks.day = days.day
    `,
    [pid, rtId, rangeStart, rangeEnd]
  );
  return Number(rows[0]?.min_available ?? 0);
}
