import fs from 'fs';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  const url = process.env.DATABASE_URL;
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
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
    console.log('Fixed interaction tables.');
  } finally {
    await client.end();
  }
}

main();
