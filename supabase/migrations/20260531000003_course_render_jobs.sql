-- ────────────────────────────────────────────────────────────────────────────
-- course_render_jobs — file de rendu MP4 split-screen (classe numérique).
-- Le worker (apps/worker/src/jobs/courseRender.js) poll les jobs `queued`.
-- payload = { sourceVideoUrl, slides:[{url,durationSeconds}], width, height }
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS course_render_jobs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL,
  content_id  TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'queued',  -- queued | rendering | completed | failed
  payload     JSONB NOT NULL DEFAULT '{}'::jsonb,
  output_url  TEXT,
  error       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_course_render_jobs_content ON course_render_jobs (content_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_course_render_jobs_status  ON course_render_jobs (status) WHERE status IN ('queued','rendering');
CREATE INDEX IF NOT EXISTS idx_course_render_jobs_tenant  ON course_render_jobs (tenant_id);

ALTER TABLE course_render_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_course_render_jobs"
  ON course_render_jobs FOR ALL
  USING (tenant_id = (current_setting('app.tenant_id', true))::uuid);
