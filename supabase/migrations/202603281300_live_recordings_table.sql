-- Table pour stocker les métadonnées des enregistrements live
CREATE TABLE IF NOT EXISTS public.live_recordings (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  live_session_id  UUID NOT NULL REFERENCES public.live_sessions(id) ON DELETE CASCADE,
  file_path        TEXT NOT NULL,
  file_size        BIGINT,
  duration_seconds INT,
  recorded_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by       UUID REFERENCES auth.users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ajouter les colonnes manquantes si la table existe déjà sans elles
ALTER TABLE public.live_recordings ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);
ALTER TABLE public.live_recordings ADD COLUMN IF NOT EXISTS duration_seconds INT;

-- Index performance
CREATE INDEX IF NOT EXISTS idx_live_recordings_session
  ON public.live_recordings(live_session_id, recorded_at DESC);

-- RLS
ALTER TABLE public.live_recordings ENABLE ROW LEVEL SECURITY;

-- Lecture : l'hôte, les participants et le staff peuvent voir
DROP POLICY IF EXISTS "live_recordings_read" ON public.live_recordings;
CREATE POLICY "live_recordings_read" ON public.live_recordings FOR SELECT USING (
  created_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.live_sessions ls
    WHERE ls.id = live_session_id AND ls.teacher_id = auth.uid()
  )
  OR public.internal_is_live_session_participant(live_session_id, auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND lower(COALESCE(p.role, '')) IN ('owner', 'admin', 'secretariat')
  )
);

-- Insertion : l'hôte peut insérer
DROP POLICY IF EXISTS "live_recordings_insert" ON public.live_recordings;
CREATE POLICY "live_recordings_insert" ON public.live_recordings FOR INSERT WITH CHECK (
  created_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.live_sessions ls
    WHERE ls.id = live_session_id AND ls.teacher_id = auth.uid()
  )
);

-- Colonne post_notes sur live_sessions (pour les notes post-session)
ALTER TABLE public.live_sessions
  ADD COLUMN IF NOT EXISTS post_notes TEXT;

-- Colonne ended_at sur live_sessions (pour calculer la durée)
ALTER TABLE public.live_sessions
  ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ;
