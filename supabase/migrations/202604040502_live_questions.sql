-- ─── Live Questions — NEURON-Q ──────────────────────────────────────────────
-- Questions posées par les élèves pendant un live immersif.
-- L'IA reformule le texte brut avant soumission (côté client via fonction Netlify).

CREATE TABLE IF NOT EXISTS public.live_questions (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id         TEXT        NOT NULL,
  user_id            UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_name          TEXT        NOT NULL DEFAULT '',
  raw_text           TEXT        NOT NULL,
  reformulated_text  TEXT,
  status             TEXT        NOT NULL DEFAULT 'pending'
                                  CHECK (status IN ('pending', 'answered', 'skipped')),
  display_order      INTEGER,
  asked_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS live_questions_session_idx
  ON public.live_questions(session_id, asked_at);

ALTER TABLE public.live_questions ENABLE ROW LEVEL SECURITY;

-- Tout participant authentifié peut insérer ses propres questions
DROP POLICY IF EXISTS "lq_insert_own" ON public.live_questions;
CREATE POLICY "lq_insert_own"
  ON public.live_questions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Tout participant peut lire les questions de la session (hôte + élèves)
DROP POLICY IF EXISTS "lq_select_session" ON public.live_questions;
CREATE POLICY "lq_select_session"
  ON public.live_questions FOR SELECT
  TO authenticated
  USING (true);

-- Seul l'hôte peut mettre à jour le statut (contrôle fin géré côté app)
DROP POLICY IF EXISTS "lq_update_host" ON public.live_questions;
CREATE POLICY "lq_update_host"
  ON public.live_questions FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Realtime pour affichage en temps réel dans le panel hôte
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'live_questions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.live_questions;
  END IF;
END $$;
