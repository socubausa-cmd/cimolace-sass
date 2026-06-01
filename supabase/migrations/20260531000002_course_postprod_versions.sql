-- ────────────────────────────────────────────────────────────────────────────
-- course_postprod_versions — snapshots de l'état post-production (classe numérique).
-- Permet save / list / restore d'un contenu (formation_day_contents.id).
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS course_postprod_versions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL,
  content_id  TEXT NOT NULL,
  label       TEXT,
  snapshot    JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by  UUID,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_course_postprod_versions_content ON course_postprod_versions (content_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_course_postprod_versions_tenant  ON course_postprod_versions (tenant_id);

ALTER TABLE course_postprod_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_course_postprod_versions"
  ON course_postprod_versions FOR ALL
  USING (tenant_id = (current_setting('app.tenant_id', true))::uuid);
