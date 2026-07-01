-- ============================================================================
-- PHASE 2 (#39) — Flag courses.mode : discriminateur de PRÉSENTATION.
-- ----------------------------------------------------------------------------
-- Le schéma des cours est emmêlé (plusieurs hiérarchies de contenu qui se
-- chevauchent : course_modules/lessons, modules/formation_weeks/days,
-- module_weeks/week_days, masterclass_*). On N'Y TOUCHE PAS. On ajoute un simple
-- discriminateur sur `courses` pour que le hub adaptatif choisisse la bonne
-- présentation/lecteur, sans migration structurelle :
--   • continue    → formation libre, self-paced (cas de TOUS les cours actuels)
--   • cursus      → parcours structuré avec progression/déblocage (semaines/jours)
--   • masterclass → session unique premium (live/replay ou vidéo unique)
-- Additif, backfill par le DEFAULT ('continue'). Réversible.
-- ============================================================================

ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'continue';

-- CHECK idempotent (ne pas planter si rejoué).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.courses'::regclass AND conname = 'courses_mode_chk'
  ) THEN
    ALTER TABLE public.courses
      ADD CONSTRAINT courses_mode_chk CHECK (mode IN ('cursus', 'continue', 'masterclass'));
  END IF;
END $$;

COMMENT ON COLUMN public.courses.mode IS
  'Discriminateur de présentation (Phase 2) : cursus | continue | masterclass. Choisit le lecteur/hub adaptatif, sans changer les tables de structure.';

-- ----------------------------------------------------------------------------
-- Setter réservé encadrant (owner/admin/practitioner du tenant du cours).
-- SECURITY DEFINER (courses est écrit via l'API service/RLS) — même patron que
-- request_replay_postprod / set_replay_forum_visibility.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_course_mode(p_course_id uuid, p_mode text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid;
BEGIN
  IF p_mode NOT IN ('cursus', 'continue', 'masterclass') THEN
    RAISE EXCEPTION 'Mode invalide (cursus|continue|masterclass)';
  END IF;

  SELECT tenant_id INTO v_tenant FROM public.courses WHERE id = p_course_id;
  IF v_tenant IS NULL THEN RAISE EXCEPTION 'Cours introuvable'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.tenant_memberships tm
    WHERE tm.tenant_id = v_tenant AND tm.user_id = auth.uid()
      AND tm.status = 'active' AND tm.role IN ('owner', 'admin', 'practitioner')
  ) THEN
    RAISE EXCEPTION 'Réservé à un encadrant du tenant';
  END IF;

  UPDATE public.courses SET mode = p_mode, updated_at = now() WHERE id = p_course_id;
  RETURN jsonb_build_object('course_id', p_course_id, 'mode', p_mode);
END $$;

REVOKE ALL ON FUNCTION public.set_course_mode(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.set_course_mode(uuid, text) TO authenticated;

COMMENT ON FUNCTION public.set_course_mode(uuid, text) IS
  'Phase 2 : pose courses.mode (cursus|continue|masterclass). Garde encadrant. SECURITY DEFINER.';
