-- Colonnes nécessaires au Live Studio Wizard et à la session live
-- Toutes les commandes utilisent IF NOT EXISTS pour être idempotentes.

-- cover_image_url & duration_minutes (step 1 du wizard)
ALTER TABLE public.live_sessions
  ADD COLUMN IF NOT EXISTS cover_image_url  TEXT,
  ADD COLUMN IF NOT EXISTS duration_minutes INT DEFAULT 60;

-- ambient_tracks_json (step 7 du wizard — ambiances sonores)
ALTER TABLE public.live_sessions
  ADD COLUMN IF NOT EXISTS ambient_tracks_json JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Idem pour immersive_live_sessions si elle existe
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'immersive_live_sessions'
  ) THEN
    BEGIN
      ALTER TABLE public.immersive_live_sessions
        ADD COLUMN IF NOT EXISTS ambient_tracks_json JSONB NOT NULL DEFAULT '[]'::jsonb;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;
END $$;

-- Index performances messages (sender / receiver queries)
CREATE INDEX IF NOT EXISTS idx_messages_sender_created_at
  ON public.messages(sender_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_receiver_created_at
  ON public.messages(receiver_id, created_at DESC);

-- Fonctions helper pour éviter la récursion infinie dans les RLS live_sessions
CREATE OR REPLACE FUNCTION public.internal_live_session_teacher_id(p_session_id uuid)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT teacher_id FROM public.live_sessions WHERE id = p_session_id;
$$;

CREATE OR REPLACE FUNCTION public.internal_is_live_session_participant(p_session_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.live_session_participants
    WHERE live_session_id = p_session_id AND user_id = p_user_id
  );
$$;

REVOKE ALL ON FUNCTION public.internal_live_session_teacher_id(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.internal_live_session_teacher_id(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.internal_is_live_session_participant(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.internal_is_live_session_participant(uuid, uuid) TO authenticated, service_role;

-- RLS live_sessions — utilise les fonctions helper pour casser la récursion
DROP POLICY IF EXISTS "live_sessions_read" ON public.live_sessions;
CREATE POLICY "live_sessions_read" ON public.live_sessions FOR SELECT USING (
  teacher_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND lower(COALESCE(p.role, '')) IN ('owner', 'admin', 'secretariat')
  )
  OR public.internal_is_live_session_participant(id, auth.uid())
);

-- RLS live_session_participants — utilise les fonctions helper
DROP POLICY IF EXISTS "live_participants_read" ON public.live_session_participants;
CREATE POLICY "live_participants_read" ON public.live_session_participants FOR SELECT USING (
  user_id = auth.uid()
  OR public.internal_live_session_teacher_id(live_session_id) = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND lower(COALESCE(p.role, '')) IN ('owner', 'admin', 'secretariat')
  )
);

DROP POLICY IF EXISTS "live_participants_update" ON public.live_session_participants;
CREATE POLICY "live_participants_update" ON public.live_session_participants FOR UPDATE USING (
  user_id = auth.uid()
  OR public.internal_live_session_teacher_id(live_session_id) = auth.uid()
);
