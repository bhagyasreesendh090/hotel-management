import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const standardMealPlans = [
  { name: 'Room Only', code: 'ROOM_ONLY', description: 'No meals included', rate: 0, items: [] },
  { name: 'Continental Plan', code: 'CP', description: 'Breakfast included', rate: 500, items: ['Breakfast'] },
  { name: 'Modified American Plan', code: 'MAP', description: 'Breakfast and either Lunch or Dinner included', rate: 1200, items: ['Breakfast', 'Lunch or Dinner'] },
  { name: 'American Plan', code: 'AP', description: 'Breakfast, Lunch, and Dinner included', rate: 1800, items: ['Breakfast', 'Lunch', 'Dinner'] },
  { name: 'Custom', code: 'CUSTOM', description: 'Custom meal plan details', rate: 0, items: ['Custom items as per request'] }
];

async function seedMeals() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: properties } = await client.query('SELECT id FROM properties');
    
    for (const property of properties) {
      for (const plan of standardMealPlans) {
        await client.query(
          `INSERT INTO meal_plans (property_id, name, code, description, per_person_rate, items)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (property_id, code) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description`,
          [property.id, plan.name, plan.code, plan.description, plan.rate, JSON.stringify(plan.items)]
        );
      }
    }
    await client.query('COMMIT');
    console.log('Meal plans successfully seeded for all properties!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error seeding meals:', err);
  } finally {
    client.release();
    pool.end();
  }
}

seedMeals();
