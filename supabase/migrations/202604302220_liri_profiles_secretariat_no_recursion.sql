-- Fix 500 « infinite recursion detected in policy for relation profiles »
-- Cause : EXISTS (SELECT … FROM profiles) dans USING sur profiles / attendance → boucle RLS.
-- Correction : user_has_role() — si la récursion continue, appliquer aussi 202604302230
-- (SET row_security = off sur user_has_role : l’appel depuis une policy sur profiles
-- réappliquait la RLS sur le SELECT interne).

DROP POLICY IF EXISTS "Attendance: secretariat read" ON public.attendance_records;
CREATE POLICY "Attendance: secretariat read"
ON public.attendance_records
FOR SELECT TO authenticated
USING (
  deleted_at IS NULL
  AND public.user_has_role(auth.uid(), ARRAY['secretariat'])
);

DROP POLICY IF EXISTS "Profiles: secretariat read" ON public.profiles;
CREATE POLICY "Profiles: secretariat read"
ON public.profiles
FOR SELECT TO authenticated
USING (public.user_has_role(auth.uid(), ARRAY['secretariat']));
