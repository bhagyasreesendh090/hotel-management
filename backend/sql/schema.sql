-- Hotel Pramod Sales CRM & CRS — PostgreSQL schema (SRS v1.3 aligned)

BEGIN;

CREATE TABLE IF NOT EXISTS properties (
  id                SERIAL PRIMARY KEY,
  code              VARCHAR(16) NOT NULL UNIQUE,
  name              VARCHAR(255) NOT NULL,
  address           TEXT,
  gstin             VARCHAR(20),
  email_from        VARCHAR(255),
  document_logo     VARCHAR(64) NOT NULL DEFAULT 'pramod_hotels_resorts' CHECK (document_logo IN ('pramod_hotels_resorts','pramod_lands_end_radisson')),
  smtp_config       JSONB DEFAULT '{}',
  cancellation_policy_default TEXT,
  advance_rule_note TEXT,
  active            BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id                SERIAL PRIMARY KEY,
  email             VARCHAR(255) NOT NULL UNIQUE,
  password_hash     TEXT NOT NULL,
  full_name         VARCHAR(255) NOT NULL,
  role              VARCHAR(32) NOT NULL CHECK (role IN (
                      'super_admin','gm','sales_agent',
                      'branch_manager','sales_manager','sales_executive',
                      'banquet_coordinator','front_desk','finance'
                    )),
  phone             VARCHAR(32),
  active            BOOLEAN NOT NULL DEFAULT TRUE,
  two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_property_access (
  user_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  property_id       INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, property_id)
);

CREATE TABLE IF NOT EXISTS travel_agents (
  id                SERIAL PRIMARY KEY,
  agency_name       VARCHAR(255) NOT NULL,
  contact_name      VARCHAR(255),
  email             VARCHAR(255),
  phone             VARCHAR(64),
  iata_tids         VARCHAR(64),
  commission_pct    NUMERIC(5,2) DEFAULT 0,
  rate_plan_notes   JSONB DEFAULT '{}',
  active            BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS corporate_accounts (
  id                SERIAL PRIMARY KEY,
  company_name      VARCHAR(255) NOT NULL,
  address           TEXT,
  gstin             VARCHAR(20),
  primary_contact   VARCHAR(255),
  primary_email     VARCHAR(255),
  primary_phone     VARCHAR(64),
  alt_contact       VARCHAR(255),
  billing_mode      VARCHAR(16) NOT NULL DEFAULT 'advance' CHECK (billing_mode IN ('btc','advance')),
  rbi_rate_notes    TEXT,
  contract_rate_notes TEXT,
  kings_discount_pct NUMERIC(5,2),
  kings_discount_flat NUMERIC(12,2),
  rate_can_change   BOOLEAN NOT NULL DEFAULT FALSE,
  estimated_room_volume INTEGER,
  room_preferences  TEXT,
  special_terms     TEXT,
  active            BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS room_types (
  id                SERIAL PRIMARY KEY,
  property_id       INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  category          VARCHAR(64) NOT NULL,
  floor_wing        VARCHAR(64),
  occupancy_max     INTEGER NOT NULL DEFAULT 2,
  base_rate_rbi     NUMERIC(12,2) NOT NULL,
  gst_rate_override NUMERIC(5,2),
  add_on_options    JSONB DEFAULT '[]',
  amenities         JSONB DEFAULT '[]',
  extra_person_charge NUMERIC(12,2) DEFAULT 0,
  active            BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (property_id, category)
);

CREATE TABLE IF NOT EXISTS rooms (
  id                SERIAL PRIMARY KEY,
  property_id       INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  room_type_id      INTEGER NOT NULL REFERENCES room_types(id) ON DELETE CASCADE,
  room_number       VARCHAR(32) NOT NULL,
  status            VARCHAR(16) NOT NULL DEFAULT 'available' CHECK (status IN ('available','maintenance','blocked')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (property_id, room_number)
);

CREATE TABLE IF NOT EXISTS meal_plans (
  id                SERIAL PRIMARY KEY,
  property_id       INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  name              VARCHAR(128) NOT NULL,
  code              VARCHAR(16) NOT NULL,
  description       TEXT,
  per_person_rate   NUMERIC(12,2) NOT NULL DEFAULT 0,
  included_meals    JSONB DEFAULT '[]',
  items             JSONB DEFAULT '[]',
  active            BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (property_id, code)
);


CREATE TABLE IF NOT EXISTS room_blocks (
  id                SERIAL PRIMARY KEY,
  room_id           INTEGER REFERENCES rooms(id) ON DELETE CASCADE,
  property_id       INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  room_type_id      INTEGER REFERENCES room_types(id) ON DELETE SET NULL,
  start_date        DATE NOT NULL,
  end_date          DATE NOT NULL,
  reason            TEXT,
  slot_color        VARCHAR(16) DEFAULT 'red' CHECK (slot_color IN ('green','amber','blue','red')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (end_date >= start_date)
);

CREATE TABLE IF NOT EXISTS leads (
  id                SERIAL PRIMARY KEY,
  assigned_user_id  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  contact_name      VARCHAR(255) NOT NULL,
  contact_email     VARCHAR(255),
  contact_phone     VARCHAR(64),
  company           VARCHAR(255),
  segment           VARCHAR(32) NOT NULL CHECK (segment IN ('room','room_banquet','banquet_only')),
  inquiry_type      VARCHAR(32) NOT NULL CHECK (inquiry_type IN ('accommodation','event','combined')),
  hold_duration_note TEXT,
  lead_source       VARCHAR(32),
  interest_tags     JSONB DEFAULT '{}',
  pipeline_stage    VARCHAR(32) NOT NULL DEFAULT 'inquiry' CHECK (pipeline_stage IN (
                      'inquiry','quotation_sent','tentative_hold','negotiation','confirmed','lost'
                    )),
  status            VARCHAR(32) NOT NULL DEFAULT 'new' CHECK (status IN (
                      'new','in_progress','quotation_sent','negotiating','won','lost','dormant'
                    )),
  lost_reason       TEXT,
  notes             TEXT,
  duplicate_of_lead_id INTEGER REFERENCES leads(id) ON DELETE SET NULL,
  corporate_account_id INTEGER REFERENCES corporate_accounts(id) ON DELETE SET NULL,
  conversion_booking_id INTEGER,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lead_properties (
  lead_id           INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  property_id       INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  PRIMARY KEY (lead_id, property_id)
);

CREATE TABLE IF NOT EXISTS action_points (
  id                SERIAL PRIMARY KEY,
  lead_id           INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  task              TEXT NOT NULL,
  assignee_user_id  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  due_date          DATE,
  status            VARCHAR(16) NOT NULL DEFAULT 'open' CHECK (status IN ('open','done','escalated')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bookings (
  id                SERIAL PRIMARY KEY,
  property_id       INTEGER NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
  ds_number         VARCHAR(64),
  status            VARCHAR(16) NOT NULL DEFAULT 'INQ' CHECK (status IN (
                      'INQ','QTN-HOLD','TENT','CONF-U','CONF-P','SOLD','CXL','CI','CO'
                    )),
  booker_type       VARCHAR(32) CHECK (booker_type IN ('agent','corporate','individual','travel_agent')),
  booker_same_as_guest BOOLEAN NOT NULL DEFAULT FALSE,
  booker_name       VARCHAR(255),
  booker_email      VARCHAR(255),
  booker_phone      VARCHAR(64),
  booker_company    VARCHAR(255),
  guest_name        VARCHAR(255),
  guest_email       VARCHAR(255),
  guest_phone       VARCHAR(64),
  booking_source    VARCHAR(32),
  corporate_account_id INTEGER REFERENCES corporate_accounts(id) ON DELETE SET NULL,
  travel_agent_id   INTEGER REFERENCES travel_agents(id) ON DELETE SET NULL,
  lead_id           INTEGER REFERENCES leads(id) ON DELETE SET NULL,
  is_group          BOOLEAN NOT NULL DEFAULT FALSE,
  group_discount_note TEXT,
  kids_zone         BOOLEAN NOT NULL DEFAULT FALSE,
  special_notes     TEXT,
  sub_total         NUMERIC(14,2) DEFAULT 0,
  gst_amount        NUMERIC(14,2) DEFAULT 0,
  total_amount      NUMERIC(14,2) DEFAULT 0,
  advance_received  NUMERIC(14,2) DEFAULT 0,
  balance_due       NUMERIC(14,2) DEFAULT 0,
  billing_mode      VARCHAR(16) CHECK (billing_mode IN ('cash','card','upi','btc')),
  btc_flag          BOOLEAN NOT NULL DEFAULT FALSE,
  created_by        INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE leads
  ADD CONSTRAINT fk_leads_conversion_booking FOREIGN KEY (conversion_booking_id) REFERENCES bookings(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS booking_room_lines (
  id                SERIAL PRIMARY KEY,
  booking_id        INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  room_type_id      INTEGER NOT NULL REFERENCES room_types(id) ON DELETE RESTRICT,
  room_id           INTEGER REFERENCES rooms(id) ON DELETE SET NULL,
  check_in          DATE NOT NULL,
  check_out         DATE NOT NULL,
  adults            INTEGER NOT NULL DEFAULT 1,
  children          INTEGER NOT NULL DEFAULT 0,
  meal_plan         VARCHAR(16) NOT NULL CHECK (meal_plan IN ('CP','AP','MAP','ROOM_ONLY','CUSTOM')),
  rate_type         VARCHAR(24) NOT NULL CHECK (rate_type IN ('RBI','CONTRACT','GUEST','KINGS_DISCOUNT','SPECIFIC')),
  nightly_rate      NUMERIC(12,2) NOT NULL,
  rate_override_note TEXT,
  add_ons           JSONB DEFAULT '[]',
  complimentaries JSONB DEFAULT '[]',
  line_sub_total    NUMERIC(14,2) NOT NULL DEFAULT 0,
  line_gst          NUMERIC(14,2) NOT NULL DEFAULT 0,
  line_total        NUMERIC(14,2) NOT NULL DEFAULT 0,
  CHECK (check_out > check_in)
);

CREATE TABLE IF NOT EXISTS ds_sequences (
  property_id       INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  financial_year    VARCHAR(16) NOT NULL,
  last_number       INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (property_id, financial_year)
);

CREATE TABLE IF NOT EXISTS quotations (
  id                SERIAL PRIMARY KEY,
  lead_id           INTEGER REFERENCES leads(id) ON DELETE SET NULL,
  property_id       INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  quotation_number  VARCHAR(64) NOT NULL,
  client_salutation VARCHAR(64) DEFAULT 'Dear Sir / Ma''am',
  validity_days     INTEGER DEFAULT 7,
  status            VARCHAR(24) NOT NULL DEFAULT 'draft' CHECK (status IN (
                      'draft','sent','viewed','accepted','rejected','revised'
                    )),
  financial_summary JSONB DEFAULT '{}',
  policies          JSONB DEFAULT '{}',
  valid_until     DATE,
  secure_token    UUID DEFAULT gen_random_uuid(),
  total_amount    NUMERIC(14,2) DEFAULT 0,
  tax_amount      NUMERIC(14,2) DEFAULT 0,
  discount_amount NUMERIC(14,2) DEFAULT 0,
  final_amount    NUMERIC(14,2) DEFAULT 0,
  approved_by     INTEGER REFERENCES users(id),
  updated_by      INTEGER REFERENCES users(id),
  viewed_at       TIMESTAMPTZ,
  view_count      INTEGER DEFAULT 0,
  created_by      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (property_id, quotation_number)
);

CREATE TABLE IF NOT EXISTS quotation_versions (
  id                SERIAL PRIMARY KEY,
  quotation_id      INTEGER NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
  version           INTEGER NOT NULL,
  snapshot          JSONB NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (quotation_id, version)
);

CREATE TABLE IF NOT EXISTS contracts (
  id                SERIAL PRIMARY KEY,
  booking_id        INTEGER REFERENCES bookings(id) ON DELETE SET NULL,
  lead_id           INTEGER REFERENCES leads(id) ON DELETE SET NULL,
  corporate_account_id INTEGER REFERENCES corporate_accounts(id) ON DELETE SET NULL,
  flow              VARCHAR(24) NOT NULL DEFAULT 'hotel_proposes' CHECK (flow IN ('hotel_proposes','client_submits')),
  pdf_url           TEXT,
  terms             TEXT,
  payment_deadline  DATE,
  btc_letter_url    TEXT,
  signed_ack        TEXT,
  expires_on        DATE,
  property_id       INTEGER REFERENCES properties(id),
  secure_token      UUID DEFAULT gen_random_uuid(),
  status            VARCHAR(24) DEFAULT 'draft',
  total_value       NUMERIC(14,2) DEFAULT 0,
  updated_by        INTEGER REFERENCES users(id),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  viewed_at         TIMESTAMPTZ,
  view_count        INTEGER DEFAULT 0,
  contract_number   VARCHAR(64),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contract_versions (
  id                SERIAL PRIMARY KEY,
  contract_id      INTEGER NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  version           INTEGER NOT NULL,
  snapshot          JSONB NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (contract_id, version)
);

CREATE TABLE IF NOT EXISTS quotation_interactions (
  id                SERIAL PRIMARY KEY,
  quotation_id      INTEGER NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
  sender_type       VARCHAR(16) CHECK (sender_type IN ('agent', 'client')),
  message           TEXT NOT NULL,
  is_internal       BOOLEAN DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contract_interactions (
  id                SERIAL PRIMARY KEY,
  contract_id      INTEGER NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  sender_type       VARCHAR(16) CHECK (sender_type IN ('agent', 'client')),
  message           TEXT NOT NULL,
  is_internal       BOOLEAN DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS venues (
  id                SERIAL PRIMARY KEY,
  property_id       INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  name              VARCHAR(255) NOT NULL,
  venue_type        VARCHAR(32) NOT NULL CHECK (venue_type IN ('banquet_hall','lawn','conference_room','terrace','other')),
  capacity_min      INTEGER,
  capacity_max      INTEGER,
  floor_plan_notes  TEXT,
  active            BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS venue_time_slots (
  id                SERIAL PRIMARY KEY,
  property_id       INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  venue_id          INTEGER REFERENCES venues(id) ON DELETE CASCADE,
  label             VARCHAR(64) NOT NULL,
  start_time        TIME NOT NULL,
  end_time          TIME NOT NULL,
  session_kind      VARCHAR(24) CHECK (session_kind IN ('morning','afternoon','evening','full_day','custom')),
  UNIQUE (venue_id, label)
);

CREATE TABLE IF NOT EXISTS banquet_bookings (
  id                SERIAL PRIMARY KEY,
  property_id       INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  venue_id          INTEGER NOT NULL REFERENCES venues(id) ON DELETE RESTRICT,
  event_date        DATE NOT NULL,
  venue_slot_id     INTEGER REFERENCES venue_time_slots(id) ON DELETE SET NULL,
  event_category    VARCHAR(24) NOT NULL CHECK (event_category IN ('corporate','social','group')),
  event_sub_type    VARCHAR(64),
  with_room         BOOLEAN NOT NULL DEFAULT FALSE,
  linked_booking_id INTEGER REFERENCES bookings(id) ON DELETE SET NULL,
  status            VARCHAR(16) NOT NULL DEFAULT 'INQ' CHECK (status IN (
                      'INQ','QTN-HOLD','TENT','CONF-U','CONF-P','CXL'
                    )),
  slot_color        VARCHAR(16) DEFAULT 'red' CHECK (slot_color IN ('red','amber','blue')),
  guaranteed_pax    INTEGER,
  actual_pax        INTEGER,
  menu_package      VARCHAR(32),
  pricing           JSONB DEFAULT '{}',
  gst_split         JSONB DEFAULT '{}',
  lead_id           INTEGER REFERENCES leads(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Maintenance / buffer blocks for venue sessions
CREATE TABLE IF NOT EXISTS venue_maintenance_blocks (
  id                SERIAL PRIMARY KEY,
  venue_id          INTEGER NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  property_id       INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  venue_slot_id     INTEGER REFERENCES venue_time_slots(id) ON DELETE CASCADE,
  block_date        DATE NOT NULL,
  reason            TEXT NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS corporate_rate_lines (
  id                SERIAL PRIMARY KEY,
  corporate_account_id INTEGER NOT NULL REFERENCES corporate_accounts(id) ON DELETE CASCADE,
  property_id       INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  room_type_id      INTEGER REFERENCES room_types(id) ON DELETE CASCADE,
  contract_rate     NUMERIC(12,2) NOT NULL,
  valid_from        DATE,
  valid_to          DATE,
  session_notes     TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS invoices (
  id                SERIAL PRIMARY KEY,
  property_id       INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  booking_id        INTEGER REFERENCES bookings(id) ON DELETE SET NULL,
  banquet_booking_id INTEGER REFERENCES banquet_bookings(id) ON DELETE SET NULL,
  ds_number         VARCHAR(64) NOT NULL,
  invoice_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  transaction_date  DATE,
  guest_snapshot    JSONB DEFAULT '{}',
  line_items        JSONB DEFAULT '[]',
  sub_total         NUMERIC(14,2) NOT NULL,
  cgst              NUMERIC(14,2) NOT NULL DEFAULT 0,
  sgst              NUMERIC(14,2) NOT NULL DEFAULT 0,
  gst_total         NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_amount      NUMERIC(14,2) NOT NULL,
  advance_applied   NUMERIC(14,2) DEFAULT 0,
  balance_due       NUMERIC(14,2) NOT NULL,
  status            VARCHAR(16) NOT NULL DEFAULT 'outstanding' CHECK (status IN ('paid','partial','outstanding','cancelled')),
  reprint_count     INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (property_id, ds_number)
);

CREATE TABLE IF NOT EXISTS payments (
  id                SERIAL PRIMARY KEY,
  booking_id        INTEGER REFERENCES bookings(id) ON DELETE CASCADE,
  banquet_booking_id INTEGER REFERENCES banquet_bookings(id) ON DELETE SET NULL,
  amount            NUMERIC(14,2) NOT NULL,
  mode              VARCHAR(16) NOT NULL CHECK (mode IN ('cash','card','upi','btc','bank_transfer')),
  payment_type      VARCHAR(24) NOT NULL CHECK (payment_type IN ('advance','balance','full_prepay','refund')),
  reference         VARCHAR(128),
  recorded_by       INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cancellations (
  id                SERIAL PRIMARY KEY,
  booking_id        INTEGER REFERENCES bookings(id) ON DELETE CASCADE,
  cancelled_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  amount_forfeited  NUMERIC(14,2) DEFAULT 0,
  refund_due        NUMERIC(14,2) DEFAULT 0,
  finance_approved  BOOLEAN NOT NULL DEFAULT FALSE,
  notes             TEXT
);

CREATE TABLE IF NOT EXISTS email_templates (
  id                SERIAL PRIMARY KEY,
  property_id       INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  comm_type         VARCHAR(48) NOT NULL,
  subject           VARCHAR(512) NOT NULL,
  body_html         TEXT NOT NULL,
  cc_default        TEXT,
  bcc_default       TEXT,
  UNIQUE (property_id, comm_type)
);

CREATE TABLE IF NOT EXISTS notifications (
  id                SERIAL PRIMARY KEY,
  user_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type              VARCHAR(48) NOT NULL,
  payload           JSONB DEFAULT '{}',
  read_at           TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id                BIGSERIAL PRIMARY KEY,
  user_id           INTEGER REFERENCES users(id) ON DELETE SET NULL,
  entity            VARCHAR(64) NOT NULL,
  entity_id         VARCHAR(64),
  action            VARCHAR(24) NOT NULL,
  before_json       JSONB,
  after_json        JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rate_change_requests (
  id                SERIAL PRIMARY KEY,
  corporate_account_id INTEGER NOT NULL REFERENCES corporate_accounts(id) ON DELETE CASCADE,
  requested_by      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  payload           JSONB NOT NULL,
  status            VARCHAR(16) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  decided_by        INTEGER REFERENCES users(id) ON DELETE SET NULL,
  decided_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bookings_property_dates ON bookings(property_id);
CREATE INDEX IF NOT EXISTS idx_booking_lines_room_type ON booking_room_lines(room_type_id);
CREATE INDEX IF NOT EXISTS idx_booking_lines_dates ON booking_room_lines(check_in, check_out);
CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads(contact_phone);
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(contact_email);
CREATE INDEX IF NOT EXISTS idx_banquet_venue_date ON banquet_bookings(venue_id, event_date);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity, entity_id);

COMMIT;
