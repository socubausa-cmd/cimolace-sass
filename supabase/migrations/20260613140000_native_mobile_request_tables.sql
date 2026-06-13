-- ============================================================================
-- Migration: tables de demandes pour l'app native (rendez-vous + contact)
-- Date: 2026-06-13
--
-- Les écrans natifs portés (apps/mobile) écrivent :
--   * rendez-vous.tsx → appointments { tenant_id, student_id, status:'requested',
--     source:'mobile', notes } — SANS slot_id (c'est une DEMANDE, pas un RDV
--     confirmé). Bloqué par slot_id NOT NULL + absence de policy INSERT élève.
--   * vitrine/infos.tsx (Contact) → contact_requests { tenant_id, name, email,
--     subject, message, status:'new' } — table inexistante.
--
-- Cette migration rend ces deux inserts fonctionnels TELS QUELS (pas d'édition
-- d'écran) :
--   1. appointments : slot_id devient nullable (une demande élève n'a pas de
--      créneau ; le secrétariat le pose à la confirmation) + policy INSERT
--      restreinte aux DEMANDES élève (student_id = auth.uid(), slot_id NULL,
--      status='requested', membre actif du tenant). Le booking confirmé
--      (slot_id posé, via API/service_role) est inchangé.
--   2. contact_requests : nouvelle table + RLS (insert authentifié, lecture staff).
-- ============================================================================

BEGIN;

-- ── 1. appointments : demandes de RDV élève ─────────────────────────────────

ALTER TABLE public.appointments ALTER COLUMN slot_id DROP NOT NULL;

DROP POLICY IF EXISTS appt_student_request_insert ON public.appointments;
CREATE POLICY appt_student_request_insert ON public.appointments
  FOR INSERT TO authenticated
  WITH CHECK (
    student_id = auth.uid()
    AND slot_id IS NULL
    AND status = 'requested'
    AND EXISTS (
      SELECT 1 FROM public.tenant_memberships tm
      WHERE tm.tenant_id = appointments.tenant_id
        AND tm.user_id = auth.uid() AND tm.status = 'active'
    )
  );
-- SELECT déjà couvert par « Appointments visibles par concernés »
-- (student_id = auth.uid() OU staff owner/admin/teacher/secretariat du tenant).

-- ── 2. contact_requests : formulaire de contact (vitrine) ───────────────────

CREATE TABLE IF NOT EXISTS public.contact_requests (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name       text,
  email      text,
  subject    text,
  message    text NOT NULL,
  status     text NOT NULL DEFAULT 'new' CHECK (status IN ('new','read','replied','archived')),
  source     text DEFAULT 'mobile',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contact_requests_tenant ON public.contact_requests(tenant_id, status);

ALTER TABLE public.contact_requests ENABLE ROW LEVEL SECURITY;

-- Insert : tout utilisateur authentifié peut envoyer une demande de contact.
DROP POLICY IF EXISTS cr_authenticated_insert ON public.contact_requests;
CREATE POLICY cr_authenticated_insert ON public.contact_requests
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id IS NOT NULL);

-- Lecture : staff du tenant (secrétariat inclus).
DROP POLICY IF EXISTS cr_staff_read ON public.contact_requests;
CREATE POLICY cr_staff_read ON public.contact_requests
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.tenant_memberships tm
    WHERE tm.tenant_id = contact_requests.tenant_id
      AND tm.user_id = auth.uid() AND tm.status = 'active'
      AND tm.role IN ('owner','admin','teacher','secretariat')
  ));

DROP POLICY IF EXISTS cr_service ON public.contact_requests;
CREATE POLICY cr_service ON public.contact_requests
  FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMENT ON TABLE public.contact_requests IS 'Demandes de contact (formulaire vitrine app native + web). Insert authentifié, lecture staff du tenant.';

COMMIT;
