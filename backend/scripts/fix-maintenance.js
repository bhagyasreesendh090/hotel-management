import fs from 'fs';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('Set DATABASE_URL');
    process.exit(1);
  }
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS venue_maintenance_blocks (
        id                SERIAL PRIMARY KEY,
        venue_id          INTEGER NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
        property_id       INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
        venue_slot_id     INTEGER REFERENCES venue_time_slots(id) ON DELETE CASCADE,
        block_date        DATE NOT NULL,
        reason            TEXT NOT NULL,
        created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    console.log('Fixed venue_maintenance_blocks table.');
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
