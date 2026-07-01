-- Écrit le résultat de post-production d'un replay (chapitres + transcript) dans
-- live_neuro_recall_state → lu par le player (fromReplay). SECURITY DEFINER +
-- garde encadrant. Préserve replay_public_url / poster existants.
CREATE OR REPLACE FUNCTION public.set_replay_recall(
  p_session_id      uuid,
  p_chapters        jsonb,
  p_transcript_text text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid;
BEGIN
  SELECT tenant_id INTO v_tenant FROM public.live_sessions WHERE id = p_session_id;
  IF v_tenant IS NULL THEN RAISE EXCEPTION 'Live introuvable'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.tenant_memberships tm
    WHERE tm.tenant_id = v_tenant AND tm.user_id = auth.uid()
      AND tm.status = 'active' AND tm.role IN ('owner', 'admin', 'practitioner')
  ) THEN
    RAISE EXCEPTION 'Réservé à un encadrant du tenant';
  END IF;

  IF EXISTS (SELECT 1 FROM public.live_neuro_recall_state WHERE live_session_id = p_session_id) THEN
    UPDATE public.live_neuro_recall_state
       SET chapters = COALESCE(p_chapters, '[]'::jsonb),
           transcript_text = p_transcript_text,
           workflow_status = 'published',
           updated_at = now()
     WHERE live_session_id = p_session_id;
  ELSE
    INSERT INTO public.live_neuro_recall_state (live_session_id, chapters, transcript_text, workflow_status)
    VALUES (p_session_id, COALESCE(p_chapters, '[]'::jsonb), p_transcript_text, 'published');
  END IF;
END $$;

REVOKE ALL ON FUNCTION public.set_replay_recall(uuid, jsonb, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.set_replay_recall(uuid, jsonb, text) TO authenticated;
