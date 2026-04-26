import { Router } from 'express';
import { body, param, query as qv, validationResult } from 'express-validator';
import { query } from '../db/pool.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';
import { canAccessAllProperties } from '../constants/roles.js';

const router = Router();
router.use(requireAuth);

function assertPropertyAccess(user, propertyId) {
  const pid = Number(propertyId);
  if (canAccessAllProperties(user.role)) return true;
  return user.propertyIds?.includes(pid);
}

/* ── GET all meal plans for a property ────────────────────────────────────── */
router.get('/', qv('property_id').isInt(), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const propertyId = Number(req.query.property_id);
  if (!assertPropertyAccess(req.user, propertyId)) {
    return res.status(403).json({ error: 'Property access denied' });
  }
  const { rows } = await query(
    `SELECT * FROM meal_plans WHERE property_id = $1 AND active = TRUE ORDER BY name`,
    [propertyId]
  );
  res.json({ meal_plans: rows });
});

/* ── CREATE ────────────────────────────────────────────────────────────────── */
router.post(
  '/',
  requireRoles('super_admin', 'branch_manager', 'sales_manager', 'sales_executive', 'front_desk', 'sales_agent'),
  body('property_id').isInt(),
  body('name').isString().notEmpty(),
  body('code').isString().optional({ nullable: true, checkFalsy: true }),
  body('per_person_rate').isString().optional({ nullable: true }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const propertyId = Number(req.body.property_id);
    if (!assertPropertyAccess(req.user, propertyId)) {
      return res.status(403).json({ error: 'Property access denied' });
    }
    const { name, description, per_person_rate, included_meals, items } = req.body;
    
    // Auto-generate code if empty
    let code = req.body.code;
    if (!code) {
      code = name.split(' ').map((w) => w[0]).join('').substring(0, 4).toUpperCase();
      if (!code) code = 'MP';
    } else {
      code = code.toUpperCase();
    }

    const { rows } = await query(
      `INSERT INTO meal_plans (property_id, name, code, description, per_person_rate, included_meals, items)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [
        propertyId,
        name,
        code,
        description ?? null,
        per_person_rate ?? null,
        JSON.stringify(included_meals ?? []),
        JSON.stringify(items ?? []),
      ]
    );
    res.status(201).json({ meal_plan: rows[0] });
  }
);

/* ── UPDATE ────────────────────────────────────────────────────────────────── */
router.put(
  '/:id',
  requireRoles('super_admin', 'branch_manager', 'sales_manager', 'sales_executive', 'front_desk', 'sales_agent'),
  param('id').isInt(),
  body('name').isString().notEmpty(),
  body('code').isString().optional({ nullable: true, checkFalsy: true }),
  body('per_person_rate').isString().optional({ nullable: true }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const id = Number(req.params.id);
    const cur = await query(`SELECT * FROM meal_plans WHERE id = $1 AND active = TRUE`, [id]);
    if (!cur.rows[0]) return res.status(404).json({ error: 'Meal plan not found' });
    if (!assertPropertyAccess(req.user, cur.rows[0].property_id)) {
      return res.status(403).json({ error: 'Property access denied' });
    }
    const { name, code, description, per_person_rate, included_meals, items } = req.body;
    const { rows } = await query(
      `UPDATE meal_plans
       SET name=$2, code=$3, description=$4, per_person_rate=$5,
           included_meals=$6, items=$7, updated_at=NOW()
       WHERE id=$1 RETURNING *`,
      [
        id,
        name,
        code ? code.toUpperCase() : cur.rows[0].code,
        description ?? cur.rows[0].description,
        per_person_rate ?? cur.rows[0].per_person_rate,
        JSON.stringify(included_meals ?? cur.rows[0].included_meals ?? []),
        JSON.stringify(items ?? cur.rows[0].items ?? []),
      ]
    );
    res.json({ meal_plan: rows[0] });
  }
);

/* ── DELETE (soft) ─────────────────────────────────────────────────────────── */
router.delete(
  '/:id',
  requireRoles('super_admin', 'branch_manager', 'sales_manager'),
  param('id').isInt(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const id = Number(req.params.id);
    const cur = await query(`SELECT * FROM meal_plans WHERE id = $1 AND active = TRUE`, [id]);
    if (!cur.rows[0]) return res.status(404).json({ error: 'Meal plan not found' });
    if (!assertPropertyAccess(req.user, cur.rows[0].property_id)) {
      return res.status(403).json({ error: 'Property access denied' });
    }
    await query(`UPDATE meal_plans SET active = FALSE, updated_at = NOW() WHERE id = $1`, [id]);
    res.json({ success: true });
  }
);

export default router;
