-- Demande la post-production d'un replay : marque live_neuro_recall_state
-- .workflow_status='processing' → le worker (pollReplayPostprod) prend le relais
-- (extraction audio → transcription → chapitres → published). Garde encadrant.
CREATE OR REPLACE FUNCTION public.request_replay_postprod(p_session_id uuid)
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
    UPDATE public.live_neuro_recall_state SET workflow_status = 'processing', updated_at = now() WHERE live_session_id = p_session_id;
  ELSE
    INSERT INTO public.live_neuro_recall_state (live_session_id, workflow_status) VALUES (p_session_id, 'processing');
  END IF;
END $$;

REVOKE ALL ON FUNCTION public.request_replay_postprod(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.request_replay_postprod(uuid) TO authenticated;
