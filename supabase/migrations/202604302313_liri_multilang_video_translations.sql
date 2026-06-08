-- LIRI multilingue — lien session live + traductions export vidéo par langue.

ALTER TABLE public.liri_multilang_live_sessions
  ADD COLUMN IF NOT EXISTS linked_live_session_id text;

CREATE INDEX IF NOT EXISTS idx_liri_ml_live_linked_session ON public.liri_multilang_live_sessions (linked_live_session_id)
  WHERE linked_live_session_id IS NOT NULL;

COMMENT ON COLUMN public.liri_multilang_live_sessions.linked_live_session_id IS 'Optionnel : id live_sessions pour corrélation analytics / facturation.';

CREATE TABLE IF NOT EXISTS public.liri_multilang_video_translations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.liri_multilang_video_projects (id) ON DELETE CASCADE,
  target_lang text NOT NULL,
  lines jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT liri_multilang_video_translations_project_lang UNIQUE (project_id, target_lang)
);

CREATE INDEX IF NOT EXISTS idx_liri_ml_vt_project ON public.liri_multilang_video_translations (project_id);

COMMENT ON TABLE public.liri_multilang_video_translations IS 'Transcription traduite par langue cible pour un projet vidéo multilingue.';

ALTER TABLE public.liri_multilang_video_translations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "liri_ml_vt_select" ON public.liri_multilang_video_translations;
CREATE POLICY "liri_ml_vt_select"
ON public.liri_multilang_video_translations FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.liri_multilang_video_projects p
    WHERE p.id = liri_multilang_video_translations.project_id AND p.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "liri_ml_vt_insert" ON public.liri_multilang_video_translations;
CREATE POLICY "liri_ml_vt_insert"
ON public.liri_multilang_video_translations FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.liri_multilang_video_projects p
    WHERE p.id = liri_multilang_video_translations.project_id AND p.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "liri_ml_vt_update" ON public.liri_multilang_video_translations;
CREATE POLICY "liri_ml_vt_update"
ON public.liri_multilang_video_translations FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.liri_multilang_video_projects p
    WHERE p.id = liri_multilang_video_translations.project_id AND p.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.liri_multilang_video_projects p
    WHERE p.id = liri_multilang_video_translations.project_id AND p.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "liri_ml_vt_delete" ON public.liri_multilang_video_translations;
CREATE POLICY "liri_ml_vt_delete"
ON public.liri_multilang_video_translations FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.liri_multilang_video_projects p
    WHERE p.id = liri_multilang_video_translations.project_id AND p.user_id = auth.uid()
  )
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.liri_multilang_video_translations TO authenticated;
