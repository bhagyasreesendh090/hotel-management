import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('Adding booking links to quotations and contracts...');
    await client.query('BEGIN');

    // Add booking_id and banquet_booking_id to quotations
    await client.query(`
      ALTER TABLE quotations 
      ADD COLUMN IF NOT EXISTS booking_id INTEGER REFERENCES bookings(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS banquet_booking_id INTEGER REFERENCES banquet_bookings(id) ON DELETE SET NULL;
    `);

    // Add banquet_booking_id to contracts (it already has booking_id)
    await client.query(`
      ALTER TABLE contracts 
      ADD COLUMN IF NOT EXISTS banquet_booking_id INTEGER REFERENCES banquet_bookings(id) ON DELETE SET NULL;
    `);

    await client.query('COMMIT');
    console.log('Migration successfully completed!');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', e);
  } finally {
    client.release();
    pool.end();
  }
}

migrate();
