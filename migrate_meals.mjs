import { pool } from './backend/src/db/pool.js';

async function run() {
  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS meal_plans (
      id                SERIAL PRIMARY KEY,
      property_id       INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
      name              VARCHAR(128) NOT NULL,
      code              VARCHAR(16) NOT NULL,
      description       TEXT,
      per_person_rate   NUMERIC(12,2) NOT NULL DEFAULT 0,
      included_meals    JSONB DEFAULT '[]',
      items             JSONB DEFAULT '[]',
      active            BOOLEAN NOT NULL DEFAULT TRUE,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (property_id, code)
    )`);
    console.log('Migrated meal_plans table successfully.');
  } catch (err) {
    console.error(err);
  } finally {
    process.exit();
  }
}

run();
