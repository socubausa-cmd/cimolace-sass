-- ═════════════════════════════════════════════════════════════════════════════
-- LIRI Booking avancé — reminders, satisfaction, reschedule, ICS, immersive
-- ═════════════════════════════════════════════════════════════════════════════

-- 1) Reminders programmés (24h before, etc.)
CREATE TABLE IF NOT EXISTS booking_reminders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  appointment_id  UUID NOT NULL,
  channel         TEXT NOT NULL,            -- email | sms | whatsapp | push
  template        TEXT NOT NULL,            -- 'reminder_24h' | 'reminder_1h' | 'satisfaction_post'
  scheduled_at    TIMESTAMPTZ NOT NULL,
  sent_at         TIMESTAMPTZ,
  status          TEXT NOT NULL DEFAULT 'pending', -- pending | sent | failed | cancelled
  provider_msg_id TEXT,
  error           TEXT,
  retry_count     INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_booking_reminders_pending
  ON booking_reminders(scheduled_at)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_booking_reminders_appt
  ON booking_reminders(appointment_id);

-- 2) Satisfaction surveys (envoyés après le RDV)
CREATE TABLE IF NOT EXISTS booking_satisfaction (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  appointment_id  UUID NOT NULL,
  user_id         UUID,
  rating          INT CHECK (rating >= 1 AND rating <= 5),
  nps_score       INT CHECK (nps_score >= 0 AND nps_score <= 10),
  comment         TEXT,
  responded_at    TIMESTAMPTZ,
  sent_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reminded_at     TIMESTAMPTZ,
  status          TEXT NOT NULL DEFAULT 'sent',  -- sent | responded | expired
  metadata        JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_booking_satisfaction_appt ON booking_satisfaction(appointment_id);
CREATE INDEX IF NOT EXISTS idx_booking_satisfaction_tenant ON booking_satisfaction(tenant_id, sent_at DESC);

-- 3) Reschedule requests (workflow asynchrone)
CREATE TABLE IF NOT EXISTS booking_reschedule_requests (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  appointment_id    UUID NOT NULL,
  requested_by      UUID,
  requested_role    TEXT NOT NULL,           -- 'student' | 'teacher' | 'secretariat'
  reason            TEXT,
  proposed_slots    JSONB DEFAULT '[]',      -- [{ start, end }, ...]
  status            TEXT NOT NULL DEFAULT 'pending', -- pending | approved | declined | cancelled
  decided_by        UUID,
  decided_at        TIMESTAMPTZ,
  decision_note     TEXT,
  new_appointment_id UUID,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_booking_reschedule_pending
  ON booking_reschedule_requests(tenant_id, status)
  WHERE status = 'pending';

-- 4) Invitations RDV (envoi proactif d'un créneau)
CREATE TABLE IF NOT EXISTS booking_invitations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  invited_user_id UUID,
  invited_email   TEXT,
  invited_by      UUID,
  slot_id         UUID,
  appointment_id  UUID,
  token           TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  accepted_at     TIMESTAMPTZ,
  declined_at     TIMESTAMPTZ,
  status          TEXT NOT NULL DEFAULT 'sent',  -- sent | accepted | declined | expired | cancelled
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_booking_invitations_token ON booking_invitations(token);
CREATE INDEX IF NOT EXISTS idx_booking_invitations_tenant ON booking_invitations(tenant_id);

-- RLS
ALTER TABLE booking_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_satisfaction ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_reschedule_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_invitations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN CREATE POLICY "service_full_reminders" ON booking_reminders TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "service_full_satisfaction" ON booking_satisfaction TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "service_full_reschedule" ON booking_reschedule_requests TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "service_full_invitations" ON booking_invitations TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
