-- ─── Post-live Summary — Phase 5 LIRI ───────────────────────────────────────
-- Résumé automatique généré après chaque session live immersive.

CREATE TABLE IF NOT EXISTS public.live_session_summaries (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id            TEXT        UNIQUE NOT NULL,
  host_id               UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  -- Timing
  duration_seconds      INTEGER     NOT NULL DEFAULT 0,
  started_at            TIMESTAMPTZ,
  ended_at              TIMESTAMPTZ,
  -- Slides
  slides_covered        JSONB       NOT NULL DEFAULT '[]',
  -- [{ index: number, title?: string, duration_s: number }]
  -- NEURON-Q
  questions_total       INTEGER     NOT NULL DEFAULT 0,
  questions_answered    INTEGER     NOT NULL DEFAULT 0,
  questions_skipped     INTEGER     NOT NULL DEFAULT 0,
  -- Master Script
  script_sections_total INTEGER     NOT NULL DEFAULT 0,
  -- IA
  ai_summary            TEXT,
  key_points            TEXT[]      NOT NULL DEFAULT '{}',
  -- Méta
  participant_name      TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.live_session_summaries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lss_summary_host_all" ON public.live_session_summaries;
CREATE POLICY "lss_summary_host_all"
  ON public.live_session_summaries FOR ALL
  TO authenticated
  USING  (auth.uid() = host_id)
  WITH CHECK (auth.uid() = host_id);

DROP POLICY IF EXISTS "lss_summary_select" ON public.live_session_summaries;
CREATE POLICY "lss_summary_select"
  ON public.live_session_summaries FOR SELECT
  TO authenticated
  USING (true);
