-- #43 (UI) — Données de l'écran de gestion des classes, en UN appel (évite les
-- inconnues RLS de school_paths / profiles). SECURITY DEFINER ; garde encadrant
-- (owner/admin) : renvoie parcours + élèves + classes(+membres) des tenants où
-- l'appelant est staff. can_manage=false + listes vides sinon.
CREATE OR REPLACE FUNCTION public.get_classes_admin()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH staff_tenants AS (
    SELECT tm.tenant_id FROM public.tenant_memberships tm
    WHERE tm.user_id = auth.uid() AND tm.status = 'active' AND tm.role IN ('owner','admin')
  )
  SELECT jsonb_build_object(
    'can_manage', EXISTS (SELECT 1 FROM staff_tenants),
    'paths', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', sp.id, 'title', sp.title) ORDER BY sp.title)
      FROM public.school_paths sp WHERE sp.tenant_id IN (SELECT tenant_id FROM staff_tenants)
    ), '[]'::jsonb),
    'students', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', tm.user_id, 'name', COALESCE(p.full_name, p.name, p.email, tm.user_id::text))
                       ORDER BY COALESCE(p.full_name, p.name, p.email, tm.user_id::text))
      FROM public.tenant_memberships tm LEFT JOIN public.profiles p ON p.id = tm.user_id
      WHERE tm.tenant_id IN (SELECT tenant_id FROM staff_tenants) AND tm.status = 'active' AND tm.role = 'student'
    ), '[]'::jsonb),
    'classes', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', sc.id, 'name', sc.name, 'school_path_id', sc.school_path_id, 'academic_year', sc.academic_year,
        'member_ids', COALESCE((SELECT jsonb_agg(scm.student_id) FROM public.school_class_members scm WHERE scm.school_class_id = sc.id), '[]'::jsonb)
      ) ORDER BY sc.created_at DESC)
      FROM public.school_classes sc WHERE sc.tenant_id IN (SELECT tenant_id FROM staff_tenants)
    ), '[]'::jsonb)
  );
$$;
REVOKE ALL ON FUNCTION public.get_classes_admin() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_classes_admin() TO authenticated;
