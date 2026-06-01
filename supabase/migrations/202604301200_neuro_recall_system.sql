-- NeuroRecall — mémoire post-live (flashcards, rapports par nœud, progression).
-- Réutilise : live_transcripts, live_mindmaps, live_recordings, formation_day_contents (post-prod vidéo).

-- ─── État pipeline par session (1:1 live_sessions) ───────────────────────────
CREATE TABLE IF NOT EXISTS public.live_neuro_recall_state (
  live_session_id UUID PRIMARY KEY REFERENCES public.live_sessions(id) ON DELETE CASCADE,
  workflow_status TEXT NOT NULL DEFAULT 'idle'
    CHECK (workflow_status IN (
      'idle', 'processing', 'draft_generated', 'needs_review', 'approved', 'published'
    )),
  postproduction_content_id UUID REFERENCES public.formation_day_contents(id) ON DELETE SET NULL,
  replay_public_url TEXT,
  transcript_segments JSONB NOT NULL DEFAULT '[]'::jsonb,
  node_timestamp_map JSONB NOT NULL DEFAULT '{}'::jsonb,
  events_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  pipeline_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_live_neuro_recall_state_content
  ON public.live_neuro_recall_state(postproduction_content_id)
  WHERE postproduction_content_id IS NOT NULL;

COMMENT ON TABLE public.live_neuro_recall_state IS
  'NeuroRecall : lien live → post-production (formation_day_contents) + méta pipeline.';
COMMENT ON COLUMN public.live_neuro_recall_state.postproduction_content_id IS
  'formation_day_contents.id — même pipeline que VideoPostProductionPage (mindmap, chapitres, transcript).';

-- ─── Flashcards (extension NeuroRecall ; mindmap reste dans live_mindmaps) ──
CREATE TABLE IF NOT EXISTS public.live_neuro_flashcards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  live_session_id UUID NOT NULL REFERENCES public.live_sessions(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  card_type TEXT NOT NULL DEFAULT 'qa'
    CHECK (card_type IN ('qa', 'true_false', 'definition', 'cause_effect')),
  difficulty TEXT NOT NULL DEFAULT 'medium',
  topic TEXT,
  source_node_key TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_live_neuro_flashcards_session
  ON public.live_neuro_flashcards(live_session_id, sort_order);

-- ─── Rapports « notebook » par nœud de mindmap ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.live_neuro_recall_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  live_session_id UUID NOT NULL REFERENCES public.live_sessions(id) ON DELETE CASCADE,
  node_key TEXT NOT NULL,
  title TEXT,
  content TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(live_session_id, node_key)
);

CREATE INDEX IF NOT EXISTS idx_live_neuro_recall_reports_session
  ON public.live_neuro_recall_reports(live_session_id);

-- ─── Progression utilisateur par live ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.live_neuro_user_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  live_session_id UUID NOT NULL REFERENCES public.live_sessions(id) ON DELETE CASCADE,
  comprehension_score NUMERIC(5,2),
  flashcards_correct INT NOT NULL DEFAULT 0,
  flashcards_attempted INT NOT NULL DEFAULT 0,
  weak_concepts JSONB NOT NULL DEFAULT '[]'::jsonb,
  strong_concepts JSONB NOT NULL DEFAULT '[]'::jsonb,
  extra JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, live_session_id)
);

CREATE INDEX IF NOT EXISTS idx_live_neuro_user_progress_session
  ON public.live_neuro_user_progress(live_session_id);

-- Triggers updated_at
DROP TRIGGER IF EXISTS trg_live_neuro_recall_state_updated ON public.live_neuro_recall_state;
CREATE TRIGGER trg_live_neuro_recall_state_updated
  BEFORE UPDATE ON public.live_neuro_recall_state
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_live_neuro_recall_reports_updated ON public.live_neuro_recall_reports;
CREATE TRIGGER trg_live_neuro_recall_reports_updated
  BEFORE UPDATE ON public.live_neuro_recall_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_live_neuro_user_progress_updated ON public.live_neuro_user_progress;
CREATE TRIGGER trg_live_neuro_user_progress_updated
  BEFORE UPDATE ON public.live_neuro_user_progress
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── RLS ───────────────────────────────────────────────────────────────────
ALTER TABLE public.live_neuro_recall_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_neuro_flashcards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_neuro_recall_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_neuro_user_progress ENABLE ROW LEVEL SECURITY;

-- State : enseignant / co-hôte / modérateur (même logique que live_blueprints)
DROP POLICY IF EXISTS "live_neuro_recall_state_teacher" ON public.live_neuro_recall_state;
CREATE POLICY "live_neuro_recall_state_teacher"
  ON public.live_neuro_recall_state FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.live_sessions ls
      WHERE ls.id = live_neuro_recall_state.live_session_id
        AND (ls.teacher_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.live_session_participants lp
            WHERE lp.live_session_id = ls.id AND lp.user_id = auth.uid()
              AND lp.role IN ('host', 'co_host', 'moderator')
          ))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.live_sessions ls
      WHERE ls.id = live_neuro_recall_state.live_session_id
        AND (ls.teacher_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.live_session_participants lp
            WHERE lp.live_session_id = ls.id AND lp.user_id = auth.uid()
              AND lp.role IN ('host', 'co_host', 'moderator')
          ))
    )
  );

DROP POLICY IF EXISTS "live_neuro_recall_state_participant_read" ON public.live_neuro_recall_state;
CREATE POLICY "live_neuro_recall_state_participant_read"
  ON public.live_neuro_recall_state FOR SELECT TO authenticated
  USING (
    public.internal_is_live_session_participant(live_neuro_recall_state.live_session_id, auth.uid())
  );

-- Flashcards
DROP POLICY IF EXISTS "live_neuro_flashcards_teacher" ON public.live_neuro_flashcards;
CREATE POLICY "live_neuro_flashcards_teacher"
  ON public.live_neuro_flashcards FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.live_sessions ls
      WHERE ls.id = live_neuro_flashcards.live_session_id
        AND (ls.teacher_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.live_session_participants lp
            WHERE lp.live_session_id = ls.id AND lp.user_id = auth.uid()
              AND lp.role IN ('host', 'co_host', 'moderator')
          ))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.live_sessions ls
      WHERE ls.id = live_neuro_flashcards.live_session_id
        AND (ls.teacher_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.live_session_participants lp
            WHERE lp.live_session_id = ls.id AND lp.user_id = auth.uid()
              AND lp.role IN ('host', 'co_host', 'moderator')
          ))
    )
  );

DROP POLICY IF EXISTS "live_neuro_flashcards_participant_read" ON public.live_neuro_flashcards;
CREATE POLICY "live_neuro_flashcards_participant_read"
  ON public.live_neuro_flashcards FOR SELECT TO authenticated
  USING (
    public.internal_is_live_session_participant(live_neuro_flashcards.live_session_id, auth.uid())
  );

-- Reports
DROP POLICY IF EXISTS "live_neuro_recall_reports_teacher" ON public.live_neuro_recall_reports;
CREATE POLICY "live_neuro_recall_reports_teacher"
  ON public.live_neuro_recall_reports FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.live_sessions ls
      WHERE ls.id = live_neuro_recall_reports.live_session_id
        AND (ls.teacher_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.live_session_participants lp
            WHERE lp.live_session_id = ls.id AND lp.user_id = auth.uid()
              AND lp.role IN ('host', 'co_host', 'moderator')
          ))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.live_sessions ls
      WHERE ls.id = live_neuro_recall_reports.live_session_id
        AND (ls.teacher_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.live_session_participants lp
            WHERE lp.live_session_id = ls.id AND lp.user_id = auth.uid()
              AND lp.role IN ('host', 'co_host', 'moderator')
          ))
    )
  );

DROP POLICY IF EXISTS "live_neuro_recall_reports_participant_read" ON public.live_neuro_recall_reports;
CREATE POLICY "live_neuro_recall_reports_participant_read"
  ON public.live_neuro_recall_reports FOR SELECT TO authenticated
  USING (
    public.internal_is_live_session_participant(live_neuro_recall_reports.live_session_id, auth.uid())
  );

-- Progress : propriétaire de la ligne
DROP POLICY IF EXISTS "live_neuro_user_progress_own" ON public.live_neuro_user_progress;
CREATE POLICY "live_neuro_user_progress_own"
  ON public.live_neuro_user_progress FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "live_neuro_user_progress_teacher_read" ON public.live_neuro_user_progress;
CREATE POLICY "live_neuro_user_progress_teacher_read"
  ON public.live_neuro_user_progress FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.live_sessions ls
      WHERE ls.id = live_neuro_user_progress.live_session_id
        AND ls.teacher_id = auth.uid()
    )
  );
