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

const defaultVenueSlots = [
  ['Morning', '09:00', '12:00', 'morning'],
  ['Afternoon', '12:30', '15:30', 'afternoon'],
  ['Evening', '19:00', '23:00', 'evening'],
  ['Full Day', '09:00', '23:00', 'full_day'],
];

const branches = [
  {
    code: 'CTK01',
    name: 'Pramod Convention & Club Resort (Cuttack)',
    venues: [
      { name: 'Emerald', venue_type: 'banquet_hall', capacity_min: 40, capacity_max: 250 },
      { name: 'Sapphire', venue_type: 'banquet_hall', capacity_min: 40, capacity_max: 250 },
      { name: 'Pearl', venue_type: 'banquet_hall', capacity_min: 40, capacity_max: 200 },
      { name: 'Jade', venue_type: 'banquet_hall', capacity_min: 30, capacity_max: 180 },
    ],
  },
  {
    code: 'PUR01',
    name: 'Pramod Convention & Beach Resort (Puri)',
    venues: [
      { name: 'Emerald', venue_type: 'banquet_hall', capacity_min: 40, capacity_max: 250 },
      { name: 'Lawn', venue_type: 'lawn', capacity_min: 80, capacity_max: 500 },
    ],
  },
  {
    code: 'LEP01',
    name: 'Pramod Lands End Resort (Gopalpur)',
    venues: [
      { name: 'Fortress Hall', venue_type: 'banquet_hall', capacity_min: 50, capacity_max: 300 },
      { name: 'Upper Lawn', venue_type: 'lawn', capacity_min: 80, capacity_max: 500 },
      { name: 'Lower Lawn', venue_type: 'lawn', capacity_min: 80, capacity_max: 500 },
      { name: 'Clifftop Roof', venue_type: 'terrace', capacity_min: 30, capacity_max: 150 },
      { name: 'Pier Hall', venue_type: 'banquet_hall', capacity_min: 40, capacity_max: 220 },
    ],
  },
];

/** Old DBs may still have users_role_check without gm / sales_agent. Fix before seeding users. */
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

async function upsertVenue(client, propertyId, venue) {
  const existingVenue = await client.query(
    `SELECT id FROM venues WHERE property_id = $1 AND name = $2`,
    [propertyId, venue.name]
  );

  if (existingVenue.rows[0]) {
    const venueId = existingVenue.rows[0].id;
    await client.query(
      `UPDATE venues
       SET venue_type = $2, capacity_min = $3, capacity_max = $4
       WHERE id = $1`,
      [venueId, venue.venue_type, venue.capacity_min, venue.capacity_max]
    );
    return venueId;
  }

  const insertedVenue = await client.query(
    `INSERT INTO venues (property_id, name, venue_type, capacity_min, capacity_max)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [propertyId, venue.name, venue.venue_type, venue.capacity_min, venue.capacity_max]
  );
  return insertedVenue.rows[0]?.id;
}

async function seedVenueSlots(client, propertyId, venueId) {
  for (const [label, startTime, endTime, sessionKind] of defaultVenueSlots) {
    await client.query(
      `INSERT INTO venue_time_slots (property_id, venue_id, label, start_time, end_time, session_kind)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (venue_id, label) DO NOTHING`,
      [propertyId, venueId, label, startTime, endTime, sessionKind]
    );
  }
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
    console.log('========== Hotel Pramod - login credentials (after seed) ==========');
    console.log(`  Super Admin   admin@hotelpramod.local    / ${pwd}`);
    console.log(`  GM            gm@hotelpramod.local       / ${pwd}`);
    console.log(`  Sales Agent   agent@hotelpramod.local    / ${pwd}`);
    console.log('====================================================================');
    console.log('');

    for (const branch of branches) {
      const property = await client.query(
        `INSERT INTO properties (code, name, gstin, cancellation_policy_default)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
         RETURNING id`,
        [branch.code, branch.name, '29ABCDE1234F1Z5', 'Standard cancellation as per property policy.']
      );
      const propertyId = property.rows[0].id;

      for (const category of categories) {
        const roomType = await client.query(
          `INSERT INTO room_types (property_id, category, floor_wing, occupancy_max, base_rate_rbi, amenities)
           VALUES ($1, $2, 'Block A', 3, $3, '["WiFi","TV","AC"]'::jsonb)
           ON CONFLICT (property_id, category) DO UPDATE SET base_rate_rbi = EXCLUDED.base_rate_rbi
           RETURNING id`,
          [propertyId, category.category, category.base]
        );
        const roomTypeId = roomType.rows[0].id;

        for (let i = 1; i <= 5; i += 1) {
          const roomNumber = `${category.category.slice(0, 3).toUpperCase()}-${String(i).padStart(2, '0')}`;
          await client.query(
            `INSERT INTO rooms (property_id, room_type_id, room_number, status)
             VALUES ($1, $2, $3, 'available')
             ON CONFLICT (property_id, room_number) DO NOTHING`,
            [propertyId, roomTypeId, roomNumber]
          );
        }
      }

      for (const venue of branch.venues) {
        const venueId = await upsertVenue(client, propertyId, venue);
        if (venueId) {
          await seedVenueSlots(client, propertyId, venueId);
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
