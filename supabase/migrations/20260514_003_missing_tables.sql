-- ============================================================================
-- Migration: Tables manquantes — Blocs 9-15
-- Date: 2026-05-14
-- Tables pour les nouveaux endpoints (immersive, reschedule, reviews, etc.)
-- ============================================================================

-- ── Immersive Live Sessions ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS immersive_live_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  host_user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  guest_user_id   UUID,
  livekit_room_name TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'created'
                  CHECK (status IN ('created','active','ended')),
  companion_code  TEXT,
  companion_code_expires_at TIMESTAMPTZ,
  companion_used  BOOLEAN DEFAULT false,
  context_snapshot JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_immersive_sessions_tenant ON immersive_live_sessions(tenant_id);

-- ── Appointment Reschedule Requests ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS appointment_reschedule_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  appointment_id  UUID NOT NULL,
  new_slot_id     UUID NOT NULL,
  reason          TEXT,
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','approved','rejected')),
  decided_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_reschedule_requests_tenant ON appointment_reschedule_requests(tenant_id);

-- ── Reviews ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS reviews (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating          INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment         TEXT,
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','approved','rejected')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_reviews_tenant ON reviews(tenant_id);

-- ── Privileged Links ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS privileged_links (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_by      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code            TEXT NOT NULL UNIQUE,
  resource_type   TEXT NOT NULL,
  resource_id     TEXT NOT NULL,
  expires_at      TIMESTAMPTZ,
  status          TEXT NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active','used','expired')),
  used_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_privileged_links_code ON privileged_links(code);
CREATE INDEX idx_privileged_links_tenant ON privileged_links(tenant_id);

-- ── Inbound Emails ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS inbound_emails (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  from_address    TEXT NOT NULL,
  subject         TEXT,
  body            TEXT,
  status          TEXT NOT NULL DEFAULT 'received'
                  CHECK (status IN ('received','read','replied','archived')),
  replied_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_inbound_emails_tenant ON inbound_emails(tenant_id);

-- ── Announcements ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS announcements (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  subject         TEXT NOT NULL,
  content         TEXT,
  recipient_count INTEGER DEFAULT 0,
  ai_polished     BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_announcements_tenant ON announcements(tenant_id);

-- ── Billing Followups ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS billing_followups (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  student_id      UUID NOT NULL,
  notes           TEXT,
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','contacted','resolved')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_billing_followups_tenant ON billing_followups(tenant_id);

-- ── Student Invitations ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS student_invitations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email           TEXT NOT NULL,
  name            TEXT,
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','sent','accepted','expired')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_student_invitations_tenant ON student_invitations(tenant_id);

-- ── Enrollments ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS enrollments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  student_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  formation_id    UUID NOT NULL,
  status          TEXT NOT NULL DEFAULT 'enrolled'
                  CHECK (status IN ('enrolled','active','completed','dropped')),
  enrolled_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ
);

CREATE INDEX idx_enrollments_tenant ON enrollments(tenant_id);
CREATE INDEX idx_enrollments_student ON enrollments(student_id);

-- ── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE immersive_live_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointment_reschedule_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE privileged_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbound_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_followups ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;

-- Basic RLS: staff full access
CREATE POLICY "staff_immersive" ON immersive_live_sessions FOR ALL USING (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.tenant_id = immersive_live_sessions.tenant_id AND tm.user_id = auth.uid() AND tm.role IN ('owner','admin','teacher'))
);
CREATE POLICY "staff_reschedule" ON appointment_reschedule_requests FOR ALL USING (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.tenant_id = appointment_reschedule_requests.tenant_id AND tm.user_id = auth.uid() AND tm.role IN ('owner','admin','teacher'))
);
CREATE POLICY "staff_reviews" ON reviews FOR ALL USING (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.tenant_id = reviews.tenant_id AND tm.user_id = auth.uid() AND tm.role IN ('owner','admin'))
);
CREATE POLICY "public_read_reviews" ON reviews FOR SELECT USING (status = 'approved');
CREATE POLICY "staff_links" ON privileged_links FOR ALL USING (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.tenant_id = privileged_links.tenant_id AND tm.user_id = auth.uid() AND tm.role IN ('owner','admin','teacher'))
);
CREATE POLICY "staff_inbound" ON inbound_emails FOR ALL USING (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.tenant_id = inbound_emails.tenant_id AND tm.user_id = auth.uid() AND tm.role IN ('owner','admin'))
);
CREATE POLICY "staff_announce" ON announcements FOR ALL USING (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.tenant_id = announcements.tenant_id AND tm.user_id = auth.uid() AND tm.role IN ('owner','admin','teacher'))
);
CREATE POLICY "staff_followups" ON billing_followups FOR ALL USING (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.tenant_id = billing_followups.tenant_id AND tm.user_id = auth.uid() AND tm.role IN ('owner','admin'))
);
CREATE POLICY "staff_invites" ON student_invitations FOR ALL USING (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.tenant_id = student_invitations.tenant_id AND tm.user_id = auth.uid() AND tm.role IN ('owner','admin','teacher'))
);
CREATE POLICY "staff_enrollments" ON enrollments FOR ALL USING (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.tenant_id = enrollments.tenant_id AND tm.user_id = auth.uid() AND tm.role IN ('owner','admin','teacher'))
);
