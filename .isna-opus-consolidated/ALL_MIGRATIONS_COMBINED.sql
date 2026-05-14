-- ============================================================
-- ISNA OPUS CONSOLIDATED — ALL 14 MIGRATIONS
-- Generated: 2026-05-13
-- Project: cimolace (fwfupxvmwtxbtbjdeqvu)
-- Run this in Supabase SQL Editor:
--   https://supabase.com/dashboard/project/fwfupxvmwtxbtbjdeqvu/sql/new
-- ============================================================

BEGIN;

-- ── Migration 1/14: 20250505000001_tenants.sql ──

CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  owner_user_id UUID REFERENCES auth.users(id),
  status TEXT DEFAULT 'active',
  plan TEXT DEFAULT 'free',
  billing_status TEXT DEFAULT 'unpaid',
  primary_domain TEXT,
  logo_url TEXT,
  brand_colors JSONB DEFAULT '{}',
  timezone TEXT DEFAULT 'UTC',
  locale TEXT DEFAULT 'fr',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tenant_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'student',
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_owner ON tenants(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_tenant ON tenant_memberships(tenant_id);
CREATE INDEX IF NOT EXISTS idx_memberships_user ON tenant_memberships(user_id);

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_memberships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant visible par membres" ON tenants;
CREATE POLICY "Tenant visible par membres" ON tenants
  FOR SELECT USING (
    EXISTS(SELECT 1 FROM tenant_memberships WHERE tenant_id = id AND user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Tenant modifiable par owner/admin" ON tenants;
CREATE POLICY "Tenant modifiable par owner/admin" ON tenants
  FOR UPDATE USING (
    EXISTS(SELECT 1 FROM tenant_memberships WHERE tenant_id = id AND user_id = auth.uid() AND role IN ('owner','admin'))
  );

DROP POLICY IF EXISTS "Membership visible par soi-même" ON tenant_memberships;
CREATE POLICY "Membership visible par soi-même" ON tenant_memberships
  FOR SELECT USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tenants_updated_at ON tenants;
CREATE TRIGGER tenants_updated_at
  BEFORE UPDATE ON tenants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ── Migration 2/14: 20250505000002_access_passes.sql ──

CREATE TABLE IF NOT EXISTS access_passes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  user_id UUID REFERENCES auth.users(id),
  resource_type TEXT NOT NULL,
  resource_id UUID NOT NULL,
  payment_id TEXT,
  status TEXT DEFAULT 'active',
  granted_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_access_passes_user ON access_passes(user_id);
CREATE INDEX IF NOT EXISTS idx_access_passes_resource ON access_passes(resource_type, resource_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_access_passes_unique_tenant_user_resource
  ON access_passes(tenant_id, user_id, resource_type, resource_id);

ALTER TABLE access_passes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Access pass visible par propriétaire" ON access_passes;
CREATE POLICY "Access pass visible par propriétaire" ON access_passes
  FOR SELECT USING (user_id = auth.uid());


-- ── Migration 3/14: 20250505000003_live_sessions.sql ──

CREATE TABLE IF NOT EXISTS live_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  host_user_id UUID REFERENCES auth.users(id) NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL,
  price_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'EUR',
  capacity INTEGER,
  status TEXT NOT NULL DEFAULT 'draft',
  livekit_room_name TEXT UNIQUE,
  replay_enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_live_sessions_tenant ON live_sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_live_sessions_scheduled ON live_sessions(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_live_sessions_status ON live_sessions(tenant_id, status);

ALTER TABLE live_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Live session visible par membres tenant" ON live_sessions;
CREATE POLICY "Live session visible par membres tenant" ON live_sessions
  FOR SELECT USING (
    EXISTS(
      SELECT 1 FROM tenant_memberships
      WHERE tenant_id = live_sessions.tenant_id
        AND user_id = auth.uid()
        AND status = 'active'
    )
  );

DROP POLICY IF EXISTS "Live session modifiable par staff tenant" ON live_sessions;
CREATE POLICY "Live session modifiable par staff tenant" ON live_sessions
  FOR ALL USING (
    EXISTS(
      SELECT 1 FROM tenant_memberships
      WHERE tenant_id = live_sessions.tenant_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin', 'teacher')
        AND status = 'active'
    )
  );

DROP TRIGGER IF EXISTS live_sessions_updated_at ON live_sessions;
CREATE TRIGGER live_sessions_updated_at
  BEFORE UPDATE ON live_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ── Migration 4/14: 20250505000004_marketing.sql ──

CREATE TABLE IF NOT EXISTS promo_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  code TEXT NOT NULL,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percent', 'fixed')),
  discount_value INTEGER NOT NULL,
  max_uses INTEGER,
  uses_count INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, code)
);

CREATE TABLE IF NOT EXISTS popups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('exit_intent', 'scroll', 'time')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS banners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  text TEXT NOT NULL,
  cta_url TEXT NOT NULL,
  cta_label TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_promo_codes_tenant ON promo_codes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_popups_tenant ON popups(tenant_id);
CREATE INDEX IF NOT EXISTS idx_banners_tenant ON banners(tenant_id);

ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE popups ENABLE ROW LEVEL SECURITY;
ALTER TABLE banners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Promo code visible par membres tenant" ON promo_codes;
CREATE POLICY "Promo code visible par membres tenant" ON promo_codes
  FOR SELECT USING (
    EXISTS(SELECT 1 FROM tenant_memberships WHERE tenant_id = promo_codes.tenant_id AND user_id = auth.uid() AND status = 'active')
  );

DROP POLICY IF EXISTS "Promo code modifiable par staff tenant" ON promo_codes;
CREATE POLICY "Promo code modifiable par staff tenant" ON promo_codes
  FOR ALL USING (
    EXISTS(SELECT 1 FROM tenant_memberships WHERE tenant_id = promo_codes.tenant_id AND user_id = auth.uid() AND role IN ('owner','admin') AND status = 'active')
  );

DROP POLICY IF EXISTS "Popup visible par membres tenant" ON popups;
CREATE POLICY "Popup visible par membres tenant" ON popups
  FOR SELECT USING (
    EXISTS(SELECT 1 FROM tenant_memberships WHERE tenant_id = popups.tenant_id AND user_id = auth.uid() AND status = 'active')
  );

DROP POLICY IF EXISTS "Popup modifiable par staff tenant" ON popups;
CREATE POLICY "Popup modifiable par staff tenant" ON popups
  FOR ALL USING (
    EXISTS(SELECT 1 FROM tenant_memberships WHERE tenant_id = popups.tenant_id AND user_id = auth.uid() AND role IN ('owner','admin') AND status = 'active')
  );

DROP POLICY IF EXISTS "Banner visible par membres tenant" ON banners;
CREATE POLICY "Banner visible par membres tenant" ON banners
  FOR SELECT USING (
    EXISTS(SELECT 1 FROM tenant_memberships WHERE tenant_id = banners.tenant_id AND user_id = auth.uid() AND status = 'active')
  );

DROP POLICY IF EXISTS "Banner modifiable par staff tenant" ON banners;
CREATE POLICY "Banner modifiable par staff tenant" ON banners
  FOR ALL USING (
    EXISTS(SELECT 1 FROM tenant_memberships WHERE tenant_id = banners.tenant_id AND user_id = auth.uid() AND role IN ('owner','admin') AND status = 'active')
  );


-- ── Migration 5/14: 20250505000005_billing.sql ──

CREATE TABLE IF NOT EXISTS subscriptions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  stripe_subscription_id  TEXT UNIQUE,
  stripe_customer_id      TEXT NOT NULL,
  stripe_price_id         TEXT,
  plan                    TEXT NOT NULL CHECK (plan IN ('starter', 'pro', 'business')),
  status                  TEXT NOT NULL DEFAULT 'trialing'
                            CHECK (status IN ('trialing','active','past_due','cancelled','incomplete','incomplete_expired','unpaid')),
  current_period_start    TIMESTAMPTZ,
  current_period_end      TIMESTAMPTZ,
  trial_end               TIMESTAMPTZ,
  cancel_at_period_end    BOOLEAN NOT NULL DEFAULT FALSE,
  cancelled_at            TIMESTAMPTZ,
  metadata                JSONB,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant_id ON subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer_id ON subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_active ON subscriptions(status, tenant_id) WHERE status IN ('active', 'trialing', 'past_due');

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "subscriptions_service_role" ON subscriptions;
CREATE POLICY "subscriptions_service_role" ON subscriptions
  TO service_role USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS subscriptions_updated_at ON subscriptions;
CREATE TRIGGER subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS invoices (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                 UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  subscription_id           UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  stripe_invoice_id         TEXT UNIQUE NOT NULL,
  stripe_payment_intent_id  TEXT,
  stripe_charge_id          TEXT,
  amount_cents              INTEGER NOT NULL CHECK (amount_cents >= 0),
  amount_paid_cents         INTEGER NOT NULL DEFAULT 0,
  currency                  TEXT NOT NULL DEFAULT 'EUR',
  status                    TEXT NOT NULL CHECK (status IN ('draft','open','paid','void','uncollectible')),
  period_start              TIMESTAMPTZ,
  period_end                TIMESTAMPTZ,
  invoice_url               TEXT,
  invoice_pdf               TEXT,
  paid_at                   TIMESTAMPTZ,
  due_date                  TIMESTAMPTZ,
  next_payment_attempt      TIMESTAMPTZ,
  metadata                  JSONB,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoices_tenant_id ON invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_subscription_id ON invoices(subscription_id);
CREATE INDEX IF NOT EXISTS idx_invoices_stripe_invoice_id ON invoices(stripe_invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status_tenant ON invoices(status, tenant_id);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "invoices_service_role" ON invoices;
CREATE POLICY "invoices_service_role" ON invoices
  TO service_role USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS invoices_updated_at ON invoices;
CREATE TRIGGER invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS billing_events (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  subscription_id   UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  invoice_id        UUID REFERENCES invoices(id) ON DELETE SET NULL,
  stripe_event_id   TEXT UNIQUE NOT NULL,
  event_type        TEXT NOT NULL,
  payload           JSONB NOT NULL,
  processed         BOOLEAN NOT NULL DEFAULT FALSE,
  processed_at      TIMESTAMPTZ,
  error             TEXT,
  retry_count       INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billing_events_tenant_id ON billing_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_billing_events_stripe_event_id ON billing_events(stripe_event_id);
CREATE INDEX IF NOT EXISTS idx_billing_events_event_type ON billing_events(event_type);
CREATE INDEX IF NOT EXISTS idx_billing_events_unprocessed ON billing_events(created_at) WHERE processed = FALSE;

ALTER TABLE billing_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "billing_events_service_role" ON billing_events;
CREATE POLICY "billing_events_service_role" ON billing_events
  TO service_role USING (true) WITH CHECK (true);

CREATE OR REPLACE VIEW billing_status_view AS
SELECT
  t.id                        AS tenant_id,
  t.name                      AS tenant_name,
  t.plan,
  t.billing_status,
  s.id                        AS subscription_id,
  s.stripe_subscription_id,
  s.status                    AS subscription_status,
  s.current_period_end,
  s.cancel_at_period_end,
  s.trial_end,
  (SELECT COUNT(*) FROM invoices i WHERE i.tenant_id = t.id AND i.status = 'paid') AS paid_invoices_count
FROM tenants t
LEFT JOIN subscriptions s ON s.tenant_id = t.id AND s.status IN ('active', 'trialing', 'past_due');


-- ── Migration 6/14: 20250510000006_cimolace_catalog.sql ──

-- Cimolace Catalog Foundation
-- Adds tenant_services table and infrastructure_type on tenants

-- 1. Infrastructure type on tenants (a tenant has exactly one infrastructure)
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS infrastructure_type TEXT;

COMMENT ON COLUMN tenants.infrastructure_type
  IS 'Infrastructure active du tenant : school, medos, mbolo, wellness, creator, temple, community';

-- CHECK constraint on infrastructure_type
ALTER TABLE tenants
  DROP CONSTRAINT IF EXISTS tenants_infrastructure_type_check;
ALTER TABLE tenants
  ADD CONSTRAINT tenants_infrastructure_type_check
  CHECK (
    infrastructure_type IS NULL OR
    infrastructure_type IN ('school','medos','mbolo','wellness','creator','temple','community')
  );

-- 2. Tenant services (activated engines per tenant)
CREATE TABLE IF NOT EXISTS tenant_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  service_key TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  settings JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, service_key)
);

CREATE INDEX IF NOT EXISTS idx_tenant_services_tenant ON tenant_services(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_services_key ON tenant_services(service_key);
CREATE INDEX IF NOT EXISTS idx_tenant_services_active ON tenant_services(tenant_id, active);

-- RLS
ALTER TABLE tenant_services ENABLE ROW LEVEL SECURITY;

-- Members can read services of their tenant
DROP POLICY IF EXISTS "Tenant services visible par membres" ON tenant_services;
CREATE POLICY "Tenant services visible par membres" ON tenant_services
  FOR SELECT USING (
    EXISTS(
      SELECT 1 FROM tenant_memberships
      WHERE tenant_id = tenant_services.tenant_id
        AND user_id = auth.uid()
        AND status = 'active'
    )
  );

-- Owner/admin can manage services
DROP POLICY IF EXISTS "Tenant services modifiable par owner/admin" ON tenant_services;
CREATE POLICY "Tenant services modifiable par owner/admin" ON tenant_services
  FOR ALL USING (
    EXISTS(
      SELECT 1 FROM tenant_memberships
      WHERE tenant_id = tenant_services.tenant_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
        AND status = 'active'
    )
  )
  WITH CHECK (
    EXISTS(
      SELECT 1 FROM tenant_memberships
      WHERE tenant_id = tenant_services.tenant_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
        AND status = 'active'
    )
  );

-- updated_at trigger
DROP TRIGGER IF EXISTS tenant_services_updated_at ON tenant_services;
CREATE TRIGGER tenant_services_updated_at
  BEFORE UPDATE ON tenant_services
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ── Migration 7/14: 20250512000006_live_participants.sql ──

CREATE TABLE IF NOT EXISTS live_session_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  live_session_id UUID REFERENCES live_sessions(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  role TEXT NOT NULL DEFAULT 'student',
  joined_at TIMESTAMPTZ,
  left_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(live_session_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_lsp_live_session ON live_session_participants(live_session_id);
CREATE INDEX IF NOT EXISTS idx_lsp_user ON live_session_participants(user_id);

ALTER TABLE live_session_participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participants visibles par membres tenant" ON live_session_participants;
CREATE POLICY "Participants visibles par membres tenant" ON live_session_participants
  FOR SELECT USING (
    EXISTS(
      SELECT 1 FROM live_sessions ls
      JOIN tenant_memberships tm ON tm.tenant_id = ls.tenant_id
      WHERE ls.id = live_session_participants.live_session_id
        AND tm.user_id = auth.uid()
        AND tm.status = 'active'
    )
  );

CREATE TABLE IF NOT EXISTS live_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  room_name TEXT NOT NULL,
  session_type TEXT NOT NULL DEFAULT 'production',
  live_session_id UUID REFERENCES live_sessions(id) ON DELETE SET NULL,
  payload JSONB,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lwe_room ON live_webhook_events(room_name);
CREATE INDEX IF NOT EXISTS idx_lwe_session ON live_webhook_events(live_session_id);
CREATE INDEX IF NOT EXISTS idx_lwe_created ON live_webhook_events(created_at);


-- ── Migration 8/14: 20250512000007_live_recordings.sql ──

CREATE TABLE IF NOT EXISTS live_recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  live_session_id UUID REFERENCES live_sessions(id) ON DELETE CASCADE NOT NULL,
  egress_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  output_url TEXT,
  duration_seconds INTEGER,
  tenant_slug TEXT,
  storage_filepath TEXT,
  raw_response JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lr_session ON live_recordings(live_session_id);
CREATE INDEX IF NOT EXISTS idx_lr_egress ON live_recordings(egress_id);
CREATE INDEX IF NOT EXISTS idx_lr_status ON live_recordings(status);

ALTER TABLE live_recordings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Recordings visibles par staff tenant" ON live_recordings;
CREATE POLICY "Recordings visibles par staff tenant" ON live_recordings
  FOR SELECT USING (
    EXISTS(
      SELECT 1 FROM live_sessions ls
      JOIN tenant_memberships tm ON tm.tenant_id = ls.tenant_id
      WHERE ls.id = live_recordings.live_session_id
        AND tm.user_id = auth.uid()
        AND tm.role IN ('owner', 'admin', 'teacher')
        AND tm.status = 'active'
    )
  );


-- ── Migration 9/14: 20260510000007_medos_core.sql ──

-- MedOS Core — Phase 1A
-- Tables: med_patients, med_consultation_notes, med_audit_log
-- RLS with role-based policies

-- 1. Patients
CREATE TABLE IF NOT EXISTS med_patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  patient_user_id UUID NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  date_of_birth DATE,
  gender TEXT CHECK (gender IN ('male','female','other','prefer_not_to_say')),
  blood_type TEXT,
  allergies JSONB NOT NULL DEFAULT '[]',
  chronic_conditions JSONB NOT NULL DEFAULT '[]',
  current_medications JSONB NOT NULL DEFAULT '[]',
  medical_history JSONB NOT NULL DEFAULT '{}',
  family_history JSONB NOT NULL DEFAULT '{}',
  emergency_contact JSONB,
  insurance_info JSONB,
  consent_given BOOLEAN NOT NULL DEFAULT false,
  consent_date TIMESTAMPTZ,
  consent_purpose TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived','deceased')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_med_patients_tenant ON med_patients(tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_med_patients_unique ON med_patients(tenant_id, patient_user_id);
CREATE INDEX IF NOT EXISTS idx_med_patients_status ON med_patients(tenant_id, status);

ALTER TABLE med_patients ENABLE ROW LEVEL SECURITY;

-- Staff can read patients
CREATE POLICY "med_staff_read_patients" ON med_patients
  FOR SELECT USING (
    EXISTS(
      SELECT 1 FROM tenant_memberships
      WHERE tenant_id = med_patients.tenant_id
        AND user_id = auth.uid()
        AND role IN ('practitioner','clinic_admin','receptionist')
        AND status = 'active'
    )
  );

-- Patient can read their own record
CREATE POLICY "patient_read_own" ON med_patients
  FOR SELECT USING (
    patient_user_id = auth.uid()
  );

-- Practitioner / clinic_admin can insert
CREATE POLICY "practitioner_insert_patients" ON med_patients
  FOR INSERT WITH CHECK (
    EXISTS(
      SELECT 1 FROM tenant_memberships
      WHERE tenant_id = med_patients.tenant_id
        AND user_id = auth.uid()
        AND role IN ('practitioner','clinic_admin')
        AND status = 'active'
    )
  );

-- Receptionist can insert (basic patient registration)
CREATE POLICY "receptionist_insert_patients" ON med_patients
  FOR INSERT WITH CHECK (
    EXISTS(
      SELECT 1 FROM tenant_memberships
      WHERE tenant_id = med_patients.tenant_id
        AND user_id = auth.uid()
        AND role IN ('receptionist')
        AND status = 'active'
    )
  );

-- Practitioner / clinic_admin can update
CREATE POLICY "practitioner_update_patients" ON med_patients
  FOR UPDATE USING (
    EXISTS(
      SELECT 1 FROM tenant_memberships
      WHERE tenant_id = med_patients.tenant_id
        AND user_id = auth.uid()
        AND role IN ('practitioner','clinic_admin')
        AND status = 'active'
    )
  ) WITH CHECK (
    EXISTS(
      SELECT 1 FROM tenant_memberships
      WHERE tenant_id = med_patients.tenant_id
        AND user_id = auth.uid()
        AND role IN ('practitioner','clinic_admin')
        AND status = 'active'
    )
  );

-- updated_at trigger
DROP TRIGGER IF EXISTS med_patients_updated_at ON med_patients;
CREATE TRIGGER med_patients_updated_at
  BEFORE UPDATE ON med_patients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 2. Consultation Notes (SOAP)
CREATE TABLE IF NOT EXISTS med_consultation_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES med_patients(id) ON DELETE CASCADE,
  practitioner_id UUID NOT NULL,
  subjective TEXT,
  objective TEXT,
  assessment TEXT,
  plan TEXT,
  free_text TEXT,
  ai_transcript TEXT,
  ai_draft TEXT,
  ai_summary TEXT,
  icd10_codes JSONB NOT NULL DEFAULT '[]',
  is_shared_with_patient BOOLEAN NOT NULL DEFAULT false,
  is_signed BOOLEAN NOT NULL DEFAULT false,
  signed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_med_notes_tenant ON med_consultation_notes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_med_notes_patient ON med_consultation_notes(patient_id);
CREATE INDEX IF NOT EXISTS idx_med_notes_practitioner ON med_consultation_notes(practitioner_id);

ALTER TABLE med_consultation_notes ENABLE ROW LEVEL SECURITY;

-- Practitioner / clinic_admin can read notes
CREATE POLICY "practitioner_read_notes" ON med_consultation_notes
  FOR SELECT USING (
    EXISTS(
      SELECT 1 FROM tenant_memberships
      WHERE tenant_id = med_consultation_notes.tenant_id
        AND user_id = auth.uid()
        AND role IN ('practitioner','clinic_admin')
        AND status = 'active'
    )
  );

-- Patient can read shared notes (via their patient record)
CREATE POLICY "patient_read_shared_notes" ON med_consultation_notes
  FOR SELECT USING (
    is_shared_with_patient = true
    AND EXISTS(
      SELECT 1 FROM med_patients
      WHERE med_patients.id = med_consultation_notes.patient_id
        AND med_patients.patient_user_id = auth.uid()
    )
  );

-- Practitioner / clinic_admin can insert notes
CREATE POLICY "practitioner_insert_notes" ON med_consultation_notes
  FOR INSERT WITH CHECK (
    EXISTS(
      SELECT 1 FROM tenant_memberships
      WHERE tenant_id = med_consultation_notes.tenant_id
        AND user_id = auth.uid()
        AND role IN ('practitioner','clinic_admin')
        AND status = 'active'
    )
  );

-- Practitioner / clinic_admin can update unsigned notes
CREATE POLICY "practitioner_update_notes" ON med_consultation_notes
  FOR UPDATE USING (
    EXISTS(
      SELECT 1 FROM tenant_memberships
      WHERE tenant_id = med_consultation_notes.tenant_id
        AND user_id = auth.uid()
        AND role IN ('practitioner','clinic_admin')
        AND status = 'active'
    )
  ) WITH CHECK (
    EXISTS(
      SELECT 1 FROM tenant_memberships
      WHERE tenant_id = med_consultation_notes.tenant_id
        AND user_id = auth.uid()
        AND role IN ('practitioner','clinic_admin')
        AND status = 'active'
    )
  );

-- updated_at trigger
DROP TRIGGER IF EXISTS med_consultation_notes_updated_at ON med_consultation_notes;
CREATE TRIGGER med_consultation_notes_updated_at
  BEFORE UPDATE ON med_consultation_notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 3. Medical Audit Log (append-only)
CREATE TABLE IF NOT EXISTS med_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL,
  resource TEXT NOT NULL,
  resource_id UUID NOT NULL,
  action TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_med_audit_tenant ON med_audit_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_med_audit_resource ON med_audit_log(tenant_id, resource, resource_id);
CREATE INDEX IF NOT EXISTS idx_med_audit_actor ON med_audit_log(actor_id);

ALTER TABLE med_audit_log ENABLE ROW LEVEL SECURITY;

-- Staff can read audit logs
CREATE POLICY "staff_read_audit" ON med_audit_log
  FOR SELECT USING (
    EXISTS(
      SELECT 1 FROM tenant_memberships
      WHERE tenant_id = med_audit_log.tenant_id
        AND user_id = auth.uid()
        AND role IN ('practitioner','clinic_admin')
        AND status = 'active'
    )
  );

-- ONLY service_role can insert audit entries (API writes with service_role).
-- No UPDATE/DELETE policy: med_audit_log is append-only by design.
-- Authenticated users (practitioners, clinic_admin) can only SELECT via staff_read_audit above.
CREATE POLICY "service_insert_audit" ON med_audit_log
  FOR INSERT TO service_role WITH CHECK (true);


-- ── Migration 10/14: 20260510000008_medos_forms_health.sql ──

-- ============================================================================
-- MedOS Phase 1B — Forms & Health Tracking (BROUILLON — NE PAS APPLIQUER)
-- Statut : non validé, non audité, routes API désactivées dans MedosModule.
-- Sera revu et potentiellement refondu lors de la Phase 1B après validation
-- du socle Phase 1A (patients + notes + audit).
-- ============================================================================
-- Tables: med_medical_forms, med_form_responses, med_health_entries

-- 1. Medical Forms
CREATE TABLE IF NOT EXISTS med_medical_forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'custom' CHECK (category IN ('intake','assessment','consent','followup','custom')),
  fields JSONB NOT NULL DEFAULT '[]',
  is_template BOOLEAN NOT NULL DEFAULT false,
  send_before_days INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_med_forms_tenant ON med_medical_forms(tenant_id);

ALTER TABLE med_medical_forms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_read_forms" ON med_medical_forms
  FOR SELECT USING (
    EXISTS(SELECT 1 FROM tenant_memberships
      WHERE tenant_id = med_medical_forms.tenant_id
        AND user_id = auth.uid()
        AND role IN ('owner','practitioner','clinic_admin','receptionist')
        AND status = 'active')
  );

CREATE POLICY "staff_manage_forms" ON med_medical_forms
  FOR ALL USING (
    EXISTS(SELECT 1 FROM tenant_memberships
      WHERE tenant_id = med_medical_forms.tenant_id
        AND user_id = auth.uid()
        AND role IN ('owner','practitioner','clinic_admin')
        AND status = 'active')
  ) WITH CHECK (
    EXISTS(SELECT 1 FROM tenant_memberships
      WHERE tenant_id = med_medical_forms.tenant_id
        AND user_id = auth.uid()
        AND role IN ('owner','practitioner','clinic_admin')
        AND status = 'active')
  );

DROP TRIGGER IF EXISTS med_medical_forms_updated_at ON med_medical_forms;
CREATE TRIGGER med_medical_forms_updated_at
  BEFORE UPDATE ON med_medical_forms
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 2. Form Responses
CREATE TABLE IF NOT EXISTS med_form_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  form_id UUID NOT NULL REFERENCES med_medical_forms(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES med_patients(id) ON DELETE CASCADE,
  submitted_by UUID NOT NULL,
  responses JSONB NOT NULL DEFAULT '{}',
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_med_fr_tenant ON med_form_responses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_med_fr_form ON med_form_responses(form_id);
CREATE INDEX IF NOT EXISTS idx_med_fr_patient ON med_form_responses(patient_id);

ALTER TABLE med_form_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_read_responses" ON med_form_responses
  FOR SELECT USING (
    EXISTS(SELECT 1 FROM tenant_memberships
      WHERE tenant_id = med_form_responses.tenant_id
        AND user_id = auth.uid()
        AND role IN ('owner','practitioner','clinic_admin')
        AND status = 'active')
  );

CREATE POLICY "patient_read_own_responses" ON med_form_responses
  FOR SELECT USING (
    EXISTS(SELECT 1 FROM med_patients
      WHERE med_patients.id = med_form_responses.patient_id
        AND med_patients.patient_user_id = auth.uid())
  );

CREATE POLICY "staff_patient_insert_responses" ON med_form_responses
  FOR INSERT WITH CHECK (
    EXISTS(SELECT 1 FROM tenant_memberships
      WHERE tenant_id = med_form_responses.tenant_id
        AND user_id = auth.uid()
        AND role IN ('owner','practitioner','clinic_admin','patient')
        AND status = 'active')
  );

-- 3. Health Entries (daily journal)
CREATE TABLE IF NOT EXISTS med_health_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES med_patients(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  entry_type TEXT NOT NULL DEFAULT 'custom' CHECK (entry_type IN ('mood','sleep','vitals','food','activity','symptom','custom')),
  mood_score INTEGER CHECK (mood_score BETWEEN 1 AND 10),
  energy_level INTEGER CHECK (energy_level BETWEEN 1 AND 10),
  sleep_hours DECIMAL(4,1),
  sleep_quality INTEGER CHECK (sleep_quality BETWEEN 1 AND 5),
  weight_kg DECIMAL(5,2),
  blood_pressure_systolic INTEGER,
  blood_pressure_diastolic INTEGER,
  heart_rate INTEGER,
  blood_glucose DECIMAL(5,1),
  temperature DECIMAL(4,1),
  meal_photos JSONB DEFAULT '[]',
  food_notes TEXT,
  water_liters DECIMAL(4,2),
  steps INTEGER,
  exercise_minutes INTEGER,
  symptoms JSONB DEFAULT '[]',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_med_health_tenant ON med_health_entries(tenant_id);
CREATE INDEX IF NOT EXISTS idx_med_health_patient ON med_health_entries(patient_id, entry_date DESC);

ALTER TABLE med_health_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "practitioner_read_health" ON med_health_entries
  FOR SELECT USING (
    EXISTS(SELECT 1 FROM tenant_memberships
      WHERE tenant_id = med_health_entries.tenant_id
        AND user_id = auth.uid()
        AND role IN ('owner','practitioner','clinic_admin')
        AND status = 'active')
  );

CREATE POLICY "patient_manage_own_health" ON med_health_entries
  FOR ALL USING (
    EXISTS(SELECT 1 FROM med_patients
      WHERE med_patients.id = med_health_entries.patient_id
        AND med_patients.patient_user_id = auth.uid())
  ) WITH CHECK (
    EXISTS(SELECT 1 FROM med_patients
      WHERE med_patients.id = med_health_entries.patient_id
        AND med_patients.patient_user_id = auth.uid())
  );


-- ── Migration 11/14: 20260511000009_medos_note_reads.sql ──

-- MedOS Patient Note Reads — Phase 1A+
-- Persist patient read acknowledgements for shared consultation notes.

CREATE TABLE IF NOT EXISTS med_note_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  note_id UUID NOT NULL REFERENCES med_consultation_notes(id) ON DELETE CASCADE,
  patient_user_id UUID NOT NULL,
  read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, note_id, patient_user_id)
);

CREATE INDEX IF NOT EXISTS idx_med_note_reads_tenant_patient
  ON med_note_reads(tenant_id, patient_user_id, read_at DESC);

CREATE INDEX IF NOT EXISTS idx_med_note_reads_note
  ON med_note_reads(note_id);

ALTER TABLE med_note_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_full_access_note_reads" ON med_note_reads;
CREATE POLICY "service_role_full_access_note_reads" ON med_note_reads
  TO service_role USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS med_note_reads_updated_at ON med_note_reads;
CREATE TRIGGER med_note_reads_updated_at
  BEFORE UPDATE ON med_note_reads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ── Migration 12/14: 20260512000010_smartboard.sql ──

-- LIRI SmartBoard V2 — Decks & Slides multi-tenant

CREATE TABLE IF NOT EXISTS smartboard_decks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  source_text TEXT NOT NULL DEFAULT '',
  format JSONB,
  theme JSONB,
  global_rules JSONB,
  layout JSONB,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_smartboard_decks_tenant ON smartboard_decks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_smartboard_decks_status ON smartboard_decks(tenant_id, status);

CREATE TABLE IF NOT EXISTS smartboard_slides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deck_id UUID REFERENCES smartboard_decks(id) ON DELETE CASCADE NOT NULL,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  slide_index INTEGER NOT NULL DEFAULT 0,
  step TEXT,
  title TEXT NOT NULL DEFAULT '',
  subtitle TEXT,
  core_idea TEXT,
  pedagogical_goal TEXT,
  dominant_mode TEXT,
  hero_visual JSONB,
  development JSONB,
  illustration JSONB,
  illustration_image_url TEXT,
  slide_summary TEXT,
  progressive_build JSONB,
  content JSONB,
  visual JSONB,
  graphic JSONB,
  student_action TEXT,
  teacher_note TEXT,
  transition TEXT,
  master_script JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_smartboard_slides_deck ON smartboard_slides(deck_id);
CREATE INDEX IF NOT EXISTS idx_smartboard_slides_tenant ON smartboard_slides(tenant_id);
CREATE INDEX IF NOT EXISTS idx_smartboard_slides_order ON smartboard_slides(deck_id, slide_index);

-- RLS

ALTER TABLE smartboard_decks ENABLE ROW LEVEL SECURITY;
ALTER TABLE smartboard_slides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "SmartBoard decks visibles par membres tenant" ON smartboard_decks;
CREATE POLICY "SmartBoard decks visibles par membres tenant" ON smartboard_decks
  FOR SELECT USING (
    EXISTS(
      SELECT 1 FROM tenant_memberships
      WHERE tenant_id = smartboard_decks.tenant_id
        AND user_id = auth.uid()
        AND status = 'active'
    )
  );

DROP POLICY IF EXISTS "SmartBoard decks modifiables par staff tenant" ON smartboard_decks;
CREATE POLICY "SmartBoard decks modifiables par staff tenant" ON smartboard_decks
  FOR ALL USING (
    EXISTS(
      SELECT 1 FROM tenant_memberships
      WHERE tenant_id = smartboard_decks.tenant_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin', 'teacher')
        AND status = 'active'
    )
  );

DROP POLICY IF EXISTS "SmartBoard slides visibles par membres tenant" ON smartboard_slides;
CREATE POLICY "SmartBoard slides visibles par membres tenant" ON smartboard_slides
  FOR SELECT USING (
    EXISTS(
      SELECT 1 FROM tenant_memberships
      WHERE tenant_id = smartboard_slides.tenant_id
        AND user_id = auth.uid()
        AND status = 'active'
    )
  );

DROP POLICY IF EXISTS "SmartBoard slides modifiables par staff tenant" ON smartboard_slides;
CREATE POLICY "SmartBoard slides modifiables par staff tenant" ON smartboard_slides
  FOR ALL USING (
    EXISTS(
      SELECT 1 FROM tenant_memberships
      WHERE tenant_id = smartboard_slides.tenant_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin', 'teacher')
        AND status = 'active'
    )
  );

-- Triggers

DROP TRIGGER IF EXISTS smartboard_decks_updated_at ON smartboard_decks;
CREATE TRIGGER smartboard_decks_updated_at
  BEFORE UPDATE ON smartboard_decks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS smartboard_slides_updated_at ON smartboard_slides;
CREATE TRIGGER smartboard_slides_updated_at
  BEFORE UPDATE ON smartboard_slides
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ── Migration 13/14: 20260513000013_stripe_connect.sql ──

-- Stripe Connect + Customer columns on tenants
-- Source: isna-flash/supabase/migrations/20250505_008_stripe_connect.sql
-- Applied: 2026-05-13 — consolidation isna-opus

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_account_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_onboarding_complete BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_tenants_stripe_customer ON tenants(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_tenants_stripe_account ON tenants(stripe_account_id);


-- ── Migration 14/14: 20260513000014_billing_rls.sql ──

-- RLS policies for billing tables (owner/admin access)
-- Opus 20250505000005_billing.sql uses service_role only.
-- This migration adds tenant-scoped RLS for owner/admin members.
-- Source: adapted from isna-flash/supabase/migrations/20250505_007_billing_saas.sql
-- Applied: 2026-05-13 — consolidation isna-opus

-- Subscriptions: visible by owner/admin of the tenant
DROP POLICY IF EXISTS "Subscription visible par owner/admin tenant" ON subscriptions;
CREATE POLICY "Subscription visible par owner/admin tenant" ON subscriptions
  FOR SELECT USING (
    EXISTS(
      SELECT 1 FROM tenant_memberships
      WHERE tenant_id = subscriptions.tenant_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
        AND status = 'active'
    )
  );

-- Subscriptions: modifiable by owner only
DROP POLICY IF EXISTS "Subscription modifiable par owner tenant" ON subscriptions;
CREATE POLICY "Subscription modifiable par owner tenant" ON subscriptions
  FOR ALL USING (
    EXISTS(
      SELECT 1 FROM tenant_memberships
      WHERE tenant_id = subscriptions.tenant_id
        AND user_id = auth.uid()
        AND role = 'owner'
        AND status = 'active'
    )
  );

-- Invoices: visible by owner/admin
DROP POLICY IF EXISTS "Invoice visible par owner/admin tenant" ON invoices;
CREATE POLICY "Invoice visible par owner/admin tenant" ON invoices
  FOR SELECT USING (
    EXISTS(
      SELECT 1 FROM tenant_memberships
      WHERE tenant_id = invoices.tenant_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
        AND status = 'active'
    )
  );

-- Billing events: visible by owner/admin
DROP POLICY IF EXISTS "Billing events visible par owner/admin tenant" ON billing_events;
CREATE POLICY "Billing events visible par owner/admin tenant" ON billing_events
  FOR SELECT USING (
    EXISTS(
      SELECT 1 FROM tenant_memberships
      WHERE tenant_id = billing_events.tenant_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
        AND status = 'active'
    )
  );


COMMIT;

-- ✅ All 14 migrations applied. Verify with:
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;