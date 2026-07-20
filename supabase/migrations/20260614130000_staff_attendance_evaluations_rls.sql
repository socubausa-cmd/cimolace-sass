-- ============================================================================
-- Migration: RLS staff pour la saisie présences + notes (vie scolaire)
-- Date: 2026-06-14
--
-- État constaté : l'UI staff EXISTE et est routée (SchoolLifeManagementTab →
-- AttendanceManagers, dans OwnerDashboard onglet « school-life » + Secretariat
-- Dashboard ; notes saisies en live via useClassroomProgress). MAIS
-- attendance_records et student_evaluations n'avaient QU'UNE policy SELECT
-- (lecture élève) — 0 policy INSERT/UPDATE → le prof/secrétariat ne pouvait
-- RIEN saisir (RLS refuse). Un prof était donc aveugle au quotidien.
--
-- Ces tables n'ont pas de tenant_id (clé = student_id → auth.users). Le scope
-- staff passe donc par tenant_memberships : l'écrivain doit être staff
-- (owner/admin/teacher/secretariat) actif d'un tenant dont l'élève visé est
-- aussi membre actif.
--
-- Bonus : ajoute la colonne attendance_records.deleted_at (l'UI fait un
-- soft-delete dessus, colonne absente → le retrait d'une absence échouait).
-- ============================================================================

BEGIN;

-- ── Helper SECURITY DEFINER ─────────────────────────────────────────────────
-- Évalue « le caller (auth.uid()) est-il staff d'un tenant dont p_student est
-- membre actif ? ». SECURITY DEFINER pour ne PAS dépendre de la RLS de
-- tenant_memberships (sinon le staff ne « voit » pas la ligne de l'élève dans
-- son propre contexte RLS et le prédicat échoue).
CREATE OR REPLACE FUNCTION public.is_staff_for_student(p_student uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_memberships staff
    JOIN public.tenant_memberships stu ON stu.tenant_id = staff.tenant_id
    WHERE staff.user_id = auth.uid() AND staff.status = 'active'
      AND staff.role IN ('owner', 'admin', 'teacher', 'secretariat')
      AND stu.user_id = p_student AND stu.status = 'active'
  );
$$;
REVOKE ALL ON FUNCTION public.is_staff_for_student(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_staff_for_student(uuid) TO authenticated;

-- ── attendance_records ──────────────────────────────────────────────────────

ALTER TABLE public.attendance_records ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

DROP POLICY IF EXISTS attendance_staff_manage ON public.attendance_records;
CREATE POLICY attendance_staff_manage ON public.attendance_records
  FOR ALL TO authenticated
  USING (public.is_staff_for_student(student_id))
  WITH CHECK (public.is_staff_for_student(student_id));

-- ── student_evaluations ─────────────────────────────────────────────────────

DROP POLICY IF EXISTS evaluations_staff_manage ON public.student_evaluations;
CREATE POLICY evaluations_staff_manage ON public.student_evaluations
  FOR ALL TO authenticated
  USING (public.is_staff_for_student(student_id))
  WITH CHECK (public.is_staff_for_student(student_id));

-- service_role : accès complet (imports/seed/API).
DROP POLICY IF EXISTS attendance_service ON public.attendance_records;
CREATE POLICY attendance_service ON public.attendance_records FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS evaluations_service ON public.student_evaluations;
CREATE POLICY evaluations_service ON public.student_evaluations FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMIT;
