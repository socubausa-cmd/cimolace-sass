-- Invitations par lien (token) → entrée dans liri_course_workspace_shares (usage unique par token).

CREATE TABLE IF NOT EXISTS public.liri_course_workspace_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.liri_course_workspaces (id) ON DELETE CASCADE,
  token text NOT NULL,
  role text NOT NULL CHECK (role IN ('viewer', 'editor')),
  created_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  consumed_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  CONSTRAINT liri_course_workspace_invites_token_unique UNIQUE (token)
);

CREATE INDEX IF NOT EXISTS idx_liri_ws_invites_workspace
  ON public.liri_course_workspace_invites (workspace_id);

COMMENT ON TABLE public.liri_course_workspace_invites IS 'Lien d''invitation à un workspace LIRI (token URL, consommation unique).';

ALTER TABLE public.liri_course_workspace_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "liri_ws_invites_select_owner" ON public.liri_course_workspace_invites;
CREATE POLICY "liri_ws_invites_select_owner"
ON public.liri_course_workspace_invites
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.liri_course_workspaces w
    WHERE w.id = workspace_id AND w.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "liri_ws_invites_insert_owner" ON public.liri_course_workspace_invites;
CREATE POLICY "liri_ws_invites_insert_owner"
ON public.liri_course_workspace_invites
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.liri_course_workspaces w
    WHERE w.id = workspace_id AND w.user_id = auth.uid()
  )
  AND created_by = auth.uid()
);

DROP POLICY IF EXISTS "liri_ws_invites_delete_owner" ON public.liri_course_workspace_invites;
CREATE POLICY "liri_ws_invites_delete_owner"
ON public.liri_course_workspace_invites
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.liri_course_workspaces w
    WHERE w.id = workspace_id AND w.user_id = auth.uid()
  )
);

-- Consommation / mise à jour réservée à la RPC SECURITY DEFINER (pas de UPDATE direct côté client).

CREATE OR REPLACE FUNCTION public.redeem_liri_workspace_invite(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.liri_course_workspace_invites%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  IF p_token IS NULL OR length(trim(p_token)) < 8 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_token');
  END IF;

  SELECT * INTO v_row
  FROM public.liri_course_workspace_invites
  WHERE token = trim(p_token)
    AND consumed_at IS NULL
    AND expires_at > now()
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_or_expired');
  END IF;

  INSERT INTO public.liri_course_workspace_shares (workspace_id, grantee_id, role)
  VALUES (v_row.workspace_id, v_uid, v_row.role)
  ON CONFLICT (workspace_id, grantee_id)
  DO UPDATE SET role = EXCLUDED.role;

  UPDATE public.liri_course_workspace_invites
  SET consumed_at = now(), consumed_by = v_uid
  WHERE id = v_row.id;

  RETURN jsonb_build_object(
    'ok', true,
    'workspace_id', v_row.workspace_id,
    'role', v_row.role
  );
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_liri_workspace_invite(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.redeem_liri_workspace_invite(text) TO authenticated;
