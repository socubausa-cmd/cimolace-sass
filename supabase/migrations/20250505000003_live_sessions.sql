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
