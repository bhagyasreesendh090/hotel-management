import { Router } from 'express';
import { query } from '../db/pool.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);
router.use(requireRoles('super_admin'));

// Get Audit Logs
router.get('/audit-logs', async (req, res) => {
  const { limit = 50, offset = 0, entity } = req.query;
  const params = [limit, offset];
  let filter = '';
  
  if (entity) {
    params.push(entity);
    filter = `WHERE entity = $3`;
  }

  const { rows } = await query(
    `SELECT a.*, u.full_name as user_name
     FROM audit_logs a
     LEFT JOIN users u ON u.id = a.user_id
     ${filter}
     ORDER BY a.created_at DESC
     LIMIT $1 OFFSET $2`,
    params
  );
  
  const total = await query(`SELECT COUNT(*) FROM audit_logs ${filter}`, entity ? [entity] : []);
  
  res.json({ 
    logs: rows,
    total: parseInt(total.rows[0].count)
  });
});

// System Stats
router.get('/stats', async (req, res) => {
  const userCount = await query(`SELECT COUNT(*) FROM users`);
  const propertyCount = await query(`SELECT COUNT(*) FROM properties`);
  const bookingCount = await query(`SELECT COUNT(*) FROM bookings`);
  const leadCount = await query(`SELECT COUNT(*) FROM leads`);

  res.json({
    users: parseInt(userCount.rows[0].count),
    properties: parseInt(propertyCount.rows[0].count),
    bookings: parseInt(bookingCount.rows[0].count),
    leads: parseInt(leadCount.rows[0].count)
  });
});

export default router;
