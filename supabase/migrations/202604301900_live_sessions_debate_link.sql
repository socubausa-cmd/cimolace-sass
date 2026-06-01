-- Lier une session Live Arena à un débat (DebateCore) + lecture RLS pour les participants au débat

ALTER TABLE public.live_sessions
  ADD COLUMN IF NOT EXISTS debate_id UUID REFERENCES public.debates(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_live_sessions_debate_id ON public.live_sessions(debate_id) WHERE debate_id IS NOT NULL;

COMMENT ON COLUMN public.live_sessions.debate_id IS 'Si défini, session Arena au service d’un débat DebateCore (accès restreint aux debate_participants + hôte).';

-- Ne pas recréer de CHECK sur session_type : des lignes existantes peuvent avoir d’autres valeurs
-- (ex. évolutions successives des migrations, booking, scripts manuels). Recréer une liste fermée
-- provoque ERROR 23514. L’app envoie session_type = 'debate' pour DebateCore ; validation métier côté API/UI.
ALTER TABLE public.live_sessions DROP CONSTRAINT IF EXISTS live_sessions_session_type_check;

-- Les participants au débat peuvent lire la ligne live_sessions liée (sans être encore dans live_session_participants)
DROP POLICY IF EXISTS "live_sessions_read" ON public.live_sessions;
CREATE POLICY "live_sessions_read" ON public.live_sessions FOR SELECT USING (
  teacher_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND lower(COALESCE(p.role, '')) IN ('owner', 'admin', 'secretariat')
  )
  OR public.internal_is_live_session_participant(id, auth.uid())
  OR (
    debate_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.debate_participants dp
      WHERE dp.debate_id = live_sessions.debate_id
        AND dp.user_id = auth.uid()
    )
  )
);
