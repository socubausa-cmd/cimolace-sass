-- ═══════════════════════════════════════════════════════════════════════════
-- MASTER FACTORY — durcissement RLS (audit 2026-07-29, constats A1/A2/A3).
--
-- Failles corrigées ici :
--   A1. live_script_sections : lss_select USING (true) → le prompteur de
--       TOUTES les écoles était lisible par tout utilisateur authentifié de
--       n'importe quel tenant ; lss_insert ne vérifiait que created_by →
--       injection possible dans la session de n'importe qui.
--   A2. live_scenes_staff_read / live_sessions_read (clause staff) /
--       live_participants_select_staff : le « staff » était défini par
--       profiles.role GLOBAL, sans cloison tenant → un admin d'une école
--       lisait les données de toutes les autres.
--   A3. live_sessions_read : OR status = 'live' → toute session en direct
--       (config incluse : master_factory, access_password_hash, join_code)
--       était lisible par TOUT authentifié, même hors tenant.
--
-- Contraintes de conception :
--   • live_script_sections.session_id est un TEXT legacy SANS FK : le cast
--     ::uuid est protégé par un CASE + regex (le CASE garantit l'ordre
--     d'évaluation, contrairement à un AND que le planificateur peut
--     réordonner). Une valeur non-uuid rend la ligne invisible/inéditable
--     pour tout le monde sauf son auteur — fail-closed, jamais fuitée.
--   • On réutilise les helpers SECURITY DEFINER existants
--     (internal_live_session_teacher_id / internal_is_live_session_participant,
--     cf. 20260604120000) et on en ajoute UN, internal_live_session_tenant_id,
--     pour lire tenant_id sans sous-requête RLS sur live_sessions depuis les
--     policies de live_session_participants (historique de récursion 42P17
--     sur cette table : on ne réintroduit AUCUNE sous-requête croisée là-bas).
--   • Aucune table nouvelle. Tout est DROP POLICY IF EXISTS + recréation,
--     rejouable à volonté.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 0) Helper : tenant d'une session, sans traverser la RLS ────────────────
-- SECURITY DEFINER pour la même raison que les deux helpers existants : une
-- policy qui sous-interroge live_sessions déclenche live_sessions_read, qui
-- elle-même consulte tenant_memberships — le helper court-circuite la chaîne.
CREATE OR REPLACE FUNCTION public.internal_live_session_tenant_id(p_session_id uuid)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT tenant_id FROM public.live_sessions WHERE id = p_session_id;
$$;

REVOKE ALL ON FUNCTION public.internal_live_session_tenant_id(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.internal_live_session_tenant_id(uuid) TO authenticated, service_role;


-- ─── 1) live_script_sections — accès borné à la session (A1) ────────────────

-- SELECT : enseignant OU participant OU auteur OU staff (owner/admin) du
-- MÊME tenant que la session. Plus jamais USING (true).
DROP POLICY IF EXISTS "lss_select" ON public.live_script_sections;
CREATE POLICY "lss_select"
  ON public.live_script_sections FOR SELECT
  TO authenticated
  USING (
    created_by = auth.uid()
    OR CASE
      WHEN session_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN (
        public.internal_live_session_teacher_id(session_id::uuid) = auth.uid()
        OR public.internal_is_live_session_participant(session_id::uuid, auth.uid())
        OR EXISTS (
          SELECT 1
          FROM public.tenant_memberships tm
          JOIN public.live_sessions ls ON ls.tenant_id = tm.tenant_id
          WHERE ls.id = session_id::uuid
            AND tm.user_id = auth.uid()
            AND tm.role IN ('owner', 'admin')
        )
      )
      ELSE false
    END
  );

-- INSERT : l'auteur DOIT être l'utilisateur courant ET appartenir à la
-- session (enseignant ou participant). Un session_id non-uuid est refusé :
-- plus d'injection de sections dans la session d'autrui.
DROP POLICY IF EXISTS "lss_insert" ON public.live_script_sections;
CREATE POLICY "lss_insert"
  ON public.live_script_sections FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND CASE
      WHEN session_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN (
        public.internal_live_session_teacher_id(session_id::uuid) = auth.uid()
        OR public.internal_is_live_session_participant(session_id::uuid, auth.uid())
      )
      ELSE false
    END
  );

-- UPDATE : l'enseignant de la session (le co-hôte n'est plus impuissant face
-- aux lignes dont created_by est NULL ou parti) OU l'auteur.
DROP POLICY IF EXISTS "lss_update" ON public.live_script_sections;
CREATE POLICY "lss_update"
  ON public.live_script_sections FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid()
    OR CASE
      WHEN session_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN public.internal_live_session_teacher_id(session_id::uuid) = auth.uid()
      ELSE false
    END
  )
  WITH CHECK (
    created_by = auth.uid()
    OR CASE
      WHEN session_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN public.internal_live_session_teacher_id(session_id::uuid) = auth.uid()
      ELSE false
    END
  );

-- DELETE : mêmes bornes que UPDATE.
DROP POLICY IF EXISTS "lss_delete" ON public.live_script_sections;
CREATE POLICY "lss_delete"
  ON public.live_script_sections FOR DELETE
  TO authenticated
  USING (
    created_by = auth.uid()
    OR CASE
      WHEN session_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN public.internal_live_session_teacher_id(session_id::uuid) = auth.uid()
      ELSE false
    END
  );


-- ─── 2) live_scenes — lecture staff cloisonnée par tenant (A2) ──────────────
-- Avant : tout profiles.role ∈ {owner,admin,secretariat} lisait les scènes de
-- TOUTES les sessions. Maintenant : il faut être staff du tenant DE LA session.
DROP POLICY IF EXISTS "live_scenes_staff_read" ON public.live_scenes;
CREATE POLICY "live_scenes_staff_read"
  ON public.live_scenes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_memberships tm
      WHERE tm.user_id = auth.uid()
        AND tm.role IN ('owner', 'admin', 'secretariat')
        AND tm.tenant_id = public.internal_live_session_tenant_id(live_scenes.live_session_id)
    )
  );


-- ─── 3) live_sessions_read — clause staff par tenant + 'live' réservé aux
--        membres du tenant (A2 + A3) ────────────────────────────────────────
-- On conserve : enseignant, participant (helper non récursif). On remplace :
--   (a) la clause staff profiles.role GLOBAL → staff du MÊME tenant ;
--   (b) OR status='live' nu → 'live' visible des seuls MEMBRES du tenant
--       (tout rôle, élève compris). Les parcours publics/invités hors tenant
--       passent par l'API service_role (apps/api/src/liri-public/), qui
--       ignore la RLS — rien ne casse de ce côté.
DROP POLICY IF EXISTS "live_sessions_read" ON public.live_sessions;
CREATE POLICY "live_sessions_read" ON public.live_sessions FOR SELECT USING (
  teacher_id = auth.uid()
  OR public.internal_is_live_session_participant(id, auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.tenant_memberships tm
    WHERE tm.user_id = auth.uid()
      AND tm.role IN ('owner', 'admin', 'secretariat')
      AND tm.tenant_id = live_sessions.tenant_id
  )
  OR (
    status = 'live'
    AND EXISTS (
      SELECT 1 FROM public.tenant_memberships tm
      WHERE tm.user_id = auth.uid()
        AND tm.tenant_id = live_sessions.tenant_id
    )
  )
);


-- ─── 4) live_participants_select_staff — cloisonnée par tenant (A2) ─────────
-- Le helper (SECURITY DEFINER) évite toute sous-requête RLS sur live_sessions
-- depuis une policy de live_session_participants : c'est précisément la
-- famille de croisements qui a produit la récursion 42P17 historique.
DROP POLICY IF EXISTS "live_participants_select_staff" ON public.live_session_participants;
-- ⚠️ Sur la base de PROD, la policy staff globale ne porte PAS le nom des
-- fichiers de migration : elle s'appelle lsp_select_staff (vérifié via
-- pg_policies le 2026-07-30). Les policies étant combinées en OR, la laisser
-- en place annulerait tout le cloisonnement — on la droppe par son vrai nom.
DROP POLICY IF EXISTS "lsp_select_staff" ON public.live_session_participants;
CREATE POLICY "live_participants_select_staff" ON public.live_session_participants
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_memberships tm
      WHERE tm.user_id = auth.uid()
        AND tm.role IN ('owner', 'admin', 'secretariat')
        AND tm.tenant_id = public.internal_live_session_tenant_id(live_session_participants.live_session_id)
    )
  );

-- lsp_insert (prod) autorisait l'insertion par tout staff GLOBAL
-- (profiles.role, sans cloison tenant) : un admin d'une école pouvait
-- s'inscrire — ou inscrire sa ligne — dans les sessions de toutes les autres.
-- Recréée : soi-même, l'enseignant de la session, ou le staff du MÊME tenant.
DROP POLICY IF EXISTS "lsp_insert" ON public.live_session_participants;
CREATE POLICY "lsp_insert" ON public.live_session_participants
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR public.internal_live_session_teacher_id(live_session_id) = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.tenant_memberships tm
      WHERE tm.user_id = auth.uid()
        AND tm.role IN ('owner', 'admin', 'secretariat')
        AND tm.tenant_id = public.internal_live_session_tenant_id(live_session_participants.live_session_id)
    )
  );
