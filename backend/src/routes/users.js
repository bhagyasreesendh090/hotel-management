import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { body, param, validationResult } from 'express-validator';
import { query, pool } from '../db/pool.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';
import { writeAudit } from '../utils/audit.js';

const router = Router();

router.use(requireAuth);
router.use(requireRoles('super_admin'));

// List all users
router.get('/', async (req, res) => {
  const { rows } = await query(
    `SELECT u.id, u.email, u.full_name, u.role, u.phone, u.active, u.created_at,
            (SELECT array_agg(property_id) FROM user_property_access WHERE user_id = u.id) as property_ids
     FROM users u
     ORDER BY u.full_name`
  );
  res.json({ users: rows });
});

// Create user
router.post(
  '/',
  body('email').isEmail().normalizeEmail(),
  body('password').isString().isLength({ min: 6 }),
  body('full_name').isString().notEmpty(),
  body('role').isIn([
    'super_admin', 'gm', 'sales_agent', 'branch_manager', 
    'sales_manager', 'sales_executive', 'banquet_coordinator', 
    'front_desk', 'finance'
  ]),
  body('property_ids').optional().isArray(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email, password, full_name, role, phone, property_ids } = req.body;
    const passwordHash = await bcrypt.hash(password, 12);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      const insUser = await client.query(
        `INSERT INTO users (email, password_hash, full_name, role, phone)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, email, full_name, role, phone, active, created_at`,
        [email, passwordHash, full_name, role, phone ?? null]
      );
      const user = insUser.rows[0];

      if (property_ids && property_ids.length > 0) {
        for (const pid of property_ids) {
          await client.query(
            `INSERT INTO user_property_access (user_id, property_id) VALUES ($1, $2)`,
            [user.id, pid]
          );
        }
      }

      await writeAudit(req.user.id, 'user', user.id, 'create', null, user);
      await client.query('COMMIT');
      
      res.status(201).json({ 
        user: { 
          ...user, 
          property_ids: property_ids || [] 
        } 
      });
    } catch (e) {
      await client.query('ROLLBACK');
      console.error(e);
      res.status(500).json({ error: e.message });
    } finally {
      client.release();
    }
  }
);

// Update user
router.patch(
  '/:id',
  param('id').isInt(),
  body('role').optional().isIn([
    'super_admin', 'gm', 'sales_agent', 'branch_manager', 
    'sales_manager', 'sales_executive', 'banquet_coordinator', 
    'front_desk', 'finance'
  ]),
  async (req, res) => {
    const id = Number(req.params.id);
    const { full_name, role, phone, active, property_ids, password } = req.body;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      const cur = await client.query(`SELECT * FROM users WHERE id = $1`, [id]);
      if (!cur.rows[0]) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'User not found' });
      }

      const updates = [];
      const vals = [];
      let i = 1;

      if (full_name !== undefined) { updates.push(`full_name = $${i++}`); vals.push(full_name); }
      if (role !== undefined) { updates.push(`role = $${i++}`); vals.push(role); }
      if (phone !== undefined) { updates.push(`phone = $${i++}`); vals.push(phone); }
      if (active !== undefined) { updates.push(`active = $${i++}`); vals.push(active); }
      if (password) {
        const passwordHash = await bcrypt.hash(password, 12);
        updates.push(`password_hash = $${i++}`);
        vals.push(passwordHash);
      }

      let user;
      if (updates.length > 0) {
        vals.push(id);
        const upd = await client.query(
          `UPDATE users SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${i} RETURNING id, email, full_name, role, phone, active`,
          vals
        );
        user = upd.rows[0];
      } else {
        user = cur.rows[0];
      }

      if (property_ids !== undefined) {
        await client.query(`DELETE FROM user_property_access WHERE user_id = $1`, [id]);
        if (property_ids && property_ids.length > 0) {
          for (const pid of property_ids) {
            await client.query(
              `INSERT INTO user_property_access (user_id, property_id) VALUES ($1, $2)`,
              [id, pid]
            );
          }
        }
      }

      await writeAudit(req.user.id, 'user', id, 'update', cur.rows[0], user);
      await client.query('COMMIT');
      
      res.json({ 
        user: { 
          ...user, 
          property_ids: property_ids !== undefined ? property_ids : (await query(`SELECT array_agg(property_id) FROM user_property_access WHERE user_id = $1`, [id])).rows[0]?.array_agg || []
        } 
      });
    } catch (e) {
      await client.query('ROLLBACK');
      res.status(500).json({ error: e.message });
    } finally {
      client.release();
    }
  }
);

export default router;
