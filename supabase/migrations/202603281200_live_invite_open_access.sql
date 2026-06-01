-- Ouvrir la lecture des sessions live à tout utilisateur authentifié
-- quand la session est en cours (status = 'live') — nécessaire pour le lien d'invitation.

DROP POLICY IF EXISTS "live_sessions_read" ON public.live_sessions;
CREATE POLICY "live_sessions_read" ON public.live_sessions FOR SELECT USING (
  -- Hôte
  teacher_id = auth.uid()
  -- Staff
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND lower(COALESCE(p.role, '')) IN ('owner', 'admin', 'secretariat')
  )
  -- Participant déjà inscrit
  OR public.internal_is_live_session_participant(id, auth.uid())
  -- Toute personne connectée peut lire une session en cours (lien d'invitation)
  OR status = 'live'
);

-- Permettre l'upsert dans live_session_participants pour les nouveaux invités
DROP POLICY IF EXISTS "live_participants_insert" ON public.live_session_participants;
CREATE POLICY "live_participants_insert" ON public.live_session_participants FOR INSERT WITH CHECK (
  user_id = auth.uid()
);
