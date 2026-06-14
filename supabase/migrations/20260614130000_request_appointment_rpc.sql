-- ============================================================================
-- Migration: RPC public.request_appointment(p_slug, p_notes) — demande de RDV élève
-- Date: 2026-06-14
--
-- ⚠️ À NE PAS APPLIQUER SANS VALIDATION (documentée ici, pas encore poussée en
--    prod). Modèle identique à public.ensure_student_membership(text)
--    (migration 20260614120000, déjà en prod sur fwfupxvmwtxbtbjdeqvu).
--
-- PROBLÈME : l'écran « Prendre rendez-vous »
-- (apps/app/src/pages/school/eleve-mobile/EleveAppointmentRequestScreen.jsx)
-- appelait deux fonctions Netlify ABSENTES du repo (booking-available-slots,
-- booking-request-appointment) → 404 en prod, aucune demande jamais enregistrée.
--
-- Schéma RÉEL de public.appointments (vérifié en prod le 2026-06-14) :
--   { id, tenant_id NOT NULL, student_id NOT NULL, slot_id (nullable),
--     status, notes, source, created_at, updated_at }
--   CHECK status IN ('requested','confirmed','cancelled','completed','no_show').
-- Une DEMANDE élève = slot_id NULL + status='requested' (le secrétariat pose le
-- créneau réel à la confirmation). La policy INSERT appt_student_request_insert
-- (migration 20260613140000) autorise déjà cet insert pour un élève membre actif.
-- Il N'EXISTE PAS de colonne scheduled_at/type/teacher_id/duration_minutes : le
-- « créneau préféré » saisi par l'élève voyage dans p_notes (texte).
--
-- POURQUOI UNE RPC SECURITY DEFINER : le front ne connaît que le SLUG du tenant
-- (résolu via le host / DEFAULT_TENANT_SLUG), pas son uuid ; AUCUN trigger ne
-- dérive appointments.tenant_id → il faut le résoudre côté DB. La RPC FORCE les
-- champs sensibles (student_id = auth.uid(), slot_id = NULL, status='requested',
-- source='mobile') : l'appelant ne peut ni choisir l'élève, ni poser un créneau,
-- ni confirmer un RDV.
--
-- DÉFENSE EN PROFONDEUR : bien que SECURITY DEFINER contourne la RLS, la RPC
-- re-vérifie EXISTS(tenant_memberships active) — exactement comme la policy
-- INSERT appt_student_request_insert — afin qu'un utilisateur ne puisse pas
-- créer de demande dans un tenant dont il n'est pas membre (un slug deviné ne
-- suffit pas). Sans cette garde, la RPC serait PLUS permissive que l'insert
-- direct côté élève, ce qui affaiblirait l'isolation tenant.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.request_appointment(p_slug text, p_notes text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid    uuid := auth.uid();
  v_tenant uuid;
  v_id     uuid;
BEGIN
  -- Doit être appelée par un utilisateur authentifié (jamais en anon).
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'request_appointment: not authenticated'
      USING ERRCODE = '28000';
  END IF;

  -- Slug obligatoire ; résolution tenant_id côté DB (le front ne connaît que le slug).
  IF p_slug IS NULL OR length(btrim(p_slug)) = 0 THEN
    RAISE EXCEPTION 'request_appointment: tenant slug required'
      USING ERRCODE = '22023';
  END IF;

  SELECT id INTO v_tenant
  FROM public.tenants
  WHERE lower(slug) = lower(btrim(p_slug))
  LIMIT 1;

  -- Slug inconnu → erreur explicite (à la différence de ensure_student_membership
  -- qui no-op : ici l'élève agit volontairement, mieux vaut un message clair).
  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'request_appointment: tenant introuvable (%)', p_slug
      USING ERRCODE = '22023';
  END IF;

  -- Défense en profondeur : l'appelant doit être membre actif du tenant
  -- (identique à la policy appt_student_request_insert). Empêche la création de
  -- demandes inter-tenant via un slug deviné, malgré le SECURITY DEFINER.
  IF NOT EXISTS (
    SELECT 1 FROM public.tenant_memberships tm
    WHERE tm.tenant_id = v_tenant
      AND tm.user_id = v_uid
      AND tm.status = 'active'
  ) THEN
    RAISE EXCEPTION 'request_appointment: aucune membership active dans ce tenant'
      USING ERRCODE = '42501';
  END IF;

  -- Insert de la DEMANDE : champs sensibles FORCÉS, pas de créneau (slot_id NULL).
  -- notes vidées → NULL (évite une chaîne vide en base).
  INSERT INTO public.appointments (tenant_id, student_id, slot_id, status, source, notes)
  VALUES (v_tenant, v_uid, NULL, 'requested', 'mobile', NULLIF(btrim(coalesce(p_notes, '')), ''))
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- Seul un utilisateur authentifié peut demander un RDV ; révoquer l'accès large.
REVOKE ALL ON FUNCTION public.request_appointment(text, text) FROM PUBLIC;
-- anon hérite d'EXECUTE via les défauts Supabase malgré le REVOKE PUBLIC → le retirer
-- explicitement (la fonction lève déjà 28000 si auth.uid() IS NULL, mais on durcit).
REVOKE EXECUTE ON FUNCTION public.request_appointment(text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.request_appointment(text, text) TO authenticated;

COMMENT ON FUNCTION public.request_appointment(text, text) IS
  'Demande de RDV élève : insère public.appointments {tenant_id résolu par slug, student_id=auth.uid(), slot_id=NULL, status=''requested'', source=''mobile'', notes=p_notes} et renvoie l''id. SECURITY DEFINER (le front ne connaît que le slug ; aucun trigger ne pose tenant_id) mais re-vérifie la membership active comme la policy appt_student_request_insert. Appelée par EleveAppointmentRequestScreen via supabase.rpc.';

COMMIT;
