-- Récursion RLS mutuelle sur les espaces de travail du Studio — HTTP 500 / 42P17.
--
-- ⛔ SYMPTÔME : tout enregistrement d'un document ou d'un cours échoue.
--    POST /rest/v1/liri_course_workspaces
--    → 500 {"code":"42P17","message":"infinite recursion detected in policy
--           for relation \"liri_course_workspaces\""}
--    Mesuré en production le 2026-08-05 depuis le rédacteur de documents ; le
--    défaut n'est pas propre au rédacteur, il casse la sauvegarde pour tous.
--
-- ⛔ CAUSE : deux politiques se citent l'une l'autre (202604302291) —
--    liri_course_workspaces_select_own  interroge liri_course_workspace_shares
--    liri_course_workspace_shares_*     interroge liri_course_workspaces
--    Chaque sous-requête déclenche à son tour la RLS de la table citée :
--    PostgreSQL détecte le cycle et refuse la requête. Le cycle existe même
--    lorsque l'utilisateur est simple propriétaire et n'a aucun partage.
--
-- ⛔ CORRECTIF : rompre le cycle par des fonctions SECURITY DEFINER, qui lisent
--    sans repasser par la RLS. C'est le mécanisme déjà retenu ailleurs dans ce
--    dépôt (annuaire, messagerie). Le périmètre d'accès reste STRICTEMENT le
--    même : propriétaire, ou bénéficiaire d'un partage (rôle 'editor' pour
--    l'écriture). Aucune politique n'est élargie.

-- ── Rompre le cycle côté workspaces ────────────────────────────────────────
-- Lit liri_course_workspace_shares SANS déclencher sa RLS.
CREATE OR REPLACE FUNCTION public.liri_workspace_share_role(p_workspace_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT s.role
  FROM public.liri_course_workspace_shares s
  WHERE s.workspace_id = p_workspace_id
    AND s.grantee_id = auth.uid()
  ORDER BY CASE s.role WHEN 'editor' THEN 0 ELSE 1 END
  LIMIT 1;
$$;

-- ── Rompre le cycle côté shares / versions ─────────────────────────────────
-- Lit liri_course_workspaces SANS déclencher sa RLS.
CREATE OR REPLACE FUNCTION public.liri_workspace_is_owner(p_workspace_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.liri_course_workspaces w
    WHERE w.id = p_workspace_id
      AND w.user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.liri_workspace_share_role(uuid) FROM public;
REVOKE ALL ON FUNCTION public.liri_workspace_is_owner(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.liri_workspace_share_role(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.liri_workspace_is_owner(uuid) TO authenticated;

-- ══ liri_course_workspaces ═════════════════════════════════════════════════
DROP POLICY IF EXISTS "liri_course_workspaces_select_own" ON public.liri_course_workspaces;
CREATE POLICY "liri_course_workspaces_select_own"
ON public.liri_course_workspaces
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR public.liri_workspace_share_role(id) IS NOT NULL
);

-- INSERT n'a jamais été récursif (WITH CHECK sur user_id seul) : on le
-- réaffirme pour que la migration soit lisible d'un bloc.
DROP POLICY IF EXISTS "liri_course_workspaces_insert_own" ON public.liri_course_workspaces;
CREATE POLICY "liri_course_workspaces_insert_own"
ON public.liri_course_workspaces
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "liri_course_workspaces_update_own" ON public.liri_course_workspaces;
CREATE POLICY "liri_course_workspaces_update_own"
ON public.liri_course_workspaces
FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid()
  OR public.liri_workspace_share_role(id) = 'editor'
)
WITH CHECK (
  user_id = auth.uid()
  OR public.liri_workspace_share_role(id) = 'editor'
);

DROP POLICY IF EXISTS "liri_course_workspaces_delete_own" ON public.liri_course_workspaces;
CREATE POLICY "liri_course_workspaces_delete_own"
ON public.liri_course_workspaces
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- ══ liri_course_workspace_shares ═══════════════════════════════════════════
DROP POLICY IF EXISTS "liri_course_workspace_shares_select" ON public.liri_course_workspace_shares;
CREATE POLICY "liri_course_workspace_shares_select"
ON public.liri_course_workspace_shares
FOR SELECT
TO authenticated
USING (
  grantee_id = auth.uid()
  OR public.liri_workspace_is_owner(workspace_id)
);

DROP POLICY IF EXISTS "liri_course_workspace_shares_insert" ON public.liri_course_workspace_shares;
CREATE POLICY "liri_course_workspace_shares_insert"
ON public.liri_course_workspace_shares
FOR INSERT
TO authenticated
WITH CHECK (public.liri_workspace_is_owner(workspace_id));

DROP POLICY IF EXISTS "liri_course_workspace_shares_update" ON public.liri_course_workspace_shares;
CREATE POLICY "liri_course_workspace_shares_update"
ON public.liri_course_workspace_shares
FOR UPDATE
TO authenticated
USING (public.liri_workspace_is_owner(workspace_id))
WITH CHECK (public.liri_workspace_is_owner(workspace_id));

DROP POLICY IF EXISTS "liri_course_workspace_shares_delete" ON public.liri_course_workspace_shares;
CREATE POLICY "liri_course_workspace_shares_delete"
ON public.liri_course_workspace_shares
FOR DELETE
TO authenticated
USING (
  grantee_id = auth.uid()
  OR public.liri_workspace_is_owner(workspace_id)
);

-- ══ liri_course_workspace_versions ═════════════════════════════════════════
-- Ces politiques imbriquaient workspaces ET shares : deux niveaux de RLS
-- traversés à chaque lecture d'une version. Le cycle passait aussi par ici.
DROP POLICY IF EXISTS "liri_course_workspace_versions_select" ON public.liri_course_workspace_versions;
CREATE POLICY "liri_course_workspace_versions_select"
ON public.liri_course_workspace_versions
FOR SELECT
TO authenticated
USING (
  public.liri_workspace_is_owner(workspace_id)
  OR public.liri_workspace_share_role(workspace_id) IS NOT NULL
);

DROP POLICY IF EXISTS "liri_course_workspace_versions_insert" ON public.liri_course_workspace_versions;
CREATE POLICY "liri_course_workspace_versions_insert"
ON public.liri_course_workspace_versions
FOR INSERT
TO authenticated
WITH CHECK (
  public.liri_workspace_is_owner(workspace_id)
  OR public.liri_workspace_share_role(workspace_id) = 'editor'
);

DROP POLICY IF EXISTS "liri_course_workspace_versions_delete" ON public.liri_course_workspace_versions;
CREATE POLICY "liri_course_workspace_versions_delete"
ON public.liri_course_workspace_versions
FOR DELETE
TO authenticated
USING (public.liri_workspace_is_owner(workspace_id));

NOTIFY pgrst, 'reload schema';
