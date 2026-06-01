-- ============================================================
-- PRORASCIENCE — Live-Room Immersif (messaging-first)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.immersive_live_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_key TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT 'Live-Room Immersif',
  host_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  guest_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'ended')),
  room_name TEXT,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_immersive_live_sessions_conversation
  ON public.immersive_live_sessions(conversation_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_immersive_live_sessions_host
  ON public.immersive_live_sessions(host_user_id);
CREATE INDEX IF NOT EXISTS idx_immersive_live_sessions_guest
  ON public.immersive_live_sessions(guest_user_id);

CREATE TABLE IF NOT EXISTS public.immersive_live_slides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  live_session_id UUID REFERENCES public.immersive_live_sessions(id) ON DELETE CASCADE,
  conversation_key TEXT NOT NULL,
  order_index INT NOT NULL DEFAULT 0,
  title TEXT,
  style_variant TEXT DEFAULT 'premium-dark',
  layout_type TEXT DEFAULT 'free',
  background_mode TEXT DEFAULT 'immersive-dark',
  data_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_immersive_live_slides_conversation
  ON public.immersive_live_slides(conversation_key, order_index);
CREATE INDEX IF NOT EXISTS idx_immersive_live_slides_session
  ON public.immersive_live_slides(live_session_id, order_index);

CREATE TABLE IF NOT EXISTS public.immersive_live_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  live_session_id UUID NOT NULL REFERENCES public.immersive_live_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'participant' CHECK (role IN ('host', 'participant', 'moderator')),
  joined_at TIMESTAMPTZ,
  left_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(live_session_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_immersive_live_participants_session
  ON public.immersive_live_participants(live_session_id);

CREATE TABLE IF NOT EXISTS public.immersive_live_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  live_session_id UUID NOT NULL REFERENCES public.immersive_live_sessions(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_immersive_live_chat_session
  ON public.immersive_live_chat_messages(live_session_id, created_at);

ALTER TABLE public.immersive_live_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.immersive_live_slides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.immersive_live_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.immersive_live_chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "immersive_live_sessions_read" ON public.immersive_live_sessions;
DROP POLICY IF EXISTS "immersive_live_sessions_insert" ON public.immersive_live_sessions;
DROP POLICY IF EXISTS "immersive_live_sessions_update" ON public.immersive_live_sessions;
DROP POLICY IF EXISTS "immersive_live_slides_read" ON public.immersive_live_slides;
DROP POLICY IF EXISTS "immersive_live_slides_write" ON public.immersive_live_slides;
DROP POLICY IF EXISTS "immersive_live_participants_read" ON public.immersive_live_participants;
DROP POLICY IF EXISTS "immersive_live_participants_write" ON public.immersive_live_participants;
DROP POLICY IF EXISTS "immersive_live_chat_read" ON public.immersive_live_chat_messages;
DROP POLICY IF EXISTS "immersive_live_chat_insert" ON public.immersive_live_chat_messages;

CREATE POLICY "immersive_live_sessions_read"
ON public.immersive_live_sessions FOR SELECT TO authenticated
USING (host_user_id = auth.uid() OR guest_user_id = auth.uid());

CREATE POLICY "immersive_live_sessions_insert"
ON public.immersive_live_sessions FOR INSERT TO authenticated
WITH CHECK (host_user_id = auth.uid());

CREATE POLICY "immersive_live_sessions_update"
ON public.immersive_live_sessions FOR UPDATE TO authenticated
USING (host_user_id = auth.uid() OR guest_user_id = auth.uid())
WITH CHECK (host_user_id = auth.uid() OR guest_user_id = auth.uid());

CREATE POLICY "immersive_live_slides_read"
ON public.immersive_live_slides FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.immersive_live_sessions s
    WHERE (s.host_user_id = auth.uid() OR s.guest_user_id = auth.uid())
      AND (s.id = immersive_live_slides.live_session_id OR s.conversation_key = immersive_live_slides.conversation_key)
  )
  OR created_by = auth.uid()
);

CREATE POLICY "immersive_live_slides_write"
ON public.immersive_live_slides FOR ALL TO authenticated
USING (created_by = auth.uid())
WITH CHECK (created_by = auth.uid());

CREATE POLICY "immersive_live_participants_read"
ON public.immersive_live_participants FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.immersive_live_sessions s
    WHERE s.id = immersive_live_participants.live_session_id
      AND (s.host_user_id = auth.uid() OR s.guest_user_id = auth.uid())
  )
);

CREATE POLICY "immersive_live_participants_write"
ON public.immersive_live_participants FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "immersive_live_chat_read"
ON public.immersive_live_chat_messages FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.immersive_live_sessions s
    WHERE s.id = immersive_live_chat_messages.live_session_id
      AND (s.host_user_id = auth.uid() OR s.guest_user_id = auth.uid())
  )
);

CREATE POLICY "immersive_live_chat_insert"
ON public.immersive_live_chat_messages FOR INSERT TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.immersive_live_sessions s
    WHERE s.id = immersive_live_chat_messages.live_session_id
      AND (s.host_user_id = auth.uid() OR s.guest_user_id = auth.uid())
  )
);

ALTER TABLE public.immersive_live_sessions REPLICA IDENTITY FULL;
ALTER TABLE public.immersive_live_slides REPLICA IDENTITY FULL;
ALTER TABLE public.immersive_live_chat_messages REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.immersive_live_sessions;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.immersive_live_slides;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.immersive_live_chat_messages;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

CREATE OR REPLACE FUNCTION public.set_immersive_live_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_immersive_live_sessions_updated ON public.immersive_live_sessions;
CREATE TRIGGER trg_immersive_live_sessions_updated
BEFORE UPDATE ON public.immersive_live_sessions
FOR EACH ROW
EXECUTE FUNCTION public.set_immersive_live_updated_at();

DROP TRIGGER IF EXISTS trg_immersive_live_slides_updated ON public.immersive_live_slides;
CREATE TRIGGER trg_immersive_live_slides_updated
BEFORE UPDATE ON public.immersive_live_slides
FOR EACH ROW
EXECUTE FUNCTION public.set_immersive_live_updated_at();
