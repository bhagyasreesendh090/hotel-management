/**
 * Migration: CRM Call Tracking & Follow-up tables
 * Run once:  node migrate_crm_calls.mjs
 */
import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, 'backend', '.env') });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const sql = `
-- ── call_logs ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS call_logs (
  id              SERIAL PRIMARY KEY,
  lead_id         INT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  agent_user_id   INT NOT NULL,
  outcome         TEXT CHECK (outcome IN ('no_answer','interested','call_later','not_interested','connected')),
  notes           TEXT,
  duration_sec    INT,
  called_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_call_logs_lead ON call_logs(lead_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_agent ON call_logs(agent_user_id);

-- ── lead_activities (unified timeline) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS lead_activities (
  id              SERIAL PRIMARY KEY,
  lead_id         INT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  agent_user_id   INT,
  activity_type   TEXT NOT NULL CHECK (activity_type IN ('call','note','status_change','quote_sent','follow_up_set','follow_up_done')),
  payload         JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_lead_activities_lead ON lead_activities(lead_id);

-- ── follow_ups ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS follow_ups (
  id              SERIAL PRIMARY KEY,
  lead_id         INT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  agent_user_id   INT NOT NULL,
  scheduled_at    TIMESTAMPTZ NOT NULL,
  notes           TEXT,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','missed')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_follow_ups_agent ON follow_ups(agent_user_id, status);
CREATE INDEX IF NOT EXISTS idx_follow_ups_lead ON follow_ups(lead_id);

-- ── denormalized counters on leads ──────────────────────────────────────
ALTER TABLE leads ADD COLUMN IF NOT EXISTS call_attempts INT NOT NULL DEFAULT 0;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS next_followup_at TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_call_outcome TEXT;
`;

const client = await pool.connect();
try {
  await client.query('BEGIN');
  await client.query(sql);
  await client.query('COMMIT');
  console.log('✅  CRM call-tracking migration complete.');
} catch (err) {
  await client.query('ROLLBACK');
  console.error('❌  Migration failed:', err.message);
  process.exit(1);
} finally {
  client.release();
  await pool.end();
}
