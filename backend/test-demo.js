import { pool } from './src/db/pool.js';

async function test() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query('SELECT id, lead_id, final_amount FROM quotations ORDER BY id DESC LIMIT 1');
    const quote = rows[0];
    const payAmount = Number(quote.final_amount);
    
    console.log('Testing with quote', quote.id, 'lead', quote.lead_id, 'amount', payAmount);
    
    const bookings = await client.query('SELECT id, advance_received, total_amount, status FROM bookings WHERE lead_id = $1', [quote.lead_id]);
    console.log('Bookings:', bookings.rows);
    
    for (const b of bookings.rows) {
      if (b.status === 'TENT') {
         console.log('Would update booking', b.id);
         const newAdvance = Number(b.advance_received ?? 0) + payAmount;
         await client.query('UPDATE bookings SET advance_received = $1, status = $2, updated_at = NOW() WHERE id = $3', [newAdvance, 'CONF-P', b.id]);
         await client.query('INSERT INTO payments (booking_id, amount, mode, payment_type, reference, recorded_by) VALUES ($1, $2, \'card\', \'advance\', \'DEMO_WEB_PAY\', NULL)', [b.id, payAmount]);
      }
    }
    console.log('SUCCESS');
    await client.query('ROLLBACK');
  } catch(e) {
    console.error('ERROR:', e);
    await client.query('ROLLBACK');
  } finally {
    client.release();
    process.exit(0);
  }
}

test();
