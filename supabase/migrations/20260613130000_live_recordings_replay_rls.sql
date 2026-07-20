-- ============================================================================
-- Migration: réparation RLS des replays live (Supabase Storage, sans R2)
-- Date: 2026-06-13
--
-- État constaté (pipeline replay jamais fonctionnel, 0 ligne) :
--  * live_recordings : SEULE policy = SELECT staff-only → les élèves ne
--    peuvent pas voir les replays, et AUCUNE policy INSERT → tout insert
--    client (le host enregistre côté navigateur) est refusé par la RLS.
--  * storage.objects (bucket live-recordings) : policies « dossier perso »
--    (folder[1] = auth.uid()) → un élève ne peut pas lire l'objet du host.
--
-- Cette migration (le schéma de colonnes prod = output_url/storage_filepath
-- reste la référence ; le code writer/reader est aligné dessus en parallèle) :
--  1. live_recordings : INSERT = staff du tenant de la session ;
--     SELECT = membre actif du tenant (élèves inclus) au lieu de staff-only.
--  2. storage.objects : lecture d'un enregistrement = propriétaire du dossier
--     OU membre actif du tenant de la session (le sessionId est folder[2] du
--     chemin `<host_uid>/<sessionId>/<ts>.webm`).
-- ============================================================================

BEGIN;

-- ── 1. live_recordings (table) ──────────────────────────────────────────────

-- SELECT : remplacer le staff-only par « membre actif du tenant ».
DROP POLICY IF EXISTS "Recordings visibles par staff tenant" ON public.live_recordings;
DROP POLICY IF EXISTS lr_tenant_member_read ON public.live_recordings;
CREATE POLICY lr_tenant_member_read ON public.live_recordings
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.live_sessions ls
    JOIN public.tenant_memberships tm ON tm.tenant_id = ls.tenant_id
    WHERE ls.id = live_recordings.live_session_id
      AND tm.user_id = auth.uid() AND tm.status = 'active'
  ));

-- INSERT : le host (staff du tenant de la session) crée la ligne de replay.
DROP POLICY IF EXISTS lr_staff_insert ON public.live_recordings;
CREATE POLICY lr_staff_insert ON public.live_recordings
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.live_sessions ls
    JOIN public.tenant_memberships tm ON tm.tenant_id = ls.tenant_id
    WHERE ls.id = live_recordings.live_session_id
      AND tm.user_id = auth.uid() AND tm.status = 'active'
      AND tm.role IN ('owner', 'admin', 'teacher')
  ));

-- UPDATE : staff du tenant (finalisation : completed_at, duration, output_url).
DROP POLICY IF EXISTS lr_staff_update ON public.live_recordings;
CREATE POLICY lr_staff_update ON public.live_recordings
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.live_sessions ls
    JOIN public.tenant_memberships tm ON tm.tenant_id = ls.tenant_id
    WHERE ls.id = live_recordings.live_session_id
      AND tm.user_id = auth.uid() AND tm.status = 'active'
      AND tm.role IN ('owner', 'admin', 'teacher')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.live_sessions ls
    JOIN public.tenant_memberships tm ON tm.tenant_id = ls.tenant_id
    WHERE ls.id = live_recordings.live_session_id
      AND tm.user_id = auth.uid() AND tm.status = 'active'
      AND tm.role IN ('owner', 'admin', 'teacher')
  ));

-- service_role : accès complet (webhook egress LiveKit côté serveur).
DROP POLICY IF EXISTS lr_service ON public.live_recordings;
CREATE POLICY lr_service ON public.live_recordings
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── 2. storage.objects (bucket live-recordings) ─────────────────────────────
-- Lecture d'un objet = propriétaire du dossier OU membre actif du tenant de la
-- session. Chemin attendu : `<host_uid>/<sessionId>/<ts>.webm` → sessionId =
-- folder[2]. On garde la policy « dossier perso » pour le host et on ajoute la
-- lecture par membre du tenant.
DROP POLICY IF EXISTS "live_recordings_member_select" ON storage.objects;
CREATE POLICY "live_recordings_member_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'live-recordings'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR EXISTS (
        SELECT 1 FROM public.live_sessions ls
        JOIN public.tenant_memberships tm ON tm.tenant_id = ls.tenant_id
        WHERE ls.id::text = (storage.foldername(name))[2]
          AND tm.user_id = auth.uid() AND tm.status = 'active'
      )
    )
  );

COMMIT;
