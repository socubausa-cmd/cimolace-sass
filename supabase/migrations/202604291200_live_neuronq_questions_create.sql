-- Neuron-Q (live production) : table attendue par LiveArenaPage.
-- L’ancienne migration 202603290900 ne faisait qu’un ALTER sans CREATE.

CREATE TABLE IF NOT EXISTS public.live_neuronq_questions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  live_session_id   UUID NOT NULL REFERENCES public.live_sessions(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  raw_text          TEXT NOT NULL,
  reformulated_text TEXT,
  status            TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'answered', 'skipped')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_live_neuronq_session_created
  ON public.live_neuronq_questions(live_session_id, created_at ASC);

ALTER TABLE public.live_neuronq_questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "live_neuronq_select" ON public.live_neuronq_questions;
CREATE POLICY "live_neuronq_select" ON public.live_neuronq_questions
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.internal_live_session_teacher_id(live_session_id) = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND lower(COALESCE(p.role, '')) IN ('owner', 'admin', 'secretariat')
    )
  );

DROP POLICY IF EXISTS "live_neuronq_insert" ON public.live_neuronq_questions;
CREATE POLICY "live_neuronq_insert" ON public.live_neuronq_questions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "live_neuronq_update" ON public.live_neuronq_questions;
CREATE POLICY "live_neuronq_update" ON public.live_neuronq_questions
  FOR UPDATE TO authenticated
  USING (
    public.internal_live_session_teacher_id(live_session_id) = auth.uid()
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'live_neuronq_questions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.live_neuronq_questions;
  END IF;
END $$;
