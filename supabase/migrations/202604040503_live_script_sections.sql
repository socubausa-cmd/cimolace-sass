-- ─── Master Script — Phase 4 LIRI ───────────────────────────────────────────
-- Sections du script du cours, associées optionnellement à un index de slide.
-- L'hôte rédige avant le live et consulte en mode prompteur pendant le live.

CREATE TABLE IF NOT EXISTS public.live_script_sections (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    TEXT        NOT NULL,
  created_by    UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  slide_index   INTEGER,              -- NULL = section générale (pas liée à une diapo)
  content       TEXT        NOT NULL DEFAULT '',
  ai_content    TEXT,                 -- version améliorée par l'IA, NULL si non demandée
  order_index   INTEGER     NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS live_script_session_idx
  ON public.live_script_sections(session_id, order_index);

ALTER TABLE public.live_script_sections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lss_select" ON public.live_script_sections;
CREATE POLICY "lss_select"
  ON public.live_script_sections FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "lss_insert" ON public.live_script_sections;
CREATE POLICY "lss_insert"
  ON public.live_script_sections FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "lss_update" ON public.live_script_sections;
CREATE POLICY "lss_update"
  ON public.live_script_sections FOR UPDATE
  TO authenticated USING (auth.uid() = created_by) WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "lss_delete" ON public.live_script_sections;
CREATE POLICY "lss_delete"
  ON public.live_script_sections FOR DELETE
  TO authenticated USING (auth.uid() = created_by);

-- Realtime pour que les co-hôtes voient les modifs en temps réel
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'live_script_sections'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.live_script_sections;
  END IF;
END $$;
