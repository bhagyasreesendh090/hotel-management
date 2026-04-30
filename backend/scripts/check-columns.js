import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const res = await client.query(`
      SELECT table_name, column_name 
      FROM information_schema.columns 
      WHERE table_name IN ('quotations', 'contracts') 
      AND column_name = 'secure_token'
    `);
    console.log("Columns found:", res.rows);
  } finally {
    await client.end();
  }
}
main();
