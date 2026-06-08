-- Libellés des personnes avec qui un workspace est partagé (propriétaire uniquement, lecture profiles via SECURITY DEFINER).

CREATE OR REPLACE FUNCTION public.liri_workspace_share_grantee_display(p_workspace_id uuid)
RETURNS TABLE (
  share_id uuid,
  grantee_id uuid,
  role text,
  display_name text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.id AS share_id,
    s.grantee_id,
    s.role,
    COALESCE(
      NULLIF(trim(both FROM p.name), ''),
      NULLIF(trim(both FROM p.email), ''),
      s.grantee_id::text
    ) AS display_name,
    s.created_at
  FROM public.liri_course_workspace_shares s
  LEFT JOIN public.profiles p ON p.id = s.grantee_id
  WHERE s.workspace_id = p_workspace_id
    AND EXISTS (
      SELECT 1
      FROM public.liri_course_workspaces w
      WHERE w.id = p_workspace_id
        AND w.user_id = auth.uid()
    )
  ORDER BY s.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.liri_workspace_share_grantee_display(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.liri_workspace_share_grantee_display(uuid) TO authenticated;

COMMENT ON FUNCTION public.liri_workspace_share_grantee_display(uuid) IS
  'Liste des partages d''un workspace avec nom/email profil (appelant = propriétaire du workspace).';
