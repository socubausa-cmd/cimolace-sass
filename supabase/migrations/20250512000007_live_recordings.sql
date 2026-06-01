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
