-- Migration: notifications
-- Tables notifications (in-app + push) et notification_preferences par tenant.

-- ── NOTIFICATIONS ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notifications (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  body         TEXT NOT NULL,
  channel      TEXT NOT NULL DEFAULT 'in_app' CHECK (channel IN ('in_app','push','email','sms')),
  template_key TEXT,
  data         JSONB NOT NULL DEFAULT '{}',
  is_read      BOOLEAN NOT NULL DEFAULT false,
  read_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_tenant ON notifications(tenant_id);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Chaque utilisateur ne voit que ses notifications
CREATE POLICY "notifications_owner_select"
  ON notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "notifications_owner_update"
  ON notifications FOR UPDATE
  USING (user_id = auth.uid());

-- Insertion autorisée au service-role uniquement (depuis l'API backend)
-- RLS ne bloque pas le service-role key

COMMENT ON TABLE notifications IS 'Notifications in-app et push par utilisateur/tenant.';

-- ── NOTIFICATION_PREFERENCES ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notification_preferences (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email_notifications   BOOLEAN NOT NULL DEFAULT true,
  sms_notifications     BOOLEAN NOT NULL DEFAULT false,
  push_notifications    BOOLEAN NOT NULL DEFAULT true,
  in_app_notifications  BOOLEAN NOT NULL DEFAULT true,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (tenant_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_notif_prefs_user ON notification_preferences(user_id);

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notif_prefs_owner"
  ON notification_preferences FOR ALL
  USING (user_id = auth.uid());

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_notif_prefs_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notif_prefs_updated_at ON notification_preferences;
CREATE TRIGGER trg_notif_prefs_updated_at
  BEFORE UPDATE ON notification_preferences
  FOR EACH ROW EXECUTE FUNCTION update_notif_prefs_updated_at();

COMMENT ON TABLE notification_preferences IS 'Préférences de notification par utilisateur et tenant.';
