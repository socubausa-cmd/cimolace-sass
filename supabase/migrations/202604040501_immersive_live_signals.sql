-- ============================================================
-- PRORASCIENCE — WebRTC signaling for immersive live
-- ============================================================

CREATE TABLE IF NOT EXISTS public.immersive_live_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  live_session_id UUID NOT NULL REFERENCES public.immersive_live_sessions(id) ON DELETE CASCADE,
  conversation_key TEXT NOT NULL,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('offer', 'answer', 'ice', 'hangup', 'screen-start', 'screen-stop')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_immersive_live_signals_session
  ON public.immersive_live_signals(live_session_id, created_at);

CREATE INDEX IF NOT EXISTS idx_immersive_live_signals_target
  ON public.immersive_live_signals(target_id, created_at);

ALTER TABLE public.immersive_live_signals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "immersive_live_signals_read" ON public.immersive_live_signals;
DROP POLICY IF EXISTS "immersive_live_signals_insert" ON public.immersive_live_signals;

CREATE POLICY "immersive_live_signals_read"
ON public.immersive_live_signals FOR SELECT TO authenticated
USING (
  sender_id = auth.uid()
  OR target_id = auth.uid()
  OR target_id IS NULL
  OR EXISTS (
    SELECT 1 FROM public.immersive_live_sessions s
    WHERE s.id = immersive_live_signals.live_session_id
      AND (s.host_user_id = auth.uid() OR s.guest_user_id = auth.uid())
  )
);

CREATE POLICY "immersive_live_signals_insert"
ON public.immersive_live_signals FOR INSERT TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.immersive_live_sessions s
    WHERE s.id = immersive_live_signals.live_session_id
      AND (s.host_user_id = auth.uid() OR s.guest_user_id = auth.uid())
  )
  AND (
    target_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.immersive_live_sessions s
      WHERE s.id = immersive_live_signals.live_session_id
        AND (target_id = s.host_user_id OR target_id = s.guest_user_id)
    )
  )
);

ALTER TABLE public.immersive_live_signals REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.immersive_live_signals;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
