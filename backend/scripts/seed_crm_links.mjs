import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get basic data
    const userRes = await client.query(`SELECT id FROM users WHERE role = 'super_admin' LIMIT 1`);
    const userId = userRes.rows[0]?.id;

    const propRes = await client.query(`SELECT id, code FROM properties LIMIT 1`);
    const propertyId = propRes.rows[0]?.id;
    const propertyCode = propRes.rows[0]?.code;

    const rtRes = await client.query(`SELECT id FROM room_types WHERE property_id = $1 LIMIT 1`, [propertyId]);
    const roomTypeId = rtRes.rows[0]?.id;

    const vRes = await client.query(`SELECT id FROM venues WHERE property_id = $1 LIMIT 1`, [propertyId]);
    const venueId = vRes.rows[0]?.id;

    const vsRes = await client.query(`SELECT id FROM venue_time_slots WHERE venue_id = $1 LIMIT 1`, [venueId]);
    const slotId = vsRes.rows[0]?.id;

    if (!userId || !propertyId || !roomTypeId || !venueId || !slotId) {
      throw new Error('Missing base data required to seed test records.');
    }

    console.log('1. Creating a Room Booking...');
    const bRes = await client.query(
      `INSERT INTO bookings (property_id, status, guest_name, created_by, ds_number)
       VALUES ($1, 'QTN-HOLD', 'Test Room Guest', $2, 'TEST-DS-001') RETURNING id`,
      [propertyId, userId]
    );
    const bookingId = bRes.rows[0].id;

    await client.query(
      `INSERT INTO booking_room_lines (booking_id, room_type_id, check_in, check_out, meal_plan, rate_type, nightly_rate)
       VALUES ($1, $2, CURRENT_DATE, CURRENT_DATE + 2, 'CP', 'RBI', 5000)`,
      [bookingId, roomTypeId]
    );

    console.log('2. Creating a Quotation for the Room Booking...');
    const qRes = await client.query(
      `INSERT INTO quotations (property_id, quotation_number, status, created_by, total_amount, booking_id)
       VALUES ($1, $2, 'sent', $3, 10500, $4) RETURNING id`,
      [propertyId, `${propertyCode}-Q-TEST-001`, userId, bookingId]
    );
    
    console.log('3. Creating a Banquet Booking...');
    const bbRes = await client.query(
      `INSERT INTO banquet_bookings (property_id, venue_id, event_date, venue_slot_id, event_category, status, slot_color)
       VALUES ($1, $2, CURRENT_DATE + 5, $3, 'social', 'TENT', 'amber') RETURNING id`,
      [propertyId, venueId, slotId]
    );
    const banquetBookingId = bbRes.rows[0].id;

    console.log('4. Creating a Contract for the Banquet Booking...');
    await client.query(
      `INSERT INTO contracts (property_id, status, updated_by, banquet_booking_id, contract_number, total_value)
       VALUES ($1, 'draft', $2, $3, $4, 50000) RETURNING id`,
      [propertyId, userId, banquetBookingId, `${propertyCode}-CON-TEST-001`]
    );

    await client.query('COMMIT');
    console.log('Successfully added a Quotation for the Room Booking and a Contract for the Banquet Booking!');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error(e);
  } finally {
    client.release();
    pool.end();
  }
}

seed();
