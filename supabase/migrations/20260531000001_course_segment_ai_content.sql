-- ────────────────────────────────────────────────────────────────────────────
-- course_segment_ai_content — contenu IA par segment/chapitre d'une formation
-- (« tableau IA » du split-screen post-production / classe numérique).
-- Clé fonctionnelle : (content_id, segment_index). content_id = formation_day_contents.id
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS course_segment_ai_content (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL,
  content_id          TEXT NOT NULL,
  segment_index       INTEGER NOT NULL,
  status              TEXT NOT NULL DEFAULT 'draft',  -- draft | approved | rejected
  reformulation_text  TEXT,
  key_points          TEXT,
  summary_text        TEXT,
  retention_text      TEXT,
  illustration_prompt TEXT,
  illustration_url    TEXT,
  created_by          UUID,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (content_id, segment_index)
);

CREATE INDEX IF NOT EXISTS idx_course_segment_ai_content_tenant  ON course_segment_ai_content (tenant_id);
CREATE INDEX IF NOT EXISTS idx_course_segment_ai_content_content ON course_segment_ai_content (content_id);

-- RLS : isolation tenant (même idiome que course_pipelines / pipeline_segments / render_jobs).
ALTER TABLE course_segment_ai_content ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_course_segment_ai_content"
  ON course_segment_ai_content FOR ALL
  USING (tenant_id = (current_setting('app.tenant_id', true))::uuid);
