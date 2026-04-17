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
      SELECT id, category, base_rate_rbi, occupancy_max
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
    blocks_merged AS (
      SELECT room_type_id, SUM(n)::int AS blocked_units
      FROM (
        SELECT * FROM type_blocks
        UNION ALL
        SELECT * FROM room_blocks_by_type
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
