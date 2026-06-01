-- ─── LIRI Orchestrator Projects ───────────────────────────────────────────────
-- Table de persistance pour le pipeline Orchestrator Live (Groupe 1).
-- Chaque ligne = un projet lancé depuis Masterclass Factory ou directement
-- depuis OrchestratorLiveV2.
--
-- Flux : liri-orchestrator-start (INSERT) → liri-orchestrator-status (UPDATE)
--        → liri-slide-generate (UPDATE slides[])
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.liri_orchestrator_projects (
  id           text        PRIMARY KEY,                          -- ex: 'liri_1748000000000_abc123'
  status       text        NOT NULL DEFAULT 'running'
                           CHECK (status IN ('running','completed','error','idle')),
  raw_text     text        NOT NULL DEFAULT '',
  agents       jsonb       NOT NULL DEFAULT '[]'::jsonb,
  chapters     jsonb       NOT NULL DEFAULT '[]'::jsonb,
  slides       jsonb       NOT NULL DEFAULT '[]'::jsonb,
  queue        jsonb       NOT NULL DEFAULT '{}'::jsonb,
  logs         jsonb       NOT NULL DEFAULT '[]'::jsonb,
  created_by   uuid        REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- ─── Index ────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_liri_orch_projects_created_by
  ON public.liri_orchestrator_projects (created_by);

CREATE INDEX IF NOT EXISTS idx_liri_orch_projects_status
  ON public.liri_orchestrator_projects (status);

CREATE INDEX IF NOT EXISTS idx_liri_orch_projects_updated_at
  ON public.liri_orchestrator_projects (updated_at DESC);

-- ─── updated_at automatique ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.liri_orchestrator_projects_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_liri_orch_projects_updated_at
  ON public.liri_orchestrator_projects;

CREATE TRIGGER trg_liri_orch_projects_updated_at
  BEFORE UPDATE ON public.liri_orchestrator_projects
  FOR EACH ROW
  EXECUTE FUNCTION public.liri_orchestrator_projects_set_updated_at();

-- ─── Row Level Security ───────────────────────────────────────────────────────

ALTER TABLE public.liri_orchestrator_projects ENABLE ROW LEVEL SECURITY;

-- Le service role (Netlify Functions) a accès complet (bypass RLS)
-- Les utilisateurs authentifiés voient et modifient uniquement leurs propres projets

CREATE POLICY "Propriétaire : lecture"
  ON public.liri_orchestrator_projects
  FOR SELECT
  USING (
    created_by = auth.uid()
    OR created_by IS NULL  -- projets anonymes (dev / test)
  );

CREATE POLICY "Propriétaire : insertion"
  ON public.liri_orchestrator_projects
  FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    OR created_by IS NULL
  );

CREATE POLICY "Propriétaire : mise à jour"
  ON public.liri_orchestrator_projects
  FOR UPDATE
  USING (
    created_by = auth.uid()
    OR created_by IS NULL
  );

CREATE POLICY "Propriétaire : suppression"
  ON public.liri_orchestrator_projects
  FOR DELETE
  USING (
    created_by = auth.uid()
    OR created_by IS NULL
  );

-- ─── Commentaires ─────────────────────────────────────────────────────────────

COMMENT ON TABLE  public.liri_orchestrator_projects IS
  'Projets du pipeline Orchestrator Live LIRI (Groupe 1). '
  'Chaque projet contient les chapitres générés par IA, les slides par segment '
  'pédagogique et les logs de traitement des 4 agents (Coach, Visual, SmartBoard, Quality).';

COMMENT ON COLUMN public.liri_orchestrator_projects.id IS
  'Identifiant texte préfixé "liri_" généré côté Netlify Function.';

COMMENT ON COLUMN public.liri_orchestrator_projects.status IS
  'running | completed | error | idle';

COMMENT ON COLUMN public.liri_orchestrator_projects.agents IS
  'État des 4 agents IA : [{id, name, status, progress, jobsProcessed, currentTask, error}]';

COMMENT ON COLUMN public.liri_orchestrator_projects.chapters IS
  'Chapitres extraits du rawText : [{id, title, summary, status, coachStatus, ...}]';

COMMENT ON COLUMN public.liri_orchestrator_projects.slides IS
  'Slides générés par segment : [{chapterId, segmentName, layout, elements[], state, ...}]';

COMMENT ON COLUMN public.liri_orchestrator_projects.logs IS
  'Journal des opérations : [{agent, level, message, timestamp}]';
