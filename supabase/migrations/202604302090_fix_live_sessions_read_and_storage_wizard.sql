-- Fix dashboard / LIRI : lectures live_sessions avec embeds + uploads wizard (slides, images partagées, ambiance).
--
-- Contexte erreurs client :
-- • HTTP 500 sur /rest/v1/live_* : souvent politique RLS + jointures PostgREST quand la ligne live_sessions
--   n'est pas lisible par l'utilisateur (invité sans droit sur la session, session "live" sans branche RLS, etc.).
-- • HTTP 400 Storage "new row violates row-level security" : politique bucket `videos` trop restrictive
--   (ex. seulement certains rôles profiles) alors que l'app upload depuis le studio pour tout utilisateur connecté.
--
-- Prérequis : fonctions public.internal_is_live_session_participant / internal_live_session_teacher_id
-- (migration 202603271920). Table public.debate_participants (migrations DebateCore) pour la sous-requête débat.

-- ─── live_sessions : lecture pour invités, sessions en direct, débat, participant ─────────────
DROP POLICY IF EXISTS "live_sessions_read" ON public.live_sessions;
CREATE POLICY "live_sessions_read" ON public.live_sessions FOR SELECT USING (
  teacher_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND lower(COALESCE(p.role, '')) IN ('owner', 'admin', 'secretariat')
  )
  OR public.internal_is_live_session_participant(id, auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.live_invitations li
    WHERE li.live_session_id = live_sessions.id
      AND li.user_id = auth.uid()
      AND li.status IN ('pending', 'sent', 'seen', 'accepted')
  )
  OR (
    debate_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.debate_participants dp
      WHERE dp.debate_id = live_sessions.debate_id
        AND dp.user_id = auth.uid()
    )
  )
  OR status = 'live'
);

-- ─── Storage bucket videos : chemins utilisés par le Live Studio (sans exiger un rôle "teacher" précis) ─
DROP POLICY IF EXISTS "Videos: wizard prefixes insert" ON storage.objects;
CREATE POLICY "Videos: wizard prefixes insert" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'videos'
  AND (
    name LIKE 'slides/%'
    OR name LIKE 'shared-images/%'
    OR name LIKE 'ambient/%'
    OR name LIKE 'ambient-prod/%'
  )
);

DROP POLICY IF EXISTS "Videos: wizard prefixes update" ON storage.objects;
CREATE POLICY "Videos: wizard prefixes update" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'videos'
  AND (
    name LIKE 'slides/%'
    OR name LIKE 'shared-images/%'
    OR name LIKE 'ambient/%'
    OR name LIKE 'ambient-prod/%'
  )
)
WITH CHECK (
  bucket_id = 'videos'
  AND (
    name LIKE 'slides/%'
    OR name LIKE 'shared-images/%'
    OR name LIKE 'ambient/%'
    OR name LIKE 'ambient-prod/%'
  )
);

DROP POLICY IF EXISTS "Videos: wizard prefixes delete" ON storage.objects;
CREATE POLICY "Videos: wizard prefixes delete" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'videos'
  AND (
    name LIKE 'slides/%'
    OR name LIKE 'shared-images/%'
    OR name LIKE 'ambient/%'
    OR name LIKE 'ambient-prod/%'
  )
);
