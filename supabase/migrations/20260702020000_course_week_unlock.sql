-- ============================================================================
-- #44 — DÉBLOCAGE PROGRESSIF par SEMAINE, CURSUS SEUL, RÉTROACTIF (choix user).
-- ----------------------------------------------------------------------------
-- Une semaine (formation_weeks) peut porter une date de déblocage `unlock_at`.
-- Effet UNIQUEMENT si le cours est en mode='cursus' (continue/masterclass =
-- toujours libre). unlock_at NULL ou passé = accessible → le passé est
-- automatiquement RÉTROACTIF (les élèves déjà inscrits gardent l'accès).
-- Additif. Écriture via RPC à garde ; lecture des verrous via fonction dédiée.
-- ============================================================================

ALTER TABLE public.formation_weeks ADD COLUMN IF NOT EXISTS unlock_at timestamptz;
COMMENT ON COLUMN public.formation_weeks.unlock_at IS
  'Date de déblocage de la semaine (#44). Effet SEULEMENT si courses.mode=cursus. NULL ou passé = accessible (le passé est rétroactif).';

-- Setter : garde encadrant du tenant du cours (chaîne week→module→course→tenant).
CREATE OR REPLACE FUNCTION public.set_week_unlock(p_week_id uuid, p_unlock_at timestamptz)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_tenant uuid;
BEGIN
  SELECT c.tenant_id INTO v_tenant
  FROM public.formation_weeks fw
  JOIN public.modules m ON m.id = fw.module_id
  JOIN public.courses c ON c.id = m.formation_id
  WHERE fw.id = p_week_id;
  IF v_tenant IS NULL THEN RAISE EXCEPTION 'Semaine introuvable'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.tenant_memberships tm WHERE tm.tenant_id = v_tenant AND tm.user_id = auth.uid() AND tm.status='active' AND tm.role IN ('owner','admin')) THEN
    RAISE EXCEPTION 'Réservé à un encadrant du tenant';
  END IF;
  UPDATE public.formation_weeks SET unlock_at = p_unlock_at WHERE id = p_week_id;
END $$;
REVOKE ALL ON FUNCTION public.set_week_unlock(uuid, timestamptz) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.set_week_unlock(uuid, timestamptz) TO authenticated;

-- Semaines VERROUILLÉES d'un cours à l'instant présent : seulement si le cours
-- est en mode='cursus' ET la semaine a une unlock_at dans le FUTUR. Le front
-- grise/verrouille ces semaines. SECURITY DEFINER (lit courses/formation_weeks).
CREATE OR REPLACE FUNCTION public.get_course_locked_week_ids(p_course_id uuid)
RETURNS TABLE(week_id uuid, unlock_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT fw.id, fw.unlock_at
  FROM public.courses c
  JOIN public.modules m ON m.formation_id = c.id
  JOIN public.formation_weeks fw ON fw.module_id = m.id
  WHERE c.id = p_course_id
    AND c.mode = 'cursus'
    AND fw.unlock_at IS NOT NULL
    AND fw.unlock_at > now();
$$;
REVOKE ALL ON FUNCTION public.get_course_locked_week_ids(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_course_locked_week_ids(uuid) TO authenticated;
