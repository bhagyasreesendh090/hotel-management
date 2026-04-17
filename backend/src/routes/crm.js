import { Router } from 'express';
import { body, param, query as qv, validationResult } from 'express-validator';
import { query, pool } from '../db/pool.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';
import { writeAudit } from '../utils/audit.js';
import { indianFinancialYearLabel } from '../services/financial.js';

const router = Router();
router.use(requireAuth);

router.get('/leads', qv('assigned_user_id').optional().isInt(), async (req, res) => {
  let sql = `SELECT * FROM leads WHERE 1=1`;
  const params = [];
  if (req.user.role === 'sales_executive') {
    params.push(req.user.id);
    sql += ` AND assigned_user_id = $${params.length}`;
  } else if (req.query.assigned_user_id) {
    params.push(Number(req.query.assigned_user_id));
    sql += ` AND assigned_user_id = $${params.length}`;
  }
  sql += ` ORDER BY created_at DESC LIMIT 300`;
  const { rows } = await query(sql, params);
  res.json({ leads: rows });
});

router.get('/leads/:id', param('id').isInt(), async (req, res) => {
  const id = Number(req.params.id);
  const { rows } = await query(`SELECT * FROM leads WHERE id = $1`, [id]);
  if (!rows[0]) return res.status(404).json({ error: 'Not found' });
  if (req.user.role === 'sales_executive' && rows[0].assigned_user_id !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const props = await query(
    `SELECT property_id FROM lead_properties WHERE lead_id = $1`,
    [id]
  );
  const aps = await query(`SELECT * FROM action_points WHERE lead_id = $1 ORDER BY due_date`, [id]);
  res.json({ lead: rows[0], property_ids: props.rows.map((r) => r.property_id), action_points: aps.rows });
});

router.post(
  '/leads/check-duplicate',
  body('contact_phone').optional().isString(),
  body('contact_email').optional().isString(),
  async (req, res) => {
    const { contact_phone, contact_email } = req.body;
    if (!contact_phone && !contact_email) {
      return res.status(400).json({ error: 'Provide phone or email' });
    }
    const { rows } = await query(
      `SELECT id, contact_name, contact_phone, contact_email, status, pipeline_stage, created_at
       FROM leads
       WHERE ($1::text IS NOT NULL AND contact_phone = $1)
          OR ($2::text IS NOT NULL AND LOWER(contact_email) = LOWER($2))
       ORDER BY created_at DESC
       LIMIT 5`,
      [contact_phone ?? null, contact_email ?? null]
    );
    res.json({ matches: rows, duplicate: rows.length > 0 });
  }
);

router.post(
  '/leads',
  requireRoles('super_admin', 'branch_manager', 'sales_manager', 'sales_executive'),
  body('contact_name').isString(),
  body('segment').isIn(['room', 'room_banquet', 'banquet_only']),
  body('inquiry_type').isIn(['accommodation', 'event', 'combined']),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const {
      assigned_user_id,
      contact_name,
      contact_email,
      contact_phone,
      company,
      segment,
      inquiry_type,
      hold_duration_note,
      lead_source,
      interest_tags,
      pipeline_stage,
      status,
      notes,
      duplicate_of_lead_id,
      corporate_account_id,
      property_ids,
    } = req.body;

    const assignee =
      assigned_user_id != null
        ? Number(assigned_user_id)
        : req.user.role === 'sales_executive'
          ? req.user.id
          : null;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const ins = await client.query(
        `INSERT INTO leads (
          assigned_user_id, contact_name, contact_email, contact_phone, company,
          segment, inquiry_type, hold_duration_note, lead_source, interest_tags,
          pipeline_stage, status, notes, duplicate_of_lead_id, corporate_account_id
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
        RETURNING *`,
        [
          assignee,
          contact_name,
          contact_email ?? null,
          contact_phone ?? null,
          company ?? null,
          segment,
          inquiry_type,
          hold_duration_note ?? null,
          lead_source ?? null,
          JSON.stringify(interest_tags ?? {}),
          pipeline_stage ?? 'inquiry',
          status ?? 'new',
          notes ?? null,
          duplicate_of_lead_id ?? null,
          corporate_account_id ?? null,
        ]
      );
      const lead = ins.rows[0];
      if (Array.isArray(property_ids)) {
        for (const pid of property_ids) {
          await client.query(
            `INSERT INTO lead_properties (lead_id, property_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [lead.id, pid]
          );
        }
      }
      await client.query('COMMIT');
      await writeAudit(req.user.id, 'lead', lead.id, 'create', null, lead);
      res.status(201).json({ lead });
    } catch (e) {
      await client.query('ROLLBACK');
      console.error(e);
      res.status(500).json({ error: e.message });
    } finally {
      client.release();
    }
  }
);

router.patch(
  '/leads/:id',
  requireRoles('super_admin', 'branch_manager', 'sales_manager', 'sales_executive'),
  param('id').isInt(),
  async (req, res) => {
    const id = Number(req.params.id);
    const cur = await query(`SELECT * FROM leads WHERE id = $1`, [id]);
    if (!cur.rows[0]) return res.status(404).json({ error: 'Not found' });
    if (req.user.role === 'sales_executive' && cur.rows[0].assigned_user_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const allowed = [
      'assigned_user_id',
      'contact_name',
      'contact_email',
      'contact_phone',
      'company',
      'segment',
      'inquiry_type',
      'hold_duration_note',
      'lead_source',
      'pipeline_stage',
      'status',
      'lost_reason',
      'notes',
      'conversion_booking_id',
    ];
    const sets = [];
    const vals = [];
    let i = 1;
    for (const k of allowed) {
      if (req.body[k] !== undefined) {
        sets.push(`${k} = $${i++}`);
        vals.push(req.body[k]);
      }
    }
    if (req.body.interest_tags !== undefined) {
      sets.push(`interest_tags = $${i++}`);
      vals.push(JSON.stringify(req.body.interest_tags));
    }
    if (!sets.length) return res.status(400).json({ error: 'No fields' });
    vals.push(id);
    const { rows } = await query(
      `UPDATE leads SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${i} RETURNING *`,
      vals
    );
    await writeAudit(req.user.id, 'lead', id, 'update', cur.rows[0], rows[0]);
    res.json({ lead: rows[0] });
  }
);

router.post(
  '/leads/:id/action-points',
  requireRoles('super_admin', 'branch_manager', 'sales_manager', 'sales_executive'),
  param('id').isInt(),
  body('task').isString(),
  async (req, res) => {
    const leadId = Number(req.params.id);
    const { task, assignee_user_id, due_date } = req.body;
    const { rows } = await query(
      `INSERT INTO action_points (lead_id, task, assignee_user_id, due_date)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [leadId, task, assignee_user_id ?? null, due_date ?? null]
    );
    res.status(201).json({ action_point: rows[0] });
  }
);

router.patch('/action-points/:id', param('id').isInt(), body('status').optional().isIn(['open', 'done', 'escalated']), async (req, res) => {
  const id = Number(req.params.id);
  const { status, task, due_date } = req.body;
  const { rows } = await query(
    `UPDATE action_points SET
       status = COALESCE($2, status),
       task = COALESCE($3, task),
       due_date = COALESCE($4, due_date),
       updated_at = NOW()
     WHERE id = $1 RETURNING *`,
    [id, status ?? null, task ?? null, due_date ?? null]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Not found' });
  res.json({ action_point: rows[0] });
});

router.post(
  '/quotations',
  requireRoles('super_admin', 'branch_manager', 'sales_manager', 'sales_executive'),
  body('property_id').isInt(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const propertyId = Number(req.body.property_id);
    const { rows: p } = await query(`SELECT code FROM properties WHERE id = $1`, [propertyId]);
    if (!p[0]) return res.status(400).json({ error: 'Invalid property' });
    const fy = indianFinancialYearLabel();

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const temp = `TEMP-${Date.now()}`;
      const ins = await client.query(
        `INSERT INTO quotations (lead_id, property_id, quotation_number, client_salutation, validity_days, status, financial_summary, policies, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
        [
          req.body.lead_id ?? null,
          propertyId,
          temp,
          req.body.client_salutation ?? "Dear Sir / Ma'am",
          req.body.validity_days ?? 7,
          req.body.status ?? 'draft',
          JSON.stringify(req.body.financial_summary ?? {}),
          JSON.stringify(req.body.policies ?? {}),
          req.user.id,
        ]
      );
      const qid = ins.rows[0].id;
      const qnum = `${p[0].code}-Q-${fy}-${String(qid).padStart(5, '0')}`;
      await client.query(`UPDATE quotations SET quotation_number = $2 WHERE id = $1`, [qid, qnum]);
      await client.query(
        `INSERT INTO quotation_versions (quotation_id, version, snapshot) VALUES ($1, 1, $2)`,
        [qid, JSON.stringify(req.body.snapshot ?? req.body)]
      );
      await client.query('COMMIT');
      const full = await query(`SELECT * FROM quotations WHERE id = $1`, [qid]);
      res.status(201).json({ quotation: full.rows[0] });
    } catch (e) {
      await client.query('ROLLBACK');
      console.error(e);
      res.status(500).json({ error: e.message });
    } finally {
      client.release();
    }
  }
);

router.get('/quotations/:id', param('id').isInt(), async (req, res) => {
  const id = Number(req.params.id);
  const { rows } = await query(`SELECT * FROM quotations WHERE id = $1`, [id]);
  if (!rows[0]) return res.status(404).json({ error: 'Not found' });
  const vers = await query(
    `SELECT * FROM quotation_versions WHERE quotation_id = $1 ORDER BY version`,
    [id]
  );
  res.json({ quotation: rows[0], versions: vers.rows });
});

router.post(
  '/quotations/:id/revise',
  requireRoles('super_admin', 'branch_manager', 'sales_manager', 'sales_executive'),
  param('id').isInt(),
  async (req, res) => {
    const id = Number(req.params.id);
    const v = await query(`SELECT COALESCE(MAX(version), 0) + 1 AS nv FROM quotation_versions WHERE quotation_id = $1`, [id]);
    const nv = v.rows[0].nv;
    await query(
      `INSERT INTO quotation_versions (quotation_id, version, snapshot) VALUES ($1, $2, $3)`,
      [id, nv, JSON.stringify(req.body.snapshot ?? req.body)]
    );
    await query(`UPDATE quotations SET status = 'revised', updated_at = NOW() WHERE id = $1`, [id]);
    const vers = await query(`SELECT * FROM quotation_versions WHERE quotation_id = $1 ORDER BY version`, [id]);
    res.json({ versions: vers.rows });
  }
);

router.post(
  '/contracts',
  requireRoles('super_admin', 'branch_manager', 'sales_manager', 'sales_executive', 'finance'),
  async (req, res) => {
    const {
      booking_id,
      lead_id,
      corporate_account_id,
      flow,
      terms,
      payment_deadline,
      expires_on,
    } = req.body;
    const { rows } = await query(
      `INSERT INTO contracts (booking_id, lead_id, corporate_account_id, flow, terms, payment_deadline, expires_on)
       VALUES ($1,$2,$3, COALESCE($4,'hotel_proposes'), $5, $6, $7) RETURNING *`,
      [
        booking_id ?? null,
        lead_id ?? null,
        corporate_account_id ?? null,
        flow,
        terms ?? null,
        payment_deadline ?? null,
        expires_on ?? null,
      ]
    );
    res.status(201).json({ contract: rows[0] });
  }
);

export default router;
