import bcrypt from 'bcryptjs';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const categories = [
  { category: 'Standard', base: 4500 },
  { category: 'Deluxe', base: 6500 },
  { category: 'Premium', base: 8200 },
  { category: 'Suite', base: 12000 },
  { category: 'Service Apartment', base: 9500 },
];

/** Old DBs may still have users_role_check without gm / sales_agent — fix before seeding users */
async function syncUserRoleCheckConstraint(client) {
  await client.query(`UPDATE users SET role = 'gm' WHERE role = 'sales'`);
  await client.query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check`);
  await client.query(`
    ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN (
      'super_admin','gm','sales_agent',
      'branch_manager','sales_manager','sales_executive',
      'banquet_coordinator','front_desk','finance'
    ))
  `);
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('Set DATABASE_URL');
    process.exit(1);
  }
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await syncUserRoleCheckConstraint(client);

    const hash = await bcrypt.hash('Admin@123', 12);
    await client.query(
      `INSERT INTO users (email, password_hash, full_name, role)
       VALUES ('admin@hotelpramod.local', $1, 'Super Admin', 'super_admin')
       ON CONFLICT (email) DO NOTHING`,
      [hash]
    );
    await client.query(`DELETE FROM users WHERE email = 'sales@hotelpramod.local'`);

    for (const row of [
      ['gm@hotelpramod.local', 'Priya Nanda', 'gm'],
      ['agent@hotelpramod.local', 'Anita Das', 'sales_agent'],
    ]) {
      await client.query(
        `INSERT INTO users (email, password_hash, full_name, role)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name, role = EXCLUDED.role`,
        [row[0], hash, row[1], row[2]]
      );
    }

    const pwd = 'Admin@123';
    console.log('');
    console.log('========== Hotel Pramod — login credentials (after seed) ==========');
    console.log(`  Super Admin   admin@hotelpramod.local    / ${pwd}`);
    console.log(`  GM            gm@hotelpramod.local       / ${pwd}`);
    console.log(`  Sales Agent   agent@hotelpramod.local    / ${pwd}`);
    console.log('======================================================================');
    console.log('');

    const branches = [
      { code: 'HP01', name: 'Hotel Pramod — Central' },
      { code: 'HP02', name: 'Hotel Pramod — East' },
      { code: 'HP03', name: 'Hotel Pramod — West' },
      { code: 'HP04', name: 'Hotel Pramod — Airport' },
    ];

    for (const b of branches) {
      const p = await client.query(
        `INSERT INTO properties (code, name, gstin, cancellation_policy_default)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
         RETURNING id`,
        [b.code, b.name, '29ABCDE1234F1Z5', 'Standard cancellation as per property policy.']
      );
      const propertyId = p.rows[0].id;

      for (const c of categories) {
        const rt = await client.query(
          `INSERT INTO room_types (property_id, category, floor_wing, occupancy_max, base_rate_rbi, amenities)
           VALUES ($1, $2, 'Block A', 3, $3, '["WiFi","TV","AC"]'::jsonb)
           ON CONFLICT (property_id, category) DO UPDATE SET base_rate_rbi = EXCLUDED.base_rate_rbi
           RETURNING id`,
          [propertyId, c.category, c.base]
        );
        const rtId = rt.rows[0].id;
        for (let i = 1; i <= 5; i++) {
          const num = `${c.category.slice(0, 3).toUpperCase()}-${String(i).padStart(2, '0')}`;
          await client.query(
            `INSERT INTO rooms (property_id, room_type_id, room_number, status)
             VALUES ($1, $2, $3, 'available')
             ON CONFLICT (property_id, room_number) DO NOTHING`,
            [propertyId, rtId, num]
          );
        }
      }

      let vid;
      const vex = await client.query(
        `SELECT id FROM venues WHERE property_id = $1 AND name = 'Grand Ballroom'`,
        [propertyId]
      );
      if (vex.rows[0]) vid = vex.rows[0].id;
      else {
        const v = await client.query(
          `INSERT INTO venues (property_id, name, venue_type, capacity_min, capacity_max)
           VALUES ($1, 'Grand Ballroom', 'banquet_hall', 50, 400)
           RETURNING id`,
          [propertyId]
        );
        vid = v.rows[0]?.id;
      }
      if (vid) {
        const slots = [
          ['Morning', '09:00', '12:00', 'morning'],
          ['Afternoon', '12:30', '15:30', 'afternoon'],
          ['Evening', '19:00', '23:00', 'evening'],
        ];
        for (const [label, st, et, sk] of slots) {
          await client.query(
            `INSERT INTO venue_time_slots (property_id, venue_id, label, start_time, end_time, session_kind)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (venue_id, label) DO NOTHING`,
            [propertyId, vid, label, st, et, sk]
          );
        }
      }
    }

    console.log('Seed complete (properties, rooms, venues, demo users).');
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
