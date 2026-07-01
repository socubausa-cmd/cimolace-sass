-- Salle de replay (mode révision) : lit une session live + son état recall
-- (replay_public_url, chapitres, transcript, vignette) pour alimenter le
-- UnifiedVideoPlayer côté front. SECURITY DEFINER (live_neuro_recall_state est
-- écrit en service_role) — garde : membre actif du tenant du live.
CREATE OR REPLACE FUNCTION public.get_replay_room(p_session_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'session', jsonb_build_object(
      'id', ls.id,
      'title', ls.title,
      'started_at', ls.started_at,
      'cover_image_url', ls.cover_image_url
    ),
    'state', CASE WHEN st.live_session_id IS NULL THEN NULL ELSE jsonb_build_object(
      'live_session_id', st.live_session_id,
      'replay_public_url', st.replay_public_url,
      'chapters', st.chapters,
      'transcript_text', st.transcript_text,
      'replay_poster_url', st.replay_poster_url
    ) END
  )
  FROM public.live_sessions ls
  LEFT JOIN public.live_neuro_recall_state st ON st.live_session_id = ls.id
  WHERE ls.id = p_session_id
    AND EXISTS (
      SELECT 1 FROM public.tenant_memberships tm
      WHERE tm.tenant_id = ls.tenant_id AND tm.user_id = auth.uid() AND tm.status = 'active'
    );
$$;

REVOKE ALL ON FUNCTION public.get_replay_room(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_replay_room(uuid) TO authenticated;

COMMENT ON FUNCTION public.get_replay_room(uuid) IS
  'Salle de replay : session + état recall (URL replay, chapitres, transcript, vignette) pour le UnifiedVideoPlayer. SECURITY DEFINER, garde membre tenant.';
