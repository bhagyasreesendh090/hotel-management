import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function migrate() {
  console.log('Starting CRM schema migration...');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Ensure pgcrypto for gen_random_uuid() if not already available
    await client.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');

    // Quotations table updates
    console.log('Updating quotations table...');
    await client.query(`
      ALTER TABLE quotations 
      ADD COLUMN IF NOT EXISTS valid_until DATE,
      ADD COLUMN IF NOT EXISTS secure_token UUID DEFAULT gen_random_uuid(),
      ADD COLUMN IF NOT EXISTS total_amount NUMERIC(14,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(14,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(14,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS final_amount NUMERIC(14,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS approved_by INTEGER REFERENCES users(id),
      ADD COLUMN IF NOT EXISTS updated_by INTEGER REFERENCES users(id),
      ADD COLUMN IF NOT EXISTS viewed_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0;
    `);

    // Contracts table updates
    console.log('Updating contracts table...');
    await client.query(`
      ALTER TABLE contracts 
      ADD COLUMN IF NOT EXISTS property_id INTEGER REFERENCES properties(id),
      ADD COLUMN IF NOT EXISTS secure_token UUID DEFAULT gen_random_uuid(),
      ADD COLUMN IF NOT EXISTS status VARCHAR(24) DEFAULT 'draft',
      ADD COLUMN IF NOT EXISTS total_value NUMERIC(14,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS updated_by INTEGER REFERENCES users(id),
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS viewed_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS contract_number VARCHAR(64);
    `);

    // New Tables
    console.log('Creating contract_versions table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS contract_versions (
        id SERIAL PRIMARY KEY,
        contract_id INTEGER NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
        version INTEGER NOT NULL,
        snapshot JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (contract_id, version)
      );
    `);

    console.log('Creating interaction tables...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS quotation_interactions (
        id SERIAL PRIMARY KEY,
        quotation_id INTEGER NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
        sender_type VARCHAR(16) CHECK (sender_type IN ('agent', 'client')),
        message TEXT NOT NULL,
        is_internal BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS contract_interactions (
        id SERIAL PRIMARY KEY,
        contract_id INTEGER NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
        sender_type VARCHAR(16) CHECK (sender_type IN ('agent', 'client')),
        message TEXT NOT NULL,
        is_internal BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query('COMMIT');
    console.log('Migration completed successfully.');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', e);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
