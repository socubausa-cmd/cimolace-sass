-- ============================================================================
-- Migration: RPC public.ensure_student_membership(p_slug) — self-join élève
-- Date: 2026-06-14
--
-- PROBLÈME (P0) : à l'inscription, signup() (apps/app/src/contexts/
-- SupabaseAuthContext.jsx) crée un compte profiles.role='visitor' SANS aucune
-- tenant_memberships. Or TOUTES les RLS pédagogiques tenant-scoped
-- (20260611120000 : sp/pc/cm/mw/wd/pb/ra_tenant_member_read) ET la policy
-- INSERT de demande de RDV (20260613140000 : appt_student_request_insert)
-- exigent EXISTS(tenant_memberships WHERE user_id=auth.uid() AND status='active').
-- Sans membership active, l'élève ne lit AUCUN contenu et ne peut rien demander.
--
-- POURQUOI UNE RPC SECURITY DEFINER : tenant_memberships n'a AUCUNE policy
-- INSERT pour le rôle 'authenticated' (cf. 001_tenants.sql:24 +
-- 20250505000001_tenants.sql:49 = seulement service_role FOR ALL et SELECT
-- "Membership visible par soi-même"). Un supabase.from('tenant_memberships')
-- .insert() côté élève échouerait donc en RLS. Cette RPC tourne en SECURITY
-- DEFINER (droits du propriétaire de la fonction) et n'autorise QUE le
-- self-join : elle insère TOUJOURS user_id = auth.uid(), role='student',
-- status='active' — l'appelant ne peut ni choisir l'utilisateur, ni le rôle.
--
-- IDEMPOTENTE : ON CONFLICT (tenant_id, user_id) DO NOTHING → réappelable à
-- chaque login sans dupliquer ni écraser une membership existante (un owner /
-- teacher du tenant garde son rôle). Reproduit le pattern de seed élève de
-- 20260611120000_pedagogie_tenant_scoping.sql:334.
--
-- ⚠️ NON APPLIQUÉE EN PROD PAR CE WORKTREE. À déployer côté Supabase
-- (timestamp > 20260613140000). Le front (SupabaseAuthContext +
-- EleveSignupMobile) appelle déjà supabase.rpc('ensure_student_membership', …).
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.ensure_student_membership(p_slug text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid     uuid := auth.uid();
  v_tenant  uuid;
  v_id      uuid;
BEGIN
  -- Doit être appelée par un utilisateur authentifié (jamais en anon).
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'ensure_student_membership: not authenticated'
      USING ERRCODE = '28000';
  END IF;

  -- Slug obligatoire ; résolution tenant_id côté DB (le front ne connaît que le slug).
  IF p_slug IS NULL OR length(btrim(p_slug)) = 0 THEN
    RAISE EXCEPTION 'ensure_student_membership: tenant slug required'
      USING ERRCODE = '22023';
  END IF;

  SELECT id INTO v_tenant
  FROM public.tenants
  WHERE lower(slug) = lower(btrim(p_slug))
  LIMIT 1;

  -- Slug inconnu → no-op silencieux (NULL), pas d'erreur : un slug par défaut
  -- mal configuré ne doit pas casser l'inscription.
  IF v_tenant IS NULL THEN
    RETURN NULL;
  END IF;

  -- Self-join idempotent : élève rattaché au tenant courant.
  -- user_id et role/status sont FORCÉS (pas de paramètre appelant) → pas
  -- d'escalade de privilèges possible via cette RPC.
  INSERT INTO public.tenant_memberships (tenant_id, user_id, role, status)
  VALUES (v_tenant, v_uid, 'student', 'active')
  ON CONFLICT (tenant_id, user_id) DO NOTHING
  RETURNING id INTO v_id;

  -- Si la membership existait déjà (DO NOTHING → v_id NULL), récupérer son id.
  IF v_id IS NULL THEN
    SELECT id INTO v_id
    FROM public.tenant_memberships
    WHERE tenant_id = v_tenant AND user_id = v_uid
    LIMIT 1;
  END IF;

  RETURN v_id;
END;
$$;

-- Seul un utilisateur authentifié peut s'auto-rattacher ; révoquer l'accès large.
REVOKE ALL ON FUNCTION public.ensure_student_membership(text) FROM PUBLIC;
-- anon hérite d'EXECUTE via les défauts Supabase malgré le REVOKE PUBLIC → le retirer
-- explicitement (la fonction lève déjà 28000 si auth.uid() IS NULL, mais on durcit).
REVOKE EXECUTE ON FUNCTION public.ensure_student_membership(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.ensure_student_membership(text) TO authenticated;

COMMENT ON FUNCTION public.ensure_student_membership(text) IS
  'Self-join élève : rattache auth.uid() au tenant (slug) en role=student/status=active, idempotent (ON CONFLICT DO NOTHING). SECURITY DEFINER car tenant_memberships n''a pas de policy INSERT authenticated. Appelée au 1er login/inscription élève (SupabaseAuthContext).';

COMMIT;
