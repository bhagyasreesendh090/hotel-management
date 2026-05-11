import { Router } from 'express';
import { body, param, query as qv, validationResult } from 'express-validator';
import { pool, query } from '../db/pool.js';
import { availabilityCalendarByRoomType, roomTypeMinimumAvailability } from '../services/availability.js';
import { calcLineAmounts, nightsBetween, roomGstPercent } from '../services/financial.js';

const router = Router();

function slugFromCode(code) {
  return String(code || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-');
}

async function resolvePropertyByRef(ref) {
  const raw = String(ref || '').trim();
  if (!raw) return null;
  const { rows } = await query(
    `SELECT id, code, name, advance_rule_note, cancellation_policy_default
     FROM properties
     WHERE active = TRUE
       AND (
         LOWER(TRIM(code)) = LOWER(TRIM($1))
         OR CAST(id AS TEXT) = $1
       )
     LIMIT 1`,
    [raw]
  );
  return rows[0] ?? null;
}

function ymd(d) {
  const x = d instanceof Date ? d : new Date(d);
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, '0');
  const day = String(x.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function monthBounds(monthStr) {
  const [ys, ms] = monthStr.split('-');
  const y = Number(ys);
  const m = Number(ms);
  if (!y || !m || m < 1 || m > 12) return null;
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 0);
  return { start, end };
}

/** @param {import('pg').PoolClient} client */
async function resolveNightlyRate(client, line, corporateAccountId) {
  if (line.nightly_rate != null && line.nightly_rate !== '') {
    return Number(line.nightly_rate);
  }
  const { rows } = await client.query(`SELECT base_rate_rbi FROM room_types WHERE id = $1`, [line.room_type_id]);
  const base = Number(rows[0]?.base_rate_rbi ?? 0);
  if (line.rate_type === 'CONTRACT' && corporateAccountId) {
    const cr = await client.query(
      `SELECT contract_rate FROM corporate_rate_lines
       WHERE corporate_account_id = $1 AND room_type_id = $2
       ORDER BY valid_from DESC NULLS LAST LIMIT 1`,
      [corporateAccountId, line.room_type_id]
    );
    if (cr.rows[0]) return Number(cr.rows[0].contract_rate);
  }
  return base;
}

router.get('/properties', async (_req, res) => {
  const { rows } = await query(
    `SELECT id, code, name FROM properties WHERE active = TRUE ORDER BY code`
  );
  const properties = rows.map((r) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    slug: slugFromCode(r.code),
  }));
  res.json({ properties });
});

router.get(
  '/properties/:propertyRef/monthly-availability',
  param('propertyRef').isString(),
  qv('month').optional().matches(/^\d{4}-\d{2}$/),
  qv('startDate').optional().isISO8601(),
  qv('endDate').optional().isISO8601(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.error('Validation errors for availability:', errors.array());
      return res.status(400).json({ errors: errors.array() });
    }

    const property = await resolvePropertyByRef(req.params.propertyRef);
    if (!property) return res.status(404).json({ error: 'Property not found' });

    let start, end;
    if (req.query.startDate && req.query.endDate) {
      start = new Date(req.query.startDate);
      end = new Date(req.query.endDate);
    } else {
      const monthStr = req.query.month || ymd(new Date()).substring(0, 7);
      const bounds = monthBounds(monthStr);
      if (!bounds) return res.status(400).json({ error: 'Invalid month (use yyyy-MM)' });
      start = bounds.start;
      end = bounds.end;
    }

    const calRows = await availabilityCalendarByRoomType(property.id, start, end);

    const summaryByDay = new Map();
    const roomTypeMap = new Map();

    for (const r of calRows) {
      const dateStr = ymd(r.day);
      if (!summaryByDay.has(dateStr)) {
        summaryByDay.set(dateStr, { date: dateStr, total_available: 0, total_booked: 0, total_blocked: 0 });
      }
      const s = summaryByDay.get(dateStr);
      s.total_available += Number(r.available_units ?? 0);
      s.total_booked += Number(r.booked_units ?? 0);
      s.total_blocked += Number(r.blocked_units ?? 0);

      if (!roomTypeMap.has(r.room_type_id)) {
        roomTypeMap.set(r.room_type_id, {
          room_type_id: r.room_type_id,
          category: r.category,
          base_rate_rbi: Number(r.base_rate_rbi),
          occupancy_max: Number(r.occupancy_max),
          total_rooms: Number(r.total_rooms),
          add_on_options: Array.isArray(r.add_on_options) ? r.add_on_options : [],
          days: {},
        });
      }
      const rt = roomTypeMap.get(r.room_type_id);
      rt.days[dateStr] = {
        available_units: Number(r.available_units),
        booked_units: Number(r.booked_units),
        blocked_units: Number(r.blocked_units),
      };
    }

    const summary = [];
    const cur = new Date(start);
    while (cur <= end) {
      const key = ymd(cur);
      summary.push(
        summaryByDay.get(key) ?? { date: key, total_available: 0, total_booked: 0, total_blocked: 0 }
      );
      cur.setDate(cur.getDate() + 1);
    }

    res.json({
      property: {
        id: property.id,
        code: property.code,
        name: property.name,
        advance_rule_note: property.advance_rule_note,
        cancellation_policy_default: property.cancellation_policy_default,
      },
      startDate: ymd(start),
      endDate: ymd(end),
      room_types: [...roomTypeMap.values()],
      summary,
    });
  }
);

router.post(
  '/properties/:propertyRef/bookings',
  param('propertyRef').isString(),
  body('guest_name').isString(),
  body('guest_phone').isString(),
  body('room_type_id').isInt(),
  body('check_in').isISO8601().toDate(),
  body('check_out').isISO8601().toDate(),
  body('adults').isInt({ min: 1 }),
  body('children').optional({ values: 'null' }).isInt({ min: 0 }),
  body('meal_plan').isIn(['CP', 'AP', 'MAP', 'ROOM_ONLY', 'CUSTOM']),
  body('advance_received').optional({ values: 'null' }).isFloat(),
  body('advance_mode').optional({ values: 'null' }).isIn(['cash', 'card', 'upi', 'bank_transfer', 'btc']),
  body('payment_reference').optional({ values: 'null' }).isString(),
  body('guest_email').optional({ values: 'null' }).isString(),
  body('special_notes').optional({ values: 'null' }).isString(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const property = await resolvePropertyByRef(req.params.propertyRef);
    if (!property) return res.status(404).json({ error: 'Property not found' });

    const propertyId = property.id;
    const roomTypeId = Number(req.body.room_type_id);
    const rtCheck = await query(
      `SELECT id, category FROM room_types WHERE id = $1 AND property_id = $2 AND active = TRUE`,
      [roomTypeId, propertyId]
    );
    const roomType = rtCheck.rows[0];
    if (!roomType) return res.status(400).json({ error: 'Invalid room type for this property' });

    const line = {
      room_type_id: roomTypeId,
      check_in: req.body.check_in,
      check_out: req.body.check_out,
      adults: Number(req.body.adults),
      children: Number(req.body.children ?? 0),
      meal_plan: req.body.meal_plan,
      rate_type: 'RBI',
    };

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const minAvailable = await roomTypeMinimumAvailability(
        propertyId,
        roomTypeId,
        line.check_in,
        line.check_out
      );
      if (minAvailable < 1) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          error: `No rooms available for ${roomType.category} on the selected dates.`,
        });
      }

      const ins = await client.query(
        `INSERT INTO bookings (
          property_id, status, booker_type, booker_same_as_guest,
          booker_name, booker_email, booker_phone, booker_company,
          guest_name, guest_email, guest_phone, booking_source,
          corporate_account_id, travel_agent_id, lead_id,
          is_group, group_discount_note, kids_zone, special_notes,
          advance_received, btc_flag, created_by
        ) VALUES (
          $1, CASE WHEN COALESCE($6, 0) > 0 THEN 'CONF-P' ELSE 'TENT' END, 'individual', true,
          $2, $3, $4, NULL,
          $2, $3, $4, 'public_link',
          NULL, NULL, NULL,
          false, NULL, false, $5,
          COALESCE($6, 0), false, NULL
        ) RETURNING *`,
        [
          propertyId,
          req.body.guest_name,
          req.body.guest_email ?? null,
          req.body.guest_phone,
          req.body.special_notes ?? null,
          Number(req.body.advance_received ?? 0),
        ]
      );
      const booking = ins.rows[0];

      const nights = nightsBetween(line.check_in, line.check_out);
      const pax = Number(line.adults ?? 1) + Number(line.children ?? 0);
      const nightly = await resolveNightlyRate(client, line, null);
      const rtRow = await client.query(`SELECT gst_rate_override FROM room_types WHERE id = $1`, [
        line.room_type_id,
      ]);
      const gstPct = roomGstPercent(nightly, rtRow.rows[0]?.gst_rate_override);
      const { line_sub_total, line_gst, line_total } = calcLineAmounts({
        nightlyRate: nightly,
        nights,
        pax,
        gstPct,
      });

      await client.query(
        `INSERT INTO booking_room_lines (
          booking_id, room_type_id, room_id, check_in, check_out,
          adults, children, meal_plan, rate_type, nightly_rate, rate_override_note,
          add_ons, complimentaries, line_sub_total, line_gst, line_total
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
        [
          booking.id,
          line.room_type_id,
          null,
          line.check_in,
          line.check_out,
          line.adults ?? 1,
          line.children ?? 0,
          line.meal_plan,
          line.rate_type,
          nightly,
          null,
          JSON.stringify([]),
          JSON.stringify([]),
          line_sub_total,
          line_gst,
          line_total,
        ]
      );

      const subTotal = line_sub_total;
      const gstTotal = line_gst;
      const total = line_total;
      const adv = Number(req.body.advance_received ?? 0);
      const balanceDue = Math.max(0, total - adv);

      await client.query(
        `UPDATE bookings SET sub_total = $1, gst_amount = $2, total_amount = $3, advance_received = $4, balance_due = $5, updated_at = NOW()
         WHERE id = $6`,
        [subTotal, gstTotal, total, adv, balanceDue, booking.id]
      );

      const leadNotes = [
        `Public booking inquiry for ${property.name}`,
        `Room type: ${roomType.category}`,
        `Stay: ${ymd(line.check_in)} to ${ymd(line.check_out)}`,
        `Guests: ${line.adults} adult(s), ${line.children} child(ren)`,
        `Meal plan: ${line.meal_plan}`,
        req.body.special_notes ? `Notes: ${req.body.special_notes}` : null,
      ]
        .filter(Boolean)
        .join('\n');

      const leadInsert = await client.query(
        `INSERT INTO leads (
          assigned_user_id, contact_name, contact_email, contact_phone, company,
          segment, inquiry_type, hold_duration_note, lead_source, interest_tags,
          pipeline_stage, status, notes, duplicate_of_lead_id, corporate_account_id,
          conversion_booking_id
        ) VALUES (
          NULL, $1, $2, $3, NULL,
          'room', 'accommodation', NULL, 'public_link', $4,
          $5, $6, $7, NULL, NULL,
          $8
        )
        RETURNING *`,
        [
          req.body.guest_name,
          req.body.guest_email ?? null,
          req.body.guest_phone,
          JSON.stringify({
            room_type_id: roomTypeId,
            meal_plan: line.meal_plan,
            source: 'public_booking',
          }),
          adv > 0 ? 'confirmed' : 'inquiry',
          adv > 0 ? 'won' : 'new',
          leadNotes,
          booking.id,
        ]
      );
      const lead = leadInsert.rows[0];

      await client.query(
        `INSERT INTO lead_properties (lead_id, property_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [lead.id, propertyId]
      );

      await client.query(
        `UPDATE bookings SET lead_id = $2, updated_at = NOW() WHERE id = $1`,
        [booking.id, lead.id]
      );

      if (adv > 0) {
        await client.query(
          `INSERT INTO payments (
            booking_id, amount, mode, payment_type, reference, recorded_by
          ) VALUES ($1,$2,$3,'advance',$4,NULL)`,
          [
            booking.id,
            adv,
            req.body.advance_mode ?? 'cash',
            req.body.payment_reference ?? null,
          ]
        );
      }

      await client.query('COMMIT');
      const b = (await query(`SELECT * FROM bookings WHERE id = $1`, [booking.id])).rows[0];
      res.status(201).json({ booking: b, lead });
    } catch (e) {
      await client.query('ROLLBACK');
      console.error(e);
      res.status(500).json({ error: e.message || 'Booking failed' });
    } finally {
      client.release();
    }
  }
);

/* ── PUBLIC QUOTATIONS ──────────────────────────────────────────────────────── */

router.get('/quotations/:token', async (req, res) => {
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
    
    const prop = await client.query(`SELECT name, address, email_from, document_logo FROM properties WHERE id = $1`, [quote.property_id]);
    const vers = await client.query(`SELECT version, snapshot, created_at FROM quotation_versions WHERE quotation_id = $1 ORDER BY version DESC LIMIT 1`, [quote.id]);
    const interactions = await client.query(`SELECT sender_type, message, created_at FROM quotation_interactions WHERE quotation_id = $1 AND is_internal = FALSE ORDER BY created_at ASC`, [quote.id]);
    
    let lead = null;
    if (quote.lead_id) {
      const lr = await client.query(`SELECT contact_name, contact_email, contact_phone FROM leads WHERE id = $1`, [quote.lead_id]);
      lead = lr.rows[0];
    }

    await client.query('COMMIT');

    res.json({
      quotation: quote,
      property: prop.rows[0],
      latest_version: vers.rows[0],
      interactions: interactions.rows,
      lead: lead
    });
  } catch(e) {
    await client.query('ROLLBACK');
    res.status(500).json({error: e.message});
  } finally {
    client.release();
  }
});

router.post('/quotations/:token/interact', async (req, res) => {
  const { token } = req.params;
  const { message, action } = req.body;
  const { rows } = await query(`SELECT id, status, lead_id FROM quotations WHERE secure_token = $1`, [token]);
  if (!rows[0]) return res.status(404).json({ error: 'Not found' });
  const quote = rows[0];
  
  if (action === 'accept') {
    await query(`UPDATE quotations SET status = 'accepted', updated_at = NOW() WHERE id = $1`, [quote.id]);
    if (quote.lead_id) {
      await query(`UPDATE leads SET pipeline_stage = 'confirmed', updated_at = NOW() WHERE id = $1`, [quote.lead_id]);
      
      // Put associated room bookings on HOLD
      await query(`
        UPDATE bookings 
        SET status = 'TENT', updated_at = NOW() 
        WHERE lead_id = $1 AND status IN ('INQ', 'QTN-HOLD')
      `, [quote.lead_id]);
      
      // Put associated banquet bookings on HOLD
      await query(`
        UPDATE banquet_bookings 
        SET status = 'TENT', updated_at = NOW() 
        WHERE lead_id = $1 AND status IN ('INQ', 'QTN-HOLD')
      `, [quote.lead_id]);
    }
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

router.post('/quotations/:token/pay-demo', async (req, res) => {
  const { token } = req.params;
  const { amount, type } = req.body; // type: 'full' or 'advance'
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(`SELECT id, lead_id, final_amount FROM quotations WHERE secure_token = $1`, [token]);
    if (!rows[0]) return res.status(404).json({ error: 'Quotation not found' });
    const quote = rows[0];
    
    if (!quote.lead_id) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'No associated lead for this quotation' });
    }
    
    const payAmount = Number(amount);
    if (isNaN(payAmount) || payAmount <= 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Invalid payment amount' });
    }
    
    // Process payment for Room Bookings
    const bookings = await client.query(`SELECT id, advance_received, total_amount FROM bookings WHERE lead_id = $1 AND status = 'TENT'`, [quote.lead_id]);
    for (const b of bookings.rows) {
      const newAdvance = Number(b.advance_received ?? 0) + payAmount;
      const newStatus = 'CONF-P'; // Paid advance
      
      await client.query(`UPDATE bookings SET advance_received = $1, status = $2, updated_at = NOW() WHERE id = $3`, [newAdvance, newStatus, b.id]);
      await client.query(
        `INSERT INTO payments (booking_id, amount, mode, payment_type, reference, recorded_by) VALUES ($1, $2, 'card', 'advance', 'DEMO_WEB_PAY', NULL)`,
        [b.id, payAmount]
      );
    }
    
    // Process payment for Banquet Bookings
    const banquets = await client.query(`SELECT id FROM banquet_bookings WHERE lead_id = $1 AND status = 'TENT'`, [quote.lead_id]);
    for (const bb of banquets.rows) {
      await client.query(`UPDATE banquet_bookings SET status = 'CONF-P', updated_at = NOW() WHERE id = $1`, [bb.id]);
      await client.query(
        `INSERT INTO payments (banquet_booking_id, amount, mode, payment_type, reference, recorded_by) VALUES ($1, $2, 'card', 'advance', 'DEMO_WEB_PAY', NULL)`,
        [bb.id, payAmount]
      );
    }
    
    // Update quotation status to hide the payment UI
    await client.query(`UPDATE quotations SET status = 'paid', updated_at = NOW() WHERE id = $1`, [quote.id]);
    
    await client.query('COMMIT');
    res.json({ success: true, message: 'Payment processed successfully' });
  } catch(e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

/* ── PUBLIC CONTRACTS ───────────────────────────────────────────────────────── */

router.get('/contracts/:token', async (req, res) => {
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
    
    // Default to property 1 if not linked
    const propId = contract.property_id || 1; 
    const prop = await client.query(`SELECT name, address, email_from, document_logo FROM properties WHERE id = $1`, [propId]);
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

router.post('/contracts/:token/interact', async (req, res) => {
  const { token } = req.params;
  const { message, action } = req.body;
  const { rows } = await query(`SELECT id, status, lead_id FROM contracts WHERE secure_token = $1`, [token]);
  if (!rows[0]) return res.status(404).json({ error: 'Not found' });
  const contract = rows[0];
  
  if (action === 'accept') {
    await query(`UPDATE contracts SET status = 'accepted', signed_ack = 'Client Electronically Signed', updated_at = NOW() WHERE id = $1`, [contract.id]);
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
