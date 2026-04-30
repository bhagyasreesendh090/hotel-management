import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationPath = path.join(__dirname, '..', 'sql', 'migrations', '20260430_property_document_logo.sql');

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('Set DATABASE_URL');
    process.exit(1);
  }

  const sql = fs.readFileSync(migrationPath, 'utf8');
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await client.query(sql);
    console.log('Property document logo migration applied.');
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
