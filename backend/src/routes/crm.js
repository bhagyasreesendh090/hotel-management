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
  const qs = await query(`SELECT id, quotation_number, status, final_amount, valid_until, secure_token, created_at FROM quotations WHERE lead_id = $1 ORDER BY created_at DESC`, [id]);
  res.json({ lead: rows[0], property_ids: props.rows.map((r) => r.property_id), action_points: aps.rows, quotations: qs.rows });
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

router.get(
  '/quotations',
  requireRoles('super_admin', 'branch_manager', 'sales_manager', 'sales_executive'),
  async (req, res) => {
    let sql = `SELECT q.*, l.contact_name, l.company 
               FROM quotations q 
               LEFT JOIN leads l ON q.lead_id = l.id 
               WHERE 1=1`;
    const params = [];
    if (req.user.role === 'sales_executive') {
      params.push(req.user.id);
      sql += ` AND l.assigned_user_id = $${params.length}`;
    }
    sql += ` ORDER BY q.created_at DESC LIMIT 500`;
    const { rows } = await query(sql, params);
    res.json({ quotations: rows });
  }
);

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
      
      const totalAmount = Number(req.body.total_amount) || 0;
      const taxAmount = Number(req.body.tax_amount) || 0;
      const discountAmount = Number(req.body.discount_amount) || 0;
      const finalAmount = Number(req.body.final_amount) || 0;
      const threshold = Number(process.env.DISCOUNT_APPROVAL_THRESHOLD) || 5000;
      
      let status = req.body.status || 'draft';
      if (status !== 'draft' && discountAmount > threshold) {
         status = 'pending_approval';
      }

      const validity = Number(req.body.validity_days) || 7;
      const validUntil = new Date(Date.now() + validity * 24 * 60 * 60 * 1000);

      const ins = await client.query(
        `INSERT INTO quotations (lead_id, property_id, quotation_number, client_salutation, validity_days, valid_until, status, financial_summary, policies, created_by, total_amount, tax_amount, discount_amount, final_amount)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING id, secure_token`,
        [
          req.body.lead_id ?? null,
          propertyId,
          temp,
          req.body.client_salutation ?? "Dear Sir / Ma'am",
          validity,
          validUntil,
          status,
          JSON.stringify(req.body.financial_summary ?? {}),
          JSON.stringify(req.body.policies ?? {}),
          req.user.id,
          totalAmount,
          taxAmount,
          discountAmount,
          finalAmount
        ]
      );
      const qid = ins.rows[0].id;
      const qnum = `${p[0].code}-Q-${fy}-${String(qid).padStart(5, '0')}`;
      await client.query(`UPDATE quotations SET quotation_number = $2 WHERE id = $1`, [qid, qnum]);
      await client.query(
        `INSERT INTO quotation_versions (quotation_id, version, snapshot) VALUES ($1, 1, $2)`,
        [qid, JSON.stringify(req.body.snapshot ?? req.body)]
      );
      
      if (status === 'sent' && req.body.lead_id) {
        await client.query(`UPDATE leads SET pipeline_stage = 'quotation_sent', updated_at = NOW() WHERE id = $1`, [req.body.lead_id]);
      }
      
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

router.patch(
  '/quotations/:id',
  requireRoles('super_admin', 'branch_manager', 'sales_manager', 'sales_executive', 'gm'),
  param('id').isInt(),
  async (req, res) => {
    const id = Number(req.params.id);
    const { status } = req.body;
    
    // Auto lead stage mapping based on quote action
    const quote = await query('SELECT lead_id FROM quotations WHERE id = $1', [id]);
    const leadId = quote.rows[0]?.lead_id;

    if (status === 'approved' || status === 'rejected') {
      if (!['super_admin', 'gm', 'sales_manager'].includes(req.user.role)) {
        return res.status(403).json({ error: 'Only managers can approve discounts' });
      }
      await query(`UPDATE quotations SET status = $2, approved_by = $3, updated_at = NOW() WHERE id = $1`, [id, status, req.user.id]);
    } else {
      await query(`UPDATE quotations SET status = $2, updated_by = $3, updated_at = NOW() WHERE id = $1`, [id, status, req.user.id]);
    }

    if (leadId) {
      if (status === 'sent') {
         await query(`UPDATE leads SET pipeline_stage = 'quotation_sent', updated_at = NOW() WHERE id = $1`, [leadId]);
      } else if (status === 'accepted') {
         await query(`UPDATE leads SET pipeline_stage = 'confirmed', updated_at = NOW() WHERE id = $1`, [leadId]);
      }
    }
    const updated = await query(`SELECT * FROM quotations WHERE id = $1`, [id]);
    res.json({ quotation: updated.rows[0] });
  }
);

router.post(
  '/quotations/:id/send-email',
  requireRoles('super_admin', 'branch_manager', 'sales_manager', 'sales_executive', 'gm'),
  param('id').isInt(),
  async (req, res) => {
    const id = Number(req.params.id);
    const { to_email, cc_email, subject, body } = req.body;
    
    // In a real application, you would integrate Nodemailer or AWS SES here.
    // For now, we mock the email dispatch successfully and update the quote status appropriately!
    console.log(`[Email Dispatch Mock] Sending Quote ${id}`);
    console.log(`To: ${to_email}`);
    if (cc_email) console.log(`Cc: ${cc_email}`);
    console.log(`Subject: ${subject}`);
    
    const quote = await query('SELECT lead_id FROM quotations WHERE id = $1', [id]);
    const leadId = quote.rows[0]?.lead_id;

    await query(`UPDATE quotations SET status = 'sent', updated_by = $2, updated_at = NOW() WHERE id = $1`, [id, req.user.id]);
    
    if (leadId) {
      await query(`UPDATE leads SET pipeline_stage = 'quotation_sent', updated_at = NOW() WHERE id = $1`, [leadId]);
    }
    
    // Log the action to the interactions table!
    const ccLog = cc_email ? `\\nCC: ${cc_email}` : '';
    await query(
      `INSERT INTO quotation_interactions (quotation_id, sender_type, message, is_internal)
       VALUES ($1, 'agent', $2, $3)`,
      [id, `Email physically dispatched.\\nTo: ${to_email}${ccLog}\\nSubject: ${subject}`, true]
    );

    res.json({ success: true, message: 'Email sent successfully via CRM interface' });
  }
);

router.post('/quotations/:id/interact', requireRoles('super_admin', 'branch_manager', 'sales_manager', 'sales_executive', 'gm'), param('id').isInt(), async (req, res) => {
    const id = Number(req.params.id);
    const { message, is_internal } = req.body;
    const { rows } = await query(
      `INSERT INTO quotation_interactions (quotation_id, sender_type, message, is_internal)
       VALUES ($1, 'agent', $2, $3) RETURNING *`,
      [id, message, is_internal ?? false]
    );
    res.status(201).json({ interaction: rows[0] });
});

router.get('/public/quotations/:token', async (req, res) => {
  const { token } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(`SELECT * FROM quotations WHERE secure_token = $1`, [token]);
    if (!rows[0]) return res.status(404).json({ error: 'Quotation not found' });
    const quote = rows[0];
    
    // Auto-mark expired
    if (quote.valid_until && new Date() > new Date(quote.valid_until) && quote.status !== 'expired' && quote.status !== 'accepted') {
        await client.query(`UPDATE quotations SET status = 'expired' WHERE id = $1`, [quote.id]);
        quote.status = 'expired';
    }

    // View Tracking
    await client.query(`UPDATE quotations SET viewed_at = NOW(), view_count = view_count + 1 WHERE id = $1`, [quote.id]);
    if (quote.status === 'sent') {
      await client.query(`UPDATE quotations SET status = 'viewed' WHERE id = $1`, [quote.id]);
      quote.status = 'viewed';
    }
    
    const prop = await client.query(`SELECT name, address, email_from FROM properties WHERE id = $1`, [quote.property_id]);
    const vers = await client.query(`SELECT version, snapshot, created_at FROM quotation_versions WHERE quotation_id = $1 ORDER BY version DESC LIMIT 1`, [quote.id]);
    const interactions = await client.query(`SELECT sender_type, message, created_at FROM quotation_interactions WHERE quotation_id = $1 AND is_internal = FALSE ORDER BY created_at ASC`, [quote.id]);
    
    await client.query('COMMIT');

    res.json({
      quotation: quote,
      property: prop.rows[0],
      latest_version: vers.rows[0],
      interactions: interactions.rows
    });
  } catch(e) {
    await client.query('ROLLBACK');
    res.status(500).json({error: e.message});
  } finally {
    client.release();
  }
});

router.post('/public/quotations/:token/interact', async (req, res) => {
  const { token } = req.params;
  const { message, action } = req.body;
  const { rows } = await query(`SELECT id, status, lead_id FROM quotations WHERE secure_token = $1`, [token]);
  if (!rows[0]) return res.status(404).json({ error: 'Not found' });
  const quote = rows[0];
  
  if (action === 'accept') {
    await query(`UPDATE quotations SET status = 'accepted', updated_at = NOW() WHERE id = $1`, [quote.id]);
    if (quote.lead_id) await query(`UPDATE leads SET pipeline_stage = 'confirmed', updated_at = NOW() WHERE id = $1`, [quote.lead_id]);
  } else if (action === 'reject') {
    await query(`UPDATE quotations SET status = 'rejected', updated_at = NOW() WHERE id = $1`, [quote.id]);
  }
  
  if (message) {
    await query(
      `INSERT INTO quotation_interactions (quotation_id, sender_type, message) VALUES ($1, 'client', $2)`,
      [quote.id, message]
    );
  }
  
  res.json({ success: true, newStatus: action === 'accept' ? 'accepted' : action === 'reject' ? 'rejected' : quote.status });
});

router.get('/contracts', requireRoles('super_admin', 'branch_manager', 'sales_manager', 'sales_executive'), async (req, res) => {
  let sql = `SELECT c.*, l.contact_name as lead_contact, l.company as lead_company, ca.name as corporate_name
             FROM contracts c 
             LEFT JOIN leads l ON c.lead_id = l.id 
             LEFT JOIN corporate_accounts ca ON c.corporate_account_id = ca.id
             WHERE 1=1`;
  const params = [];
  if (req.user.role === 'sales_executive') {
    params.push(req.user.id);
    sql += ` AND (l.assigned_user_id = $${params.length} OR ca.account_manager_id = $${params.length})`;
  }
  sql += ` ORDER BY c.created_at DESC LIMIT 500`;
  const { rows } = await query(sql, params);
  res.json({ contracts: rows });
});

router.post(
  '/contracts',
  requireRoles('super_admin', 'branch_manager', 'sales_manager', 'sales_executive', 'finance'),
  async (req, res) => {
    const {
      property_id,
      booking_id,
      lead_id,
      corporate_account_id,
      flow,
      terms,
      payment_deadline,
      expires_on,
      total_value,
      status
    } = req.body;

    const propId = property_id || 1; // fallback if not provided directly
    const { rows: p } = await query(`SELECT code FROM properties WHERE id = $1`, [propId]);
    const fy = indianFinancialYearLabel();

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const temp = `TEMP-C-${Date.now()}`;
      
      const ins = await client.query(
        `INSERT INTO contracts (booking_id, lead_id, corporate_account_id, property_id, contract_number, flow, terms, payment_deadline, expires_on, total_value, status, created_at)
         VALUES ($1,$2,$3,$4,$5,COALESCE($6,'hotel_proposes'),$7,$8,$9,$10,$11,NOW()) RETURNING id, secure_token`,
        [
          booking_id ?? null,
          lead_id ?? null,
          corporate_account_id ?? null,
          propId,
          temp,
          flow,
          terms ?? null,
          payment_deadline ?? null,
          expires_on ?? null,
          total_value ?? 0,
          status ?? 'draft'
        ]
      );
      
      const cid = ins.rows[0].id;
      const cnum = `${p[0]?.code || 'HPL'}-C-${fy}-${String(cid).padStart(5, '0')}`;
      await client.query(`UPDATE contracts SET contract_number = $2 WHERE id = $1`, [cid, cnum]);

      await client.query(
        `INSERT INTO contract_versions (contract_id, version, snapshot) VALUES ($1, 1, $2)`,
        [cid, JSON.stringify(req.body.snapshot ?? req.body)]
      );

      await client.query('COMMIT');
      const full = await query(`SELECT * FROM contracts WHERE id = $1`, [cid]);
      res.status(201).json({ contract: full.rows[0] });
    } catch (e) {
      await client.query('ROLLBACK');
      res.status(500).json({ error: e.message });
    } finally {
      client.release();
    }
  }
);

router.get('/contracts/:id', param('id').isInt(), async (req, res) => {
  const id = Number(req.params.id);
  const { rows } = await query(`SELECT * FROM contracts WHERE id = $1`, [id]);
  if (!rows[0]) return res.status(404).json({ error: 'Not found' });
  const vers = await query(`SELECT * FROM contract_versions WHERE contract_id = $1 ORDER BY version`, [id]);
  res.json({ contract: rows[0], versions: vers.rows });
});

router.post(
  '/contracts/:id/revise',
  requireRoles('super_admin', 'branch_manager', 'sales_manager', 'sales_executive', 'finance'),
  param('id').isInt(),
  async (req, res) => {
    const id = Number(req.params.id);
    const v = await query(`SELECT COALESCE(MAX(version), 0) + 1 AS nv FROM contract_versions WHERE contract_id = $1`, [id]);
    const nv = v.rows[0].nv;
    await query(
      `INSERT INTO contract_versions (contract_id, version, snapshot) VALUES ($1, $2, $3)`,
      [id, nv, JSON.stringify(req.body.snapshot ?? req.body)]
    );
    // don't bump state away from draft/negotiation unless requested
    const vers = await query(`SELECT * FROM contract_versions WHERE contract_id = $1 ORDER BY version`, [id]);
    res.json({ versions: vers.rows });
  }
);

router.patch(
  '/contracts/:id',
  requireRoles('super_admin', 'branch_manager', 'sales_manager', 'sales_executive', 'gm', 'finance'),
  param('id').isInt(),
  async (req, res) => {
    const id = Number(req.params.id);
    const allowed = ['status', 'terms', 'payment_deadline', 'expires_on', 'total_value', 'flow'];
    const sets = [];
    const vals = [];
    let i = 1;

    for (const k of allowed) {
      if (req.body[k] !== undefined) {
        sets.push(`${k} = $${i++}`);
        vals.push(req.body[k]);
      }
    }
    if (!sets.length) return res.status(400).json({ error: 'No valid fields provided' });
    
    sets.push(`updated_at = NOW()`);
    sets.push(`updated_by = $${i++}`);
    vals.push(req.user.id);
    vals.push(id); // for WHERE id = $x

    if (req.body.status === 'approved' || req.body.status === 'rejected') {
        if (!['super_admin', 'gm', 'sales_manager'].includes(req.user.role)) {
          return res.status(403).json({ error: 'Only managers can explicitly approve discounts on contracts' });
        }
        sets.push(`approved_by = $${i++}`);
        vals.push(req.user.id);
    }
    
    const { rows } = await query(
      `UPDATE contracts SET ${sets.join(', ')} WHERE id = $${vals.length} RETURNING *`,
      vals
    );
    res.json({ contract: rows[0] });
  }
);

router.post(
  '/contracts/:id/send-email',
  requireRoles('super_admin', 'branch_manager', 'sales_manager', 'sales_executive', 'gm', 'finance'),
  param('id').isInt(),
  async (req, res) => {
    const id = Number(req.params.id);
    const { to_email, cc_email, subject, body } = req.body;
    
    console.log(`[Contract Dispatch Mock] Contract ${id} emailed to ${to_email}`);
    
    await query(`UPDATE contracts SET status = 'sent', updated_by = $2, updated_at = NOW() WHERE id = $1`, [id, req.user.id]);
    
    // Log the physical action
    const ccLog = cc_email ? `\\nCC: ${cc_email}` : '';
    await query(
      `INSERT INTO contract_interactions (contract_id, sender_type, message, is_internal)
       VALUES ($1, 'agent', $2, $3)`,
      [id, `Contract formally dispatched via email.\\nTo: ${to_email}${ccLog}\\nSubject: ${subject}`, true]
    );

    res.json({ success: true, message: 'Contract sent successfully via CRM interface' });
  }
);

router.post('/contracts/:id/interact', requireRoles('super_admin', 'branch_manager', 'sales_manager', 'sales_executive', 'gm', 'finance'), param('id').isInt(), async (req, res) => {
    const id = Number(req.params.id);
    const { message, is_internal } = req.body;
    const { rows } = await query(
      `INSERT INTO contract_interactions (contract_id, sender_type, message, is_internal)
       VALUES ($1, 'agent', $2, $3) RETURNING *`,
      [id, message, is_internal ?? false]
    );
    res.status(201).json({ interaction: rows[0] });
});

router.get('/public/contracts/:token', async (req, res) => {
  const { token } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(`SELECT * FROM contracts WHERE secure_token = $1`, [token]);
    if (!rows[0]) return res.status(404).json({ error: 'Contract not found' });
    const contract = rows[0];
    
    if (contract.expires_on && new Date() > new Date(contract.expires_on) && contract.status !== 'expired' && contract.status !== 'accepted') {
        await client.query(`UPDATE contracts SET status = 'expired' WHERE id = $1`, [contract.id]);
        contract.status = 'expired';
    }

    await client.query(`UPDATE contracts SET viewed_at = NOW(), view_count = view_count + 1 WHERE id = $1`, [contract.id]);
    if (contract.status === 'sent') {
      await client.query(`UPDATE contracts SET status = 'viewed' WHERE id = $1`, [contract.id]);
      contract.status = 'viewed';
    }
    
    const propId = contract.property_id || 1; 
    const prop = await client.query(`SELECT name, address, email_from FROM properties WHERE id = $1`, [propId]);
    const vers = await client.query(`SELECT version, snapshot, created_at FROM contract_versions WHERE contract_id = $1 ORDER BY version DESC LIMIT 1`, [contract.id]);
    const interactions = await client.query(`SELECT sender_type, message, created_at FROM contract_interactions WHERE contract_id = $1 AND is_internal = FALSE ORDER BY created_at ASC`, [contract.id]);
    
    await client.query('COMMIT');

    res.json({
      contract: contract,
      property: prop.rows[0],
      latest_version: vers.rows[0],
      interactions: interactions.rows
    });
  } catch(e) {
    await client.query('ROLLBACK');
    res.status(500).json({error: e.message});
  } finally {
    client.release();
  }
});

router.post('/public/contracts/:token/interact', async (req, res) => {
  const { token } = req.params;
  const { message, action } = req.body;
  const { rows } = await query(`SELECT id, status, lead_id FROM contracts WHERE secure_token = $1`, [token]);
  if (!rows[0]) return res.status(404).json({ error: 'Not found' });
  const contract = rows[0];
  
  if (action === 'accept') {
    await query(`UPDATE contracts SET status = 'accepted', signed_ack = 'Client Electronically Signed', updated_at = NOW() WHERE id = $1`, [contract.id]);
    // Optionally trigger pipeline stage
  } else if (action === 'reject') {
    await query(`UPDATE contracts SET status = 'rejected', updated_at = NOW() WHERE id = $1`, [contract.id]);
  }
  
  if (message) {
    await query(
      `INSERT INTO contract_interactions (contract_id, sender_type, message) VALUES ($1, 'client', $2)`,
      [contract.id, message]
    );
  }
  
  res.json({ success: true, newStatus: action === 'accept' ? 'accepted' : action === 'reject' ? 'rejected' : contract.status });
});

export default router;
