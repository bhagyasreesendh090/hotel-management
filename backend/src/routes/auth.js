import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import { config } from '../config.js';
import { query } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.post(
  '/login',
  body('email').isEmail().normalizeEmail(),
  body('password').isString().isLength({ min: 6 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { email, password } = req.body;
    const { rows } = await query(
      `SELECT id, email, password_hash, full_name, role, active FROM users WHERE email = $1`,
      [email]
    );
    const u = rows[0];
    if (!u || !u.active) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const ok = await bcrypt.compare(password, u.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
      { sub: u.id, role: u.role },
      config.jwtSecret,
      { expiresIn: config.jwtExpiresIn }
    );
    const props = await query(
      `SELECT property_id FROM user_property_access WHERE user_id = $1`,
      [u.id]
    );
    return res.json({
      token,
      user: {
        id: u.id,
        email: u.email,
        full_name: u.full_name,
        role: u.role,
        property_ids: props.rows.map((r) => r.property_id),
      },
    });
  }
);

router.get('/me', requireAuth, async (req, res) => {
  res.json({
    user: {
      id: req.user.id,
      email: req.user.email,
      full_name: req.user.full_name,
      role: req.user.role,
      property_ids: req.user.propertyIds,
    },
  });
});

export default router;
