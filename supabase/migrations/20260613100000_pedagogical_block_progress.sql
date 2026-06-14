-- ============================================================================
-- Migration: persistance serveur de la progression élève (blocs pédagogiques)
-- Date: 2026-06-13
--
-- Avant : StudentWeeklySchedulePage.markBlockCompleted n'écrivait qu'en
--   localStorage (perdu au changement d'appareil, invisible pour le prof).
-- Après : table pedagogical_block_progress tenant-scopée, upsert par l'élève,
--   lecture agrégée par le staff du tenant. tenant_id + week_id auto-remplis
--   par trigger depuis le bloc (l'élève n'envoie que block_id + score).
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.pedagogical_block_progress (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  block_id     uuid NOT NULL REFERENCES public.pedagogical_blocks(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_id      uuid REFERENCES public.module_weeks(id) ON DELETE CASCADE,
  status       text NOT NULL DEFAULT 'completed' CHECK (status IN ('completed','in_progress')),
  score        numeric,
  completed_at timestamptz NOT NULL DEFAULT now(),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, block_id)
);

CREATE INDEX IF NOT EXISTS idx_pbp_tenant_week ON public.pedagogical_block_progress(tenant_id, week_id);
CREATE INDEX IF NOT EXISTS idx_pbp_block       ON public.pedagogical_block_progress(block_id);
CREATE INDEX IF NOT EXISTS idx_pbp_user_week   ON public.pedagogical_block_progress(user_id, week_id);

-- ── Trigger : remplir tenant_id + week_id depuis le bloc ────────────────────
-- SECURITY DEFINER : la résolution du parent ne dépend pas des policies RLS
-- de l'élève. BEFORE INSERT s'exécute avant l'évaluation du WITH CHECK, donc
-- tenant_id est peuplé quand la policy élève vérifie l'appartenance.

CREATE OR REPLACE FUNCTION public.fill_block_progress_context()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.tenant_id IS NULL OR NEW.week_id IS NULL THEN
    SELECT COALESCE(NEW.tenant_id, pb.tenant_id), COALESCE(NEW.week_id, mw.id)
      INTO NEW.tenant_id, NEW.week_id
    FROM public.pedagogical_blocks pb
    JOIN public.week_days wd   ON wd.id = pb.day_id
    JOIN public.module_weeks mw ON mw.id = wd.week_id
    WHERE pb.id = NEW.block_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pbp_fill_context ON public.pedagogical_block_progress;
CREATE TRIGGER pbp_fill_context
  BEFORE INSERT ON public.pedagogical_block_progress
  FOR EACH ROW EXECUTE FUNCTION public.fill_block_progress_context();

DROP TRIGGER IF EXISTS pbp_updated_at ON public.pedagogical_block_progress;
CREATE TRIGGER pbp_updated_at
  BEFORE UPDATE ON public.pedagogical_block_progress
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.pedagogical_block_progress ENABLE ROW LEVEL SECURITY;

-- Élève : gère sa propre progression, uniquement pour les blocs d'un tenant
-- où il est membre actif (empêche d'écrire pour le contenu d'un autre tenant).
DROP POLICY IF EXISTS pbp_student_own ON public.pedagogical_block_progress;
CREATE POLICY pbp_student_own ON public.pedagogical_block_progress
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.tenant_memberships tm
      WHERE tm.tenant_id = pedagogical_block_progress.tenant_id
        AND tm.user_id = auth.uid() AND tm.status = 'active'
    )
  );

-- Staff du tenant : lecture agrégée (suivi de classe).
DROP POLICY IF EXISTS pbp_staff_read ON public.pedagogical_block_progress;
CREATE POLICY pbp_staff_read ON public.pedagogical_block_progress
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.tenant_memberships tm
    WHERE tm.tenant_id = pedagogical_block_progress.tenant_id
      AND tm.user_id = auth.uid() AND tm.status = 'active'
      AND tm.role IN ('owner','admin','teacher')
  ));

DROP POLICY IF EXISTS pbp_service ON public.pedagogical_block_progress;
CREATE POLICY pbp_service ON public.pedagogical_block_progress
  FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMENT ON TABLE public.pedagogical_block_progress IS 'Progression élève par bloc pédagogique (remplace le localStorage). tenant_id/week_id auto-remplis par trigger depuis le bloc.';

COMMIT;
