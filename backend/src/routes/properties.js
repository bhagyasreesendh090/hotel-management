import { Router } from 'express';
import { body, param, validationResult } from 'express-validator';
import { query } from '../db/pool.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';
import { canAccessAllProperties } from '../constants/roles.js';
import { writeAudit } from '../utils/audit.js';

const router = Router();

router.use(requireAuth);

router.get('/', async (req, res) => {
  const unrestricted = canAccessAllProperties(req.user.role);
  if (unrestricted) {
    const { rows } = await query(
      `SELECT id, code, name, address, gstin, email_from, document_logo, active FROM properties WHERE active = TRUE ORDER BY code`
    );
    return res.json({ properties: rows });
  }
  if (!req.user.propertyIds?.length) return res.json({ properties: [] });
  const { rows } = await query(
    `SELECT id, code, name, address, gstin, email_from, document_logo, active FROM properties
     WHERE active = TRUE AND id = ANY($1::int[]) ORDER BY code`,
    [req.user.propertyIds]
  );
  return res.json({ properties: rows });
});

router.post(
  '/',
  requireRoles('super_admin'),
  body('code').isString().isLength({ min: 2, max: 16 }),
  body('name').isString().isLength({ min: 2 }),
  body('gstin').optional().isString(),
  body('document_logo').optional().isIn(['pramod_hotels_resorts', 'pramod_lands_end_radisson']),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const { code, name, gstin, address, email_from, document_logo } = req.body;
    const { rows } = await query(
      `INSERT INTO properties (code, name, gstin, address, email_from, document_logo)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, code, name, gstin, address, email_from, document_logo, active`,
      [code.toUpperCase(), name, gstin ?? null, address ?? null, email_from ?? null, document_logo ?? 'pramod_hotels_resorts']
    );
    await writeAudit(req.user.id, 'property', rows[0].id, 'create', null, rows[0]);
    res.status(201).json({ property: rows[0] });
  }
);

router.patch(
  '/:id',
  requireRoles('super_admin', 'branch_manager'),
  param('id').isInt(),
  async (req, res) => {
    const id = Number(req.params.id);
    if (req.user.role === 'branch_manager' && !req.user.propertyIds?.includes(id)) {
      return res.status(403).json({ error: 'Property access denied' });
    }
    if (
      req.body.document_logo !== undefined &&
      !['pramod_hotels_resorts', 'pramod_lands_end_radisson'].includes(req.body.document_logo)
    ) {
      return res.status(400).json({ error: 'Invalid document logo' });
    }
    const allowed = ['name', 'address', 'gstin', 'email_from', 'document_logo', 'cancellation_policy_default', 'advance_rule_note'];
    const sets = [];
    const vals = [];
    let i = 1;
    for (const k of allowed) {
      if (req.body[k] !== undefined) {
        sets.push(`${k} = $${i++}`);
        vals.push(req.body[k]);
      }
    }
    if (!sets.length) return res.status(400).json({ error: 'No updatable fields' });
    vals.push(id);
    const { rows } = await query(
      `UPDATE properties SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${i} RETURNING *`,
      vals
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    await writeAudit(req.user.id, 'property', id, 'update', null, rows[0]);
    res.json({ property: rows[0] });
  }
);

router.delete(
  '/:id',
  requireRoles('super_admin'),
  param('id').isInt(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const id = Number(req.params.id);
    const cur = await query(`SELECT * FROM properties WHERE id = $1 AND active = TRUE`, [id]);
    if (!cur.rows[0]) return res.status(404).json({ error: 'Property not found' });
    await query(`UPDATE properties SET active = FALSE, updated_at = NOW() WHERE id = $1`, [id]);
    await writeAudit(req.user.id, 'property', id, 'delete', cur.rows[0], null);
    res.json({ success: true });
  }
);

export default router;
