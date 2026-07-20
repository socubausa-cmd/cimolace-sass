-- ============================================================================
-- Migration: durcissement RLS du calendrier scolaire annuel
-- Date: 2026-06-13
--
-- Avant :
--   * annual_program_weeks : apw_authenticated_update USING(true) WITH CHECK(true)
--     → N'IMPORTE QUEL authentifié pouvait modifier les semaines de N'IMPORTE
--       QUEL tenant (et validateWeek() côté élève écrivait status='completed'
--       sur le calendrier partagé).
--   * SELECT USING(true) sur les deux tables → fuite inter-tenant.
--   * school_year_calendars : aucune policy d'écriture → publish reposait sur
--     un accès non contrôlé.
--
-- Après : lecture = membre actif du tenant ; écriture = staff
--   (owner/admin/teacher). Isolation par school_year_calendars.cimolace_tenant_id
--   (annual_program_weeks rejoint via calendar_id). service_role conserve l'accès
--   pour la génération IA.
--
-- Vérifié sans danger : useStudentCurrentCourse (élève) lit ces tables mais les
-- élèves sont désormais membres actifs de leur tenant ; validateWeek() est dans
-- un try/catch avec fallback local, donc le refus RLS staff-only ne casse rien.
-- ============================================================================

BEGIN;

-- ── school_year_calendars ───────────────────────────────────────────────────

DROP POLICY IF EXISTS syc_authenticated_select ON public.school_year_calendars;

DROP POLICY IF EXISTS syc_tenant_member_read ON public.school_year_calendars;
CREATE POLICY syc_tenant_member_read ON public.school_year_calendars
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.tenant_memberships tm
    WHERE tm.tenant_id = school_year_calendars.cimolace_tenant_id
      AND tm.user_id = auth.uid() AND tm.status = 'active'
  ));

DROP POLICY IF EXISTS syc_staff_manage ON public.school_year_calendars;
CREATE POLICY syc_staff_manage ON public.school_year_calendars
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.tenant_memberships tm
    WHERE tm.tenant_id = school_year_calendars.cimolace_tenant_id
      AND tm.user_id = auth.uid() AND tm.status = 'active'
      AND tm.role IN ('owner','admin','teacher')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.tenant_memberships tm
    WHERE tm.tenant_id = school_year_calendars.cimolace_tenant_id
      AND tm.user_id = auth.uid() AND tm.status = 'active'
      AND tm.role IN ('owner','admin','teacher')
  ));

DROP POLICY IF EXISTS syc_service ON public.school_year_calendars;
CREATE POLICY syc_service ON public.school_year_calendars
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── annual_program_weeks ────────────────────────────────────────────────────

DROP POLICY IF EXISTS apw_authenticated_select ON public.annual_program_weeks;
DROP POLICY IF EXISTS apw_authenticated_update ON public.annual_program_weeks;

DROP POLICY IF EXISTS apw_tenant_member_read ON public.annual_program_weeks;
CREATE POLICY apw_tenant_member_read ON public.annual_program_weeks
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.school_year_calendars c
    JOIN public.tenant_memberships tm ON tm.tenant_id = c.cimolace_tenant_id
    WHERE c.id = annual_program_weeks.calendar_id
      AND tm.user_id = auth.uid() AND tm.status = 'active'
  ));

DROP POLICY IF EXISTS apw_staff_manage ON public.annual_program_weeks;
CREATE POLICY apw_staff_manage ON public.annual_program_weeks
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.school_year_calendars c
    JOIN public.tenant_memberships tm ON tm.tenant_id = c.cimolace_tenant_id
    WHERE c.id = annual_program_weeks.calendar_id
      AND tm.user_id = auth.uid() AND tm.status = 'active'
      AND tm.role IN ('owner','admin','teacher')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.school_year_calendars c
    JOIN public.tenant_memberships tm ON tm.tenant_id = c.cimolace_tenant_id
    WHERE c.id = annual_program_weeks.calendar_id
      AND tm.user_id = auth.uid() AND tm.status = 'active'
      AND tm.role IN ('owner','admin','teacher')
  ));

DROP POLICY IF EXISTS apw_service ON public.annual_program_weeks;
CREATE POLICY apw_service ON public.annual_program_weeks
  FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMIT;
