import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function migrateContracts() {
  const client = await pool.connect();
  try {
    console.log('Starting contracts migration...');
    await client.query('BEGIN');

    // 1. Alter contracts schema to support statuses, numbers, and tokens
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'contract_status') THEN
          CREATE TYPE contract_status AS ENUM (
            'draft', 'pending_approval', 'approved', 'sent', 'viewed', 'negotiation', 'accepted', 'rejected', 'expired'
          );
        END IF;
      END
      $$;
    `);

    await client.query(`
      ALTER TABLE contracts
      ADD COLUMN IF NOT EXISTS property_id INTEGER REFERENCES properties(id) ON DELETE CASCADE,
      ADD COLUMN IF NOT EXISTS contract_number VARCHAR(100),
      ADD COLUMN IF NOT EXISTS status contract_status NOT NULL DEFAULT 'draft',
      ADD COLUMN IF NOT EXISTS secure_token UUID UNIQUE DEFAULT gen_random_uuid(),
      ADD COLUMN IF NOT EXISTS total_value NUMERIC(15, 2) DEFAULT 0.00,
      ADD COLUMN IF NOT EXISTS view_count INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS viewed_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    `);

    // Ensure we create an interactions table just like quotes!
    await client.query(`
      CREATE TABLE IF NOT EXISTS contract_interactions (
        id                SERIAL PRIMARY KEY,
        contract_id       INTEGER NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
        sender_type       VARCHAR(16) NOT NULL CHECK (sender_type IN ('agent', 'client', 'system')),
        message           TEXT NOT NULL,
        is_internal       BOOLEAN NOT NULL DEFAULT FALSE,
        attachment_url    TEXT,
        created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // Ensure we create a versions table just like quotes!
    await client.query(`
      CREATE TABLE IF NOT EXISTS contract_versions (
        id                SERIAL PRIMARY KEY,
        contract_id       INTEGER NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
        version           INTEGER NOT NULL DEFAULT 1,
        snapshot          JSONB NOT NULL,
        created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query('COMMIT');
    console.log('Contracts Migration completed successfully!');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', e);
  } finally {
    client.release();
    pool.end();
  }
}

migrateContracts();
