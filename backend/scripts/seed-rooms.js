import bcrypt from 'bcryptjs';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

async function upsertProperty(client, { code, name, gstin, cancellation_policy_default }) {
  const r = await client.query(
    `INSERT INTO properties (code, name, gstin, cancellation_policy_default)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (code)
     DO UPDATE SET name = EXCLUDED.name
     RETURNING id`,
    [code, name, gstin ?? null, cancellation_policy_default ?? null]
  );
  return r.rows[0].id;
}

function makeRooms(roomTypeCodePrefix, count) {
  const rooms = [];
  for (let i = 1; i <= count; i++) {
    rooms.push({
      room_number: `${roomTypeCodePrefix}-${String(i).padStart(2, '0')}`,
    });
  }
  return rooms;
}

async function upsertRoomTypes(client, propertyId, roomTypes) {
  // Upsert by (property_id, category)
  const inserted = [];
  for (const rt of roomTypes) {
    const r = await client.query(
      `INSERT INTO room_types (
        property_id, category, floor_wing, occupancy_max,
        base_rate_rbi, gst_rate_override, add_on_options, amenities, extra_person_charge
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      ON CONFLICT (property_id, category)
      DO UPDATE SET occupancy_max = EXCLUDED.occupancy_max, base_rate_rbi = EXCLUDED.base_rate_rbi, gst_rate_override = EXCLUDED.gst_rate_override
      RETURNING id`,
      [
        propertyId,
        rt.category,
        rt.floor_wing ?? 'Block A',
        rt.pax,
        rt.base_rate_rbi,
        rt.gst_rate_override ?? null,
        JSON.stringify(rt.add_on_options ?? []),
        JSON.stringify(rt.amenities ?? ['WiFi', 'TV', 'AC']),
        rt.extra_person_charge ?? 0,
      ]
    );
    inserted.push({ id: r.rows[0].id, roomTypeCodePrefix: rt.codePrefix, pax: rt.pax, category: rt.category, count: rt.count });
  }
  return inserted;
}

async function insertRoomsForTypes(client, propertyId, roomTypeRows) {
  for (const rt of roomTypeRows) {
    const rooms = makeRooms(rt.roomTypeCodePrefix, rt.count);
    for (const room of rooms) {
      await client.query(
        `INSERT INTO rooms (property_id, room_type_id, room_number, status)
         VALUES ($1,$2,$3,'available')
         ON CONFLICT (property_id, room_number) DO NOTHING`,
        [propertyId, rt.id, room.room_number]
      );
    }
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

  // Based on the screenshot you shared:
  // - Lands End Resort (Gopalpur)
  // - Convention & Beach Resort (Puri)
  // - Convention & Club Resort (Cuttack)
  //
  // If any room-counts are different from your sheet, tell me and I will adjust the `count` values.
  const branches = [
    {
      code: 'LEP01',
      name: 'Pramod Lands End Resort (Gopalpur)',
      gstin: '29ABCDE1234F1Z5',
      roomTypes: [
        { category: 'Superior Room', pax: 2, count: 57, codePrefix: 'SUP', base_rate_rbi: 9000 },
        { category: 'Deluxe Room', pax: 2, count: 24, codePrefix: 'DLX', base_rate_rbi: 10000 },
        { category: 'Family room', pax: 4, count: 7, codePrefix: 'FAM', base_rate_rbi: 13000 },
        { category: 'Premium room', pax: 2, count: 4, codePrefix: 'PRM', base_rate_rbi: 12000 },
        { category: 'Premium Suite', pax: 4, count: 2, codePrefix: 'PMS', base_rate_rbi: 18000 },
        { category: 'Royal Villa', pax: 2, count: 1, codePrefix: 'RVL', base_rate_rbi: 22000 },
        { category: 'Grand Villa', pax: 4, count: 1, codePrefix: 'GVL', base_rate_rbi: 28000 },
      ],
    },
    {
      code: 'PUR01',
      name: 'Pramod Convention & Beach Resort (Puri)',
      gstin: '29ABCDE1234F1Z5',
      roomTypes: [
        { category: 'Queens Court', pax: 2, count: 16, codePrefix: 'QUE', base_rate_rbi: 9500 },
        { category: 'Kings Court', pax: 2, count: 8, codePrefix: 'KIN', base_rate_rbi: 10500 },
        { category: 'Family room', pax: 3, count: 3, codePrefix: 'FAM', base_rate_rbi: 13500 },
        { category: 'Family Exe. Room', pax: 3, count: 3, codePrefix: 'FEX', base_rate_rbi: 15500 },
      ],
    },
    {
      code: 'CTK01',
      name: 'Pramod Convention & Club Resort (Cuttack)',
      gstin: '29ABCDE1234F1Z5',
      roomTypes: [
        { category: 'Queens Court', pax: 2, count: 16, codePrefix: 'QUE', base_rate_rbi: 9500 },
        { category: 'Kings Court', pax: 2, count: 12, codePrefix: 'KIN', base_rate_rbi: 10500 },
        { category: 'Family room', pax: 3, count: 3, codePrefix: 'FAM', base_rate_rbi: 13500 },
        { category: 'Family Exe. Room', pax: 3, count: 3, codePrefix: 'FEX', base_rate_rbi: 15500 },
      ],
    },
  ];

  try {
    await client.query('BEGIN');

    for (const b of branches) {
      const propertyId = await upsertProperty(client, {
        code: b.code,
        name: b.name,
        gstin: b.gstin,
        cancellation_policy_default: 'Standard cancellation as per property policy.',
      });

      const roomTypeRows = await upsertRoomTypes(client, propertyId, b.roomTypes);

      // Attach room ids to inserted arrays for room creation
      // `upsertRoomTypes` returned includes `id` and `count`, so we can create rooms now.
      await insertRoomsForTypes(client, propertyId, roomTypeRows);
    }

    await client.query('COMMIT');
    console.log('Rooms seeder complete (properties, room_types, rooms inserted).');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error(e);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

