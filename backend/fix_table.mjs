import { Pool } from 'pg';
const pool = new Pool({ connectionString: 'postgresql://postgres:admin@localhost:5432/pramod-hotel' });

async function fix() {
  await pool.query(`CREATE TABLE IF NOT EXISTS venue_maintenance_blocks (
    id SERIAL PRIMARY KEY,
    venue_id INT NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
    property_id INT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    venue_slot_id INT REFERENCES venue_time_slots(id) ON DELETE SET NULL,
    block_date DATE NOT NULL,
    reason TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  )`);
  console.log("Table created successfully");
  await pool.end();
}

fix().catch(e => {
  console.error(e);
  pool.end();
});
