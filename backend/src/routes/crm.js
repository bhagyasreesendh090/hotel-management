import { Router } from 'express';
import { body, param, query as qv, validationResult } from 'express-validator';
import { query, pool } from '../db/pool.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';
import { writeAudit } from '../utils/audit.js';
import { indianFinancialYearLabel } from '../services/financial.js';
import { sendEmail } from '../utils/email.js';

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
  sql += ` ORDER BY created_at DESC LIMIT 1000`;
  const { rows } = await query(sql, params);
  res.json({ leads: rows });
});

router.post('/leads/check-duplicate', async (req, res) => {
  const { contact_email, contact_phone } = req.body;
  if (!contact_email && !contact_phone) return res.json({ duplicate: false, matches: [] });

  const params = [];
  let sql = `SELECT id, contact_name, contact_email, contact_phone FROM leads WHERE 1=0`;
  
  if (contact_email) {
    params.push(contact_email);
    sql += ` OR contact_email = $${params.length}`;
  }
  if (contact_phone) {
    params.push(contact_phone);
    sql += ` OR contact_phone = $${params.length}`;
  }

  const { rows } = await query(sql, params);
  res.json({ duplicate: rows.length > 0, matches: rows });
});

router.post(
  '/leads',
  requireRoles('super_admin', 'branch_manager', 'sales_manager', 'sales_executive'),
  body('contact_name').isString().notEmpty(),
  body('segment').isIn(['room', 'room_banquet', 'banquet_only']),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const {
      contact_name,
      contact_email,
      contact_phone,
      company,
      segment,
      inquiry_type,
      hold_duration_note,
      lead_source,
      interest_tags,
      notes,
      property_ids,
      corporate_account_id
    } = req.body;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const ins = await client.query(
        `INSERT INTO leads (
          assigned_user_id, contact_name, contact_email, contact_phone, company,
          segment, inquiry_type, hold_duration_note, lead_source, interest_tags,
          notes, corporate_account_id, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW()) RETURNING id`,
        [
          req.user.id,
          contact_name,
          contact_email ?? null,
          contact_phone ?? null,
          company ?? null,
          segment,
          inquiry_type ?? 'accommodation',
          hold_duration_note ?? null,
          lead_source ?? null,
          JSON.stringify(interest_tags ?? {}),
          notes ?? null,
          corporate_account_id ?? null
        ]
      );
      const leadId = ins.rows[0].id;

      if (Array.isArray(property_ids) && property_ids.length > 0) {
        for (const pid of property_ids) {
          await client.query(
            `INSERT INTO lead_properties (lead_id, property_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [leadId, pid]
          );
        }
      }

      await client.query('COMMIT');
      const full = await query(`SELECT * FROM leads WHERE id = $1`, [leadId]);
      res.status(201).json({ lead: full.rows[0] });
    } catch (e) {
      await client.query('ROLLBACK');
      res.status(500).json({ error: e.message });
    } finally {
      client.release();
    }
  }
);

router.get('/leads/:id', async (req, res) => {
  const id = Number(req.params.id);
  const { rows } = await query(`SELECT * FROM leads WHERE id = $1`, [id]);
  if (!rows[0]) return res.status(404).json({ error: 'Lead not found' });
  const props = await query(
    `SELECT p.* FROM properties p JOIN lead_properties lp ON p.id = lp.property_id WHERE lp.lead_id = $1`,
    [id]
  );
  const actions = await query(
    `SELECT * FROM action_points WHERE lead_id = $1 ORDER BY due_date ASC`,
    [id]
  );
  res.json({ lead: rows[0], properties: props.rows, action_points: actions.rows });
});

router.patch(
  '/leads/:id',
  requireRoles('super_admin', 'branch_manager', 'sales_manager', 'sales_executive'),
  async (req, res) => {
    const id = Number(req.params.id);
    const { status, pipeline_stage, notes, assigned_user_id, lost_reason } = req.body;
    const upd = await query(
      `UPDATE leads SET 
        status = COALESCE($2, status), 
        pipeline_stage = COALESCE($3, pipeline_stage),
        notes = COALESCE($4, notes),
        assigned_user_id = COALESCE($5, assigned_user_id),
        lost_reason = COALESCE($6, lost_reason),
        updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [id, status, pipeline_stage, notes, assigned_user_id, lost_reason]
    );
    res.json({ lead: upd.rows[0] });
  }
);

router.delete(
  '/leads/:id',
  requireRoles('super_admin', 'branch_manager', 'sales_manager'),
  async (req, res) => {
    const id = Number(req.params.id);
    await query(`DELETE FROM leads WHERE id = $1`, [id]);
    res.json({ message: 'Lead deleted permanently' });
  }
);

/* ── ACTION POINTS ────────────────────────────────────────────────────────── */
router.post('/action-points', async (req, res) => {
  const { lead_id, task, assignee_user_id, due_date } = req.body;
  const { rows } = await query(
    `INSERT INTO action_points (lead_id, task, assignee_user_id, due_date)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [lead_id, task, assignee_user_id ?? req.user.id, due_date]
  );
  res.status(201).json({ action_point: rows[0] });
});

router.patch('/action-points/:id', async (req, res) => {
  const id = Number(req.params.id);
  const { status } = req.body;
  const { rows } = await query(
    `UPDATE action_points SET status = $2, updated_at = NOW() WHERE id = $1 RETURNING *`,
    [id, status]
  );
  res.json({ action_point: rows[0] });
});

/* ── QUOTATIONS ───────────────────────────────────────────────────────────── */

router.get('/quotations', async (req, res) => {
  let sql = `SELECT q.*, l.contact_name, l.company 
             FROM quotations q
             LEFT JOIN leads l ON q.lead_id = l.id
             WHERE 1=1`;
  const params = [];
  if (req.user.role === 'sales_executive') {
    params.push(req.user.id);
    sql += ` AND (l.assigned_user_id = $${params.length} OR q.created_by = $${params.length})`;
  } else if (req.query.property_id) {
    params.push(Number(req.query.property_id));
    sql += ` AND q.property_id = $${params.length}`;
  }
  sql += ` ORDER BY q.created_at DESC LIMIT 500`;
  const { rows } = await query(sql, params);
  res.json({ quotations: rows });
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

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const fy = indianFinancialYearLabel();
      const seq = await client.query(
        `INSERT INTO ds_sequences (property_id, financial_year, last_number)
         VALUES ($1, $2, 1)
         ON CONFLICT (property_id, financial_year)
         DO UPDATE SET last_number = ds_sequences.last_number + 1
         RETURNING last_number`,
        [propertyId, fy]
      );
      const num = seq.rows[0].last_number;
      const temp = `TEMP-${Date.now()}`;
      
      const { status, financial_summary, policies, total_amount, tax_amount, discount_amount, final_amount } = req.body;
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
          status || 'draft',
          JSON.stringify(financial_summary ?? {}),
          JSON.stringify(policies ?? {}),
          req.user.id,
          total_amount ?? 0,
          tax_amount ?? 0,
          discount_amount ?? 0,
          final_amount
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

      // Auto-update room booking status → QTN-HOLD when quotation is sent
      if (status === 'sent' && req.body.room_booking_id) {
        await client.query(
          `UPDATE bookings SET status = 'QTN-HOLD', updated_at = NOW() WHERE id = $1`,
          [Number(req.body.room_booking_id)]
        );
      }

      // Auto-update banquet booking status → QTN-HOLD when quotation is sent
      if (status === 'sent' && req.body.banquet_booking_id) {
        await client.query(
          `UPDATE banquet_bookings SET status = 'QTN-HOLD', updated_at = NOW() WHERE id = $1`,
          [Number(req.body.banquet_booking_id)]
        );
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
    
    // Fetch the quotation to get the secure_token for the link
    const { rows: qRows } = await query('SELECT secure_token, quotation_number FROM quotations WHERE id = $1', [id]);
    const quote = qRows[0];
    const leadId = quote?.lead_id;

    // Construct the public link (Base URL should ideally be in .env)
    const baseUrl = process.env.PUBLIC_APP_URL || 'http://localhost:5173';
    const publicLink = `${baseUrl}/public/quote/${quote.secure_token}`;
    
    const fullBody = `${body}\n\nView your quotation here: ${publicLink}\n\nRegards,\nHotel Pramod Team`;

    try {
      await sendEmail({
        to: to_email,
        cc: cc_email,
        subject: subject,
        text: fullBody,
        // You could also generate HTML here
      });
    } catch (mailErr) {
      console.error('Mail delivery failed:', mailErr);
      // We continue to update status to 'sent' if requested, or we could return 500
      // For now, let's return 500 if the actual delivery fails
      return res.status(500).json({ error: 'Mail delivery failed. Please check SMTP settings.' });
    }

    await query(`UPDATE quotations SET status = 'sent', updated_by = $2, updated_at = NOW() WHERE id = $1`, [id, req.user.id]);
    
    if (leadId) {
      await query(`UPDATE leads SET pipeline_stage = 'quotation_sent', updated_at = NOW() WHERE id = $1`, [leadId]);
    }
    
    const ccLog = cc_email ? `\nCC: ${cc_email}` : '';
    await query(
      `INSERT INTO quotation_interactions (quotation_id, sender_type, message, is_internal)
       VALUES ($1, 'agent', $2, $3)`,
      [id, `Email physically dispatched.\nTo: ${to_email}${ccLog}\nSubject: ${subject}`, true]
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

/* ── CONTRACTS ────────────────────────────────────────────────────────────── */

router.get('/contracts', requireRoles('super_admin', 'branch_manager', 'sales_manager', 'sales_executive'), async (req, res) => {
  let sql = `SELECT c.*, l.contact_name as lead_contact, l.company as lead_company, ca.company_name as corporate_name
             FROM contracts c 
             LEFT JOIN leads l ON c.lead_id = l.id 
             LEFT JOIN corporate_accounts ca ON c.corporate_account_id = ca.id
             WHERE 1=1`;
  const params = [];
  if (req.user.role === 'sales_executive') {
    params.push(req.user.id);
    sql += ` AND (l.assigned_user_id = $${params.length} OR ca.account_manager_id = $${params.length})`;
  } else if (req.query.property_id) {
    params.push(Number(req.query.property_id));
    sql += ` AND c.property_id = $${params.length}`;
  }
  sql += ` ORDER BY c.created_at DESC LIMIT 500`;
  const { rows } = await query(sql, params);
  res.json({ contracts: rows });
});

router.post(
  '/contracts',
  requireRoles('super_admin', 'branch_manager', 'sales_manager', 'sales_executive'),
  body('property_id').isInt(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { 
        booking_id, lead_id, corporate_account_id, property_id, 
        flow, terms, payment_deadline, expires_on, total_value, status 
      } = req.body;
      
      const ins = await client.query(
        `INSERT INTO contracts (
          booking_id, lead_id, corporate_account_id, property_id, 
          terms, flow, payment_deadline, expires_on, total_value, status, updated_by, updated_at
        ) VALUES ($1,$2,$3,$4,$5,COALESCE($6,'hotel_proposes'),$7,$8,$9,$10,$11,NOW()) RETURNING id, secure_token`,
        [
          booking_id || null,
          lead_id || null,
          corporate_account_id || null,
          property_id,
          terms || '',
          flow,
          payment_deadline || null,
          expires_on || null,
          total_value || 0,
          status || 'draft',
          req.user.id
        ]
      );
      const cid = ins.rows[0].id;
      const fy = indianFinancialYearLabel();
      const { rows: p } = await client.query(`SELECT code FROM properties WHERE id = $1`, [property_id]);
      const cnum = `${p[0]?.code || 'HP'}-CON-${fy}-${String(cid).padStart(5, '0')}`;
      
      await client.query(`UPDATE contracts SET contract_number = $2 WHERE id = $1`, [cid, cnum]);
      
      await client.query('COMMIT');
      const full = await query(`SELECT * FROM contracts WHERE id = $1`, [cid]);
      res.status(201).json({ contract: full.rows[0] });
    } catch (e) {
      await client.query('ROLLBACK');
      console.error(e);
      res.status(500).json({ error: e.message });
    } finally {
      client.release();
    }
  }
);

router.get('/contracts/:id', param('id').isInt(), async (req, res) => {
  const id = Number(req.params.id);
  const { rows } = await query(`SELECT * FROM contracts WHERE id = $1`, [id]);
  if (!rows[0]) return res.status(404).json({ error: 'Contract not found' });
  const vers = await query(`SELECT * FROM contract_versions WHERE contract_id = $1 ORDER BY version`, [id]);
  res.json({ contract: rows[0], versions: vers.rows });
});

router.patch(
  '/contracts/:id',
  requireRoles('super_admin', 'branch_manager', 'sales_manager', 'sales_executive', 'gm', 'finance'),
  param('id').isInt(),
  async (req, res) => {
    const id = Number(req.params.id);
    const sets = [];
    const vals = [];
    const fields = ['terms', 'status', 'flow', 'payment_deadline', 'expires_on', 'total_value'];
    
    fields.forEach(f => {
      if (req.body[f] !== undefined) {
        vals.push(req.body[f]);
        sets.push(`${f} = $${vals.length}`);
      }
    });

    if (sets.length === 0) return res.json({ message: 'No changes' });
    
    vals.push(req.user.id);
    sets.push(`updated_by = $${vals.length}`);
    sets.push(`updated_at = NOW()`);
    vals.push(id);
    
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
    
    // Fetch the contract to get the secure_token for the link
    const { rows: cRows } = await query('SELECT secure_token, contract_number FROM contracts WHERE id = $1', [id]);
    const contract = cRows[0];

    // Construct the public link
    const baseUrl = process.env.PUBLIC_APP_URL || 'http://localhost:5173';
    const publicLink = `${baseUrl}/public/contract/${contract.secure_token}`;
    
    const fullBody = `${body}\n\nView and digitally sign your contract here: ${publicLink}\n\nRegards,\nHotel Pramod Team`;

    try {
      await sendEmail({
        to: to_email,
        cc: cc_email,
        subject: subject,
        text: fullBody,
      });
    } catch (mailErr) {
      console.error('Contract mail delivery failed:', mailErr);
      return res.status(500).json({ error: 'Contract email dispatch failed.' });
    }

    await query(`UPDATE contracts SET status = 'sent', updated_by = $2, updated_at = NOW() WHERE id = $1`, [id, req.user.id]);
    
    const ccLog = cc_email ? `\nCC: ${cc_email}` : '';
    await query(
      `INSERT INTO contract_interactions (contract_id, sender_type, message, is_internal)
       VALUES ($1, 'agent', $2, $3)`,
      [id, `Contract formally dispatched via email.\nTo: ${to_email}${ccLog}\nSubject: ${subject}`, true]
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

export default router;
