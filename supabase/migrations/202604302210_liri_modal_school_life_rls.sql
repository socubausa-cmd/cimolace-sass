-- LIRI — Aperçu « vie scolaire » depuis le modal live (MemberSchoolLifeInlinePanel)
-- 1) Secrétariat : lecture des présences (owner/admin l’avaient déjà via la policy existante).
-- 2) Enseignant : lecture du profil des élèves liés par teacher_assignments (is_assigned_teacher).
-- 3) Secrétariat : lecture des lignes profiles (annuaire opérationnel).

DROP POLICY IF EXISTS "Attendance: secretariat read" ON public.attendance_records;
CREATE POLICY "Attendance: secretariat read"
ON public.attendance_records
FOR SELECT TO authenticated
USING (
  deleted_at IS NULL
  AND public.user_has_role(auth.uid(), ARRAY['secretariat'])
);

DROP POLICY IF EXISTS "Profiles: teacher read assigned students" ON public.profiles;
CREATE POLICY "Profiles: teacher read assigned students"
ON public.profiles
FOR SELECT TO authenticated
USING (
  public.user_has_role(auth.uid(), ARRAY['teacher'])
  AND public.is_assigned_teacher(auth.uid(), profiles.id, NULL)
);

DROP POLICY IF EXISTS "Profiles: secretariat read" ON public.profiles;
CREATE POLICY "Profiles: secretariat read"
ON public.profiles
FOR SELECT TO authenticated
USING (public.user_has_role(auth.uid(), ARRAY['secretariat']));
