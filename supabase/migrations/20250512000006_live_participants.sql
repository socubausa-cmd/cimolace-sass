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
