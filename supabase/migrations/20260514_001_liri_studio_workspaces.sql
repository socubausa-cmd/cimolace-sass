-- ============================================================================
-- Migration: Studio LIRI — Workspaces, Projects, Assets
-- Date: 2026-05-14
-- Bloc 1 — Studio LIRI Migration
-- ============================================================================

-- ── LIRI Course Workspaces (SmartBoard Designer + Course Builder) ────────────

CREATE TABLE IF NOT EXISTS liri_course_workspaces (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  owner_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title         TEXT NOT NULL DEFAULT 'Nouveau workspace',
  description   TEXT,
  status        TEXT NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft','in_progress','validated','live_ready','archived')),
  pedagogical_model TEXT DEFAULT 'liri-v1'
                CHECK (pedagogical_model IN ('liri-v1','failure-v2')),
  theme         JSONB,
  slides_json   JSONB,
  copilot_json  JSONB,
  source_text   TEXT,
  source_type   TEXT DEFAULT 'text'
                CHECK (source_type IN ('text','pdf','ppt','transcript')),
  chapter_count INTEGER DEFAULT 0,
  slide_count   INTEGER DEFAULT 0,
  total_duration_min INTEGER,
  quality_score REAL,
  collaborators UUID[] DEFAULT '{}',
  versions      JSONB DEFAULT '[]',
  exported_formats TEXT[] DEFAULT '{}',
  is_public     BOOLEAN DEFAULT false,
  metadata      JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_liri_workspaces_tenant ON liri_course_workspaces(tenant_id);
CREATE INDEX idx_liri_workspaces_owner ON liri_course_workspaces(owner_id);
CREATE INDEX idx_liri_workspaces_status ON liri_course_workspaces(status);

-- ── LIRI Projects (Masterclass Factory, Formation Builder) ─────────────────

CREATE TABLE IF NOT EXISTS liri_projects (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  owner_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_type  TEXT NOT NULL DEFAULT 'course'
                CHECK (project_type IN ('course','formation','masterclass','debate','annual_program')),
  title         TEXT NOT NULL,
  description   TEXT,
  status        TEXT NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft','analyzing','segmenting','building','review','complete','archived')),
  source_text   TEXT,
  source_document_url TEXT,
  pedagogical_model TEXT DEFAULT 'liri-v1',
  analysis_report JSONB,
  sense_blocks  JSONB DEFAULT '[]',
  chapters      JSONB DEFAULT '[]',
  segments      JSONB DEFAULT '[]',
  deck_json     JSONB,
  orchestrator_job_id TEXT,
  pipeline_stage TEXT DEFAULT 'idle'
                CHECK (pipeline_stage IN ('idle','analyzing','block_detection','chapter_building','segment_filling','done','error')),
  metadata      JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_liri_projects_tenant ON liri_projects(tenant_id);
CREATE INDEX idx_liri_projects_owner ON liri_projects(owner_id);
CREATE INDEX idx_liri_projects_type ON liri_projects(project_type);
CREATE INDEX idx_liri_projects_status ON liri_projects(status);

-- ── LIRI Formations (multi-module programs) ─────────────────────────────────

CREATE TABLE IF NOT EXISTS liri_formations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  owner_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  description   TEXT,
  programme_type TEXT DEFAULT 'complet'
                CHECK (programme_type IN ('complet','trimestre','intensif','annuel','workshop','coaching')),
  audience_level TEXT DEFAULT 'intermediaire'
                CHECK (audience_level IN ('debutant','intermediaire','avance','expert')),
  status        TEXT NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft','building','ready','published','archived')),
  tree_json     JSONB DEFAULT '{}',
  course_ids    UUID[] DEFAULT '{}',
  estimated_duration_hours REAL,
  target_skills TEXT[] DEFAULT '{}',
  prerequisites TEXT[] DEFAULT '{}',
  metadata      JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_liri_formations_tenant ON liri_formations(tenant_id);

-- ── LIRI Assets Library ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS liri_assets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  owner_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  asset_type    TEXT NOT NULL DEFAULT 'image'
                CHECK (asset_type IN ('image','icon','video','lut','template','prompt','document','audio')),
  title         TEXT NOT NULL,
  description   TEXT,
  storage_path  TEXT,
  public_url    TEXT,
  thumbnail_url TEXT,
  tags          TEXT[] DEFAULT '{}',
  width         INTEGER,
  height        INTEGER,
  file_size_bytes BIGINT,
  mime_type     TEXT,
  is_public     BOOLEAN DEFAULT false,
  is_template   BOOLEAN DEFAULT false,
  usage_count   INTEGER DEFAULT 0,
  metadata      JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_liri_assets_tenant ON liri_assets(tenant_id);
CREATE INDEX idx_liri_assets_type ON liri_assets(asset_type);
CREATE INDEX idx_liri_assets_tags ON liri_assets USING GIN(tags);

-- ── LIRI Render Jobs (for post-production / export) ─────────────────────────

CREATE TABLE IF NOT EXISTS liri_render_jobs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  workspace_id  UUID REFERENCES liri_course_workspaces(id) ON DELETE SET NULL,
  project_id    UUID REFERENCES liri_projects(id) ON DELETE SET NULL,
  job_type      TEXT NOT NULL DEFAULT 'export'
                CHECK (job_type IN ('export','render','augment','transcode','thumbnail')),
  export_format TEXT,
  status        TEXT NOT NULL DEFAULT 'queued'
                CHECK (status IN ('queued','processing','completed','failed','cancelled')),
  progress      REAL DEFAULT 0.0,
  result_url    TEXT,
  error_message TEXT,
  duration_ms   INTEGER,
  worker_id     TEXT,
  started_at    TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_liri_render_jobs_tenant ON liri_render_jobs(tenant_id);
CREATE INDEX idx_liri_render_jobs_status ON liri_render_jobs(status);

-- ── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE liri_course_workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE liri_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE liri_formations ENABLE ROW LEVEL SECURITY;
ALTER TABLE liri_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE liri_render_jobs ENABLE ROW LEVEL SECURITY;

-- Workspaces: staff full access
CREATE POLICY "staff_access_workspaces" ON liri_course_workspaces
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM tenant_memberships tm
      WHERE tm.tenant_id = liri_course_workspaces.tenant_id
      AND tm.user_id = auth.uid()
      AND tm.role IN ('owner','admin','teacher')
    )
  );

-- Projects: staff full access
CREATE POLICY "staff_access_projects" ON liri_projects
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM tenant_memberships tm
      WHERE tm.tenant_id = liri_projects.tenant_id
      AND tm.user_id = auth.uid()
      AND tm.role IN ('owner','admin','teacher')
    )
  );

-- Formations: staff full access
CREATE POLICY "staff_access_formations" ON liri_formations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM tenant_memberships tm
      WHERE tm.tenant_id = liri_formations.tenant_id
      AND tm.user_id = auth.uid()
      AND tm.role IN ('owner','admin','teacher')
    )
  );

-- Assets: all members read, staff write
CREATE POLICY "members_read_assets" ON liri_assets
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tenant_memberships tm
      WHERE tm.tenant_id = liri_assets.tenant_id
      AND tm.user_id = auth.uid()
    )
  );

CREATE POLICY "staff_insert_assets" ON liri_assets
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM tenant_memberships tm
      WHERE tm.tenant_id = liri_assets.tenant_id
      AND tm.user_id = auth.uid()
      AND tm.role IN ('owner','admin','teacher')
    )
  );

-- Render jobs: members read
CREATE POLICY "members_read_jobs" ON liri_render_jobs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tenant_memberships tm
      WHERE tm.tenant_id = liri_render_jobs.tenant_id
      AND tm.user_id = auth.uid()
    )
  );

-- ── Triggers ────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_liri_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_liri_workspaces_updated_at
  BEFORE UPDATE ON liri_course_workspaces
  FOR EACH ROW EXECUTE FUNCTION update_liri_updated_at();

CREATE TRIGGER trg_liri_projects_updated_at
  BEFORE UPDATE ON liri_projects
  FOR EACH ROW EXECUTE FUNCTION update_liri_updated_at();

CREATE TRIGGER trg_liri_formations_updated_at
  BEFORE UPDATE ON liri_formations
  FOR EACH ROW EXECUTE FUNCTION update_liri_updated_at();

CREATE TRIGGER trg_liri_assets_updated_at
  BEFORE UPDATE ON liri_assets
  FOR EACH ROW EXECUTE FUNCTION update_liri_updated_at();
