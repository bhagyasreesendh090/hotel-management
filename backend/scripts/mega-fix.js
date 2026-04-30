import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    console.log("Checking and fixing schema...");
    
    // Ensure pgcrypto for gen_random_uuid
    await client.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');

    // Ensure columns exist in quotations
    await client.query(`
      ALTER TABLE quotations 
      ADD COLUMN IF NOT EXISTS secure_token UUID DEFAULT gen_random_uuid(),
      ADD COLUMN IF NOT EXISTS valid_until DATE,
      ADD COLUMN IF NOT EXISTS total_amount NUMERIC(12,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(12,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(12,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS final_amount NUMERIC(12,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS viewed_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0
    `);

    // Ensure columns exist in contracts
    await client.query(`
      ALTER TABLE contracts
      ADD COLUMN IF NOT EXISTS secure_token UUID DEFAULT gen_random_uuid(),
      ADD COLUMN IF NOT EXISTS property_id INTEGER REFERENCES properties(id),
      ADD COLUMN IF NOT EXISTS contract_number VARCHAR(64),
      ADD COLUMN IF NOT EXISTS status VARCHAR(24) DEFAULT 'draft',
      ADD COLUMN IF NOT EXISTS total_value NUMERIC(12,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS updated_by INTEGER REFERENCES users(id),
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS viewed_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0
    `);

    // Ensure interaction tables exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS quotation_interactions (
        id                SERIAL PRIMARY KEY,
        quotation_id      INTEGER NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
        sender_type       VARCHAR(50) NOT NULL,
        message           TEXT NOT NULL,
        is_internal       BOOLEAN DEFAULT FALSE,
        created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      
      CREATE TABLE IF NOT EXISTS contract_interactions (
        id                SERIAL PRIMARY KEY,
        contract_id       INTEGER NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
        sender_type       VARCHAR(50) NOT NULL,
        message           TEXT NOT NULL,
        is_internal       BOOLEAN DEFAULT FALSE,
        created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    console.log("Schema fixed successfully.");
  } catch (err) {
    console.error("Error fixing schema:", err);
  } finally {
    await client.end();
  }
}
main();
