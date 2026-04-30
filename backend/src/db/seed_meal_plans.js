/**
 * seed_meal_plans.js
 * ─────────────────────────────────────────────────────────────────
 * Seeds the 4 standard hotel meal plans for every property.
 *
 *  EP  – European Plan        (Room only – no meals)
 *  CP  – Continental Plan     (Breakfast included)
 *  MAP – Modified American Plan (Breakfast + Dinner)
 *  AP  – American Plan        (All 3 meals: Breakfast + Lunch + Dinner)
 *
 * Safe to re-run – skips any plan whose (property_id + code) already exists.
 *
 * Run:
 *   node --experimental-vm-modules src/db/seed_meal_plans.js
 * ─────────────────────────────────────────────────────────────────
 */

import pg from 'pg';
import { config } from '../config.js';

const { Pool } = pg;
const pool = new Pool({ connectionString: config.databaseUrl });

/* ── Meal plan definitions ──────────────────────────────────────── */
const MEAL_PLANS = [
  {
    code: 'EP',
    name: 'European Plan',
    description: 'Room only – no meals included. Guest pays separately for all food and beverage.',
    per_person_rate: '0',
    included_meals: [],
    items: ['Room accommodation only'],
  },
  {
    code: 'CP',
    name: 'Continental Plan',
    description: 'Bed & Breakfast. Includes a continental breakfast (tea/coffee, toast, juice, cereals).',
    per_person_rate: '350',
    included_meals: ['breakfast'],
    items: [
      'Tea or Coffee',
      'Fresh Fruit Juice',
      'Toast with Butter & Jam',
      'Cereals / Cornflakes',
      'Boiled Egg',
    ],
  },
  {
    code: 'MAP',
    name: 'Modified American Plan',
    description: 'Bed, Breakfast & Dinner. Two meals per day – morning and evening.',
    per_person_rate: '750',
    included_meals: ['breakfast', 'dinner'],
    items: [
      'Full Indian / English Breakfast',
      'Evening 3-Course Dinner',
      'Soup + Main Course + Dessert',
      'Choice of Veg or Non-Veg',
    ],
  },
  {
    code: 'AP',
    name: 'American Plan',
    description: 'Full board. All three meals (Breakfast, Lunch, and Dinner) included in the tariff.',
    per_person_rate: '1200',
    included_meals: ['breakfast', 'lunch', 'dinner'],
    items: [
      'Full Indian / English Breakfast',
      'Buffet Lunch (Veg + Non-Veg)',
      'À la carte / Buffet Dinner',
      'Evening Tea / Snacks',
      'Complimentary Mocktail on arrival',
    ],
  },
];

/* ── Helpers ────────────────────────────────────────────────────── */
async function getProperties(client) {
  const { rows } = await client.query(
    `SELECT id, name FROM properties WHERE active = TRUE ORDER BY id`
  );
  return rows;
}

async function planExists(client, propertyId, code) {
  const { rows } = await client.query(
    `SELECT id FROM meal_plans WHERE property_id = $1 AND code = $2 AND active = TRUE`,
    [propertyId, code]
  );
  return rows.length > 0;
}

async function insertPlan(client, propertyId, plan) {
  await client.query(
    `INSERT INTO meal_plans
       (property_id, name, code, description, per_person_rate, included_meals, items, active)
     VALUES ($1,$2,$3,$4,$5,$6,$7, TRUE)`,
    [
      propertyId,
      plan.name,
      plan.code,
      plan.description,
      plan.per_person_rate,
      JSON.stringify(plan.included_meals),
      JSON.stringify(plan.items),
    ]
  );
}

/* ── Main ───────────────────────────────────────────────────────── */
async function seed() {
  const client = await pool.connect();
  try {
    const properties = await getProperties(client);

    if (properties.length === 0) {
      console.log('⚠  No active properties found. Create a property first, then re-run this seeder.');
      return;
    }

    console.log(`\n🌱 Seeding meal plans for ${properties.length} property(ies)…\n`);

    for (const prop of properties) {
      console.log(`  🏨  ${prop.name} (id=${prop.id})`);
      for (const plan of MEAL_PLANS) {
        const exists = await planExists(client, prop.id, plan.code);
        if (exists) {
          console.log(`        ⏭   ${plan.code} – already exists, skipped`);
        } else {
          await insertPlan(client, prop.id, plan);
          console.log(`        ✅  ${plan.code} – ${plan.name} inserted (₹${plan.per_person_rate}/person)`);
        }
      }
    }

    console.log('\n✔ Meal plan seeding complete!\n');
  } catch (err) {
    console.error('❌ Seeder failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
