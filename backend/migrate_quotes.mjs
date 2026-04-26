import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({ connectionString: 'postgresql://postgres:admin@localhost:5432/pramod-hotel' });

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Drop existing constraints on quotations status to allow dynamic replacement
    await client.query(`
      ALTER TABLE quotations DROP CONSTRAINT IF EXISTS quotations_status_check;
    `);

    // 2. Extend the quotations table with new detailed fields
    await client.query(`
      ALTER TABLE quotations 
      ADD COLUMN IF NOT EXISTS secure_token UUID DEFAULT gen_random_uuid() UNIQUE,
      ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS total_amount NUMERIC(14,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(14,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(14,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS final_amount NUMERIC(14,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS valid_until TIMESTAMP,
      ADD COLUMN IF NOT EXISTS viewed_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
    `);

    // 3. Re-apply status constraint with all requested fields
    await client.query(`
      ALTER TABLE quotations 
      ADD CONSTRAINT quotations_status_check 
      CHECK (status IN ('draft','pending_approval','approved','sent','viewed','negotiation','accepted','rejected','expired','revised'));
    `);

    // 4. Create the comprehensive quotation_interactions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS quotation_interactions (
        id SERIAL PRIMARY KEY,
        quotation_id INTEGER NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
        sender_type VARCHAR(16) CHECK (sender_type IN ('client', 'agent')),
        message TEXT,
        is_internal BOOLEAN DEFAULT FALSE,
        attachment_url TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query('COMMIT');
    console.log('Quotation schema successfully updated!');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration crashed:', error);
  } finally {
    client.release();
    pool.end();
  }
}

run();
