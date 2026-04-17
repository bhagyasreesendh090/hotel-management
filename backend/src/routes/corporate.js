import { Router } from 'express';
import { body, param, validationResult } from 'express-validator';
import { query } from '../db/pool.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/corporate-accounts', async (req, res) => {
  const { rows } = await query(
    `SELECT * FROM corporate_accounts WHERE active = TRUE ORDER BY company_name LIMIT 500`
  );
  res.json({ corporate_accounts: rows });
});

router.post(
  '/corporate-accounts',
  requireRoles('super_admin', 'branch_manager', 'sales_manager', 'finance'),
  body('company_name').isString(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const b = req.body;
    const { rows } = await query(
      `INSERT INTO corporate_accounts (
        company_name, address, gstin, primary_contact, primary_email, primary_phone, alt_contact,
        billing_mode, rbi_rate_notes, contract_rate_notes, kings_discount_pct, kings_discount_flat,
        rate_can_change, estimated_room_volume, room_preferences, special_terms
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
      [
        b.company_name,
        b.address ?? null,
        b.gstin ?? null,
        b.primary_contact ?? null,
        b.primary_email ?? null,
        b.primary_phone ?? null,
        b.alt_contact ?? null,
        b.billing_mode ?? 'advance',
        b.rbi_rate_notes ?? null,
        b.contract_rate_notes ?? null,
        b.kings_discount_pct ?? null,
        b.kings_discount_flat ?? null,
        Boolean(b.rate_can_change),
        b.estimated_room_volume ?? null,
        b.room_preferences ?? null,
        b.special_terms ?? null,
      ]
    );
    res.status(201).json({ corporate_account: rows[0] });
  }
);

router.post(
  '/corporate-accounts/:id/rates',
  requireRoles('super_admin', 'branch_manager', 'sales_manager', 'finance'),
  param('id').isInt(),
  body('property_id').isInt(),
  body('contract_rate').isFloat(),
  async (req, res) => {
    const corpId = Number(req.params.id);
    const { rows } = await query(
      `INSERT INTO corporate_rate_lines (corporate_account_id, property_id, room_type_id, contract_rate, valid_from, valid_to, session_notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [
        corpId,
        req.body.property_id,
        req.body.room_type_id ?? null,
        req.body.contract_rate,
        req.body.valid_from ?? null,
        req.body.valid_to ?? null,
        req.body.session_notes ?? null,
      ]
    );
    res.status(201).json({ rate_line: rows[0] });
  }
);

router.post(
  '/rate-change-requests',
  requireRoles('super_admin', 'sales_manager', 'finance'),
  body('corporate_account_id').isInt(),
  async (req, res) => {
    const { rows } = await query(
      `INSERT INTO rate_change_requests (corporate_account_id, requested_by, payload, status)
       VALUES ($1, $2, $3, 'pending') RETURNING *`,
      [req.body.corporate_account_id, req.user.id, JSON.stringify(req.body.payload ?? {})]
    );
    res.status(201).json({ rate_change_request: rows[0] });
  }
);

router.patch(
  '/rate-change-requests/:id',
  requireRoles('super_admin', 'finance'),
  param('id').isInt(),
  body('status').isIn(['approved', 'rejected']),
  async (req, res) => {
    const id = Number(req.params.id);
    const { rows } = await query(
      `UPDATE rate_change_requests SET status = $2, decided_by = $3, decided_at = NOW() WHERE id = $1 RETURNING *`,
      [id, req.body.status, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json({ rate_change_request: rows[0] });
  }
);

router.get('/travel-agents', async (req, res) => {
  const { rows } = await query(`SELECT * FROM travel_agents WHERE active = TRUE ORDER BY agency_name`);
  res.json({ travel_agents: rows });
});

router.post(
  '/travel-agents',
  requireRoles('super_admin', 'branch_manager', 'sales_manager'),
  body('agency_name').isString(),
  async (req, res) => {
    const b = req.body;
    const { rows } = await query(
      `INSERT INTO travel_agents (agency_name, contact_name, email, phone, iata_tids, commission_pct, rate_plan_notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [
        b.agency_name,
        b.contact_name ?? null,
        b.email ?? null,
        b.phone ?? null,
        b.iata_tids ?? null,
        b.commission_pct ?? 0,
        JSON.stringify(b.rate_plan_notes ?? {}),
      ]
    );
    res.status(201).json({ travel_agent: rows[0] });
  }
);

export default router;
