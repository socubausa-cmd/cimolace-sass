-- Journal serveur : commandes caméra « examen surveillé » (formateur → participant).
-- Exécuté après internal_live_session_teacher_id (202604200001 / 202604302314).
-- Traçabilité : l’élève et le formateur peuvent consulter les lignes qui les concernent.

CREATE TABLE IF NOT EXISTS public.live_session_proctor_camera_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  live_session_id UUID NOT NULL REFERENCES public.live_sessions(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL,
  target_user_id UUID NOT NULL,
  camera_enabled BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_proctor_cam_events_session_created
  ON public.live_session_proctor_camera_events (live_session_id, created_at DESC);

COMMENT ON TABLE public.live_session_proctor_camera_events IS
  'Audit des demandes d’activation ou d’extinction de caméra par le formateur (salle avec consentement type examen surveillé).';

ALTER TABLE public.live_session_proctor_camera_events ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON public.live_session_proctor_camera_events TO authenticated;

DROP POLICY IF EXISTS "proctor_cam_events_select" ON public.live_session_proctor_camera_events;
CREATE POLICY "proctor_cam_events_select" ON public.live_session_proctor_camera_events
FOR SELECT TO authenticated
USING (
  teacher_id = auth.uid()
  OR target_user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND lower(COALESCE(p.role, '')) IN ('owner', 'admin', 'secretariat')
  )
);

DROP POLICY IF EXISTS "proctor_cam_events_insert_teacher" ON public.live_session_proctor_camera_events;
CREATE POLICY "proctor_cam_events_insert_teacher" ON public.live_session_proctor_camera_events
FOR INSERT TO authenticated
WITH CHECK (
  teacher_id = auth.uid()
  AND public.internal_live_session_teacher_id(live_session_id) = auth.uid()
);
