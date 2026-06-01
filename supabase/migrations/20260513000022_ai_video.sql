-- ============================================================
-- Phase 4 — IA et vidéo
-- course_pipelines, pipeline_segments, render_jobs,
-- masterclasses, masterclass_modules, masterclass_lessons,
-- video_assets, ai_jobs
-- ============================================================

-- ── Course Builder ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS course_pipelines (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL,
  name        TEXT NOT NULL,
  source_text TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','segmented','rendering','completed','failed')),
  segment_count INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_course_pipelines_tenant ON course_pipelines (tenant_id);

ALTER TABLE course_pipelines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_course_pipelines"
  ON course_pipelines FOR ALL
  USING (tenant_id = (current_setting('app.tenant_id', true))::uuid);

-- ── Pipeline Segments ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pipeline_segments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL,
  pipeline_id UUID NOT NULL REFERENCES course_pipelines(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  content     TEXT NOT NULL DEFAULT '',
  order_index INT NOT NULL DEFAULT 0,
  ai_enhanced BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pipeline_segments_pipeline ON pipeline_segments (pipeline_id);

ALTER TABLE pipeline_segments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_pipeline_segments"
  ON pipeline_segments FOR ALL
  USING (tenant_id = (current_setting('app.tenant_id', true))::uuid);

-- ── Render Jobs ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS render_jobs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL,
  pipeline_id  UUID REFERENCES course_pipelines(id) ON DELETE SET NULL,
  status       TEXT NOT NULL DEFAULT 'queued'
                 CHECK (status IN ('queued','processing','completed','failed')),
  progress     INT NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  output_url   TEXT,
  error_msg    TEXT,
  started_at   TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_render_jobs_tenant  ON render_jobs (tenant_id);
CREATE INDEX IF NOT EXISTS idx_render_jobs_status  ON render_jobs (status) WHERE status IN ('queued','processing');

ALTER TABLE render_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_render_jobs"
  ON render_jobs FOR ALL
  USING (tenant_id = (current_setting('app.tenant_id', true))::uuid);

-- ── Masterclasses ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS masterclasses (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL,
  created_by   UUID NOT NULL,
  title        TEXT NOT NULL,
  source_text  TEXT NOT NULL DEFAULT '',
  module_count INT NOT NULL DEFAULT 0,
  status       TEXT NOT NULL DEFAULT 'draft'
                 CHECK (status IN ('draft','published','archived')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_masterclasses_tenant ON masterclasses (tenant_id);

ALTER TABLE masterclasses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_masterclasses"
  ON masterclasses FOR ALL
  USING (tenant_id = (current_setting('app.tenant_id', true))::uuid);

-- ── Masterclass Modules ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS masterclass_modules (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL,
  masterclass_id UUID NOT NULL REFERENCES masterclasses(id) ON DELETE CASCADE,
  title          TEXT NOT NULL,
  content        TEXT NOT NULL DEFAULT '',
  order_index    INT NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mc_modules_mc ON masterclass_modules (masterclass_id);

ALTER TABLE masterclass_modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_masterclass_modules"
  ON masterclass_modules FOR ALL
  USING (tenant_id = (current_setting('app.tenant_id', true))::uuid);

-- ── Masterclass Lessons ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS masterclass_lessons (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL,
  module_id   UUID NOT NULL REFERENCES masterclass_modules(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  content     TEXT NOT NULL DEFAULT '',
  order_index INT NOT NULL DEFAULT 0,
  video_asset_id UUID,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mc_lessons_module ON masterclass_lessons (module_id);

ALTER TABLE masterclass_lessons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_masterclass_lessons"
  ON masterclass_lessons FOR ALL
  USING (tenant_id = (current_setting('app.tenant_id', true))::uuid);

-- ── Video Assets (Mux / Cloudflare Stream) ───────────────────────────────────

CREATE TABLE IF NOT EXISTS video_assets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  uploaded_by     UUID NOT NULL,
  provider        TEXT NOT NULL DEFAULT 'mux'
                    CHECK (provider IN ('mux','cloudflare','local')),
  provider_asset_id TEXT,
  playback_id     TEXT,
  playback_url    TEXT,
  thumbnail_url   TEXT,
  duration_sec    NUMERIC(10,2),
  status          TEXT NOT NULL DEFAULT 'waiting'
                    CHECK (status IN ('waiting','preparing','ready','errored')),
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_video_assets_tenant   ON video_assets (tenant_id);
CREATE INDEX IF NOT EXISTS idx_video_assets_provider ON video_assets (provider, provider_asset_id);

ALTER TABLE video_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_video_assets"
  ON video_assets FOR ALL
  USING (tenant_id = (current_setting('app.tenant_id', true))::uuid);

-- ── AI Jobs ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ai_jobs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL,
  type        TEXT NOT NULL
                CHECK (type IN ('enhance_segment','generate_quiz','summarize','analyze_doc')),
  payload     JSONB NOT NULL DEFAULT '{}',
  result      JSONB,
  status      TEXT NOT NULL DEFAULT 'queued'
                CHECK (status IN ('queued','processing','completed','failed')),
  model       TEXT NOT NULL DEFAULT 'deepseek-chat',
  error_msg   TEXT,
  started_at  TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_jobs_tenant ON ai_jobs (tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_jobs_status ON ai_jobs (status) WHERE status IN ('queued','processing');

ALTER TABLE ai_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_ai_jobs"
  ON ai_jobs FOR ALL
  USING (tenant_id = (current_setting('app.tenant_id', true))::uuid);

-- ── Updated_at triggers ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['course_pipelines','masterclasses','video_assets'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger
      WHERE tgname = 'set_updated_at_' || t AND tgrelid = t::regclass
    ) THEN
      EXECUTE format(
        'CREATE TRIGGER set_updated_at_%I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()', t, t
      );
    END IF;
  END LOOP;
END $$;
