-- ============================================================================
-- #43 — COHORTES / CLASSES, modèle PROMO STRICTE (choix utilisateur).
-- ----------------------------------------------------------------------------
-- Une classe = une PROMOTION d'une année scolaire, TOUJOURS liée à un parcours
-- (school_path, NOT NULL). Un élève appartient à UNE seule classe par tenant
-- (contrainte UNIQUE). Additif, tenant-scopé, RLS. Écritures via RPC à garde.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.school_classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  school_path_id uuid NOT NULL REFERENCES public.school_paths(id) ON DELETE CASCADE,
  name text NOT NULL,
  academic_year text,
  teacher_id uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_school_classes_tenant ON public.school_classes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_school_classes_path   ON public.school_classes(school_path_id);

CREATE TABLE IF NOT EXISTS public.school_class_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  school_class_id uuid NOT NULL REFERENCES public.school_classes(id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT school_class_members_one_per_student UNIQUE (tenant_id, student_id)
);
CREATE INDEX IF NOT EXISTS idx_scm_class   ON public.school_class_members(school_class_id);
CREATE INDEX IF NOT EXISTS idx_scm_student ON public.school_class_members(student_id);

ALTER TABLE public.school_classes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_class_members ENABLE ROW LEVEL SECURITY;

-- ── RLS : staff (owner/admin) du tenant gèrent ; tout membre actif lit les
--    classes ; l'élève lit SA propre appartenance. ────────────────────────────
DROP POLICY IF EXISTS sc_staff_manage ON public.school_classes;
CREATE POLICY sc_staff_manage ON public.school_classes FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tenant_memberships tm WHERE tm.tenant_id = school_classes.tenant_id AND tm.user_id = auth.uid() AND tm.status='active' AND tm.role IN ('owner','admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.tenant_memberships tm WHERE tm.tenant_id = school_classes.tenant_id AND tm.user_id = auth.uid() AND tm.status='active' AND tm.role IN ('owner','admin')));
DROP POLICY IF EXISTS sc_member_read ON public.school_classes;
CREATE POLICY sc_member_read ON public.school_classes FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tenant_memberships tm WHERE tm.tenant_id = school_classes.tenant_id AND tm.user_id = auth.uid() AND tm.status='active'));

DROP POLICY IF EXISTS scm_staff_manage ON public.school_class_members;
CREATE POLICY scm_staff_manage ON public.school_class_members FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tenant_memberships tm WHERE tm.tenant_id = school_class_members.tenant_id AND tm.user_id = auth.uid() AND tm.status='active' AND tm.role IN ('owner','admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.tenant_memberships tm WHERE tm.tenant_id = school_class_members.tenant_id AND tm.user_id = auth.uid() AND tm.status='active' AND tm.role IN ('owner','admin')));
DROP POLICY IF EXISTS scm_self_read ON public.school_class_members;
CREATE POLICY scm_self_read ON public.school_class_members FOR SELECT TO authenticated
  USING (student_id = auth.uid() OR EXISTS (SELECT 1 FROM public.tenant_memberships tm WHERE tm.tenant_id = school_class_members.tenant_id AND tm.user_id = auth.uid() AND tm.status='active' AND tm.role IN ('owner','admin')));

-- ── RPC create_school_class : garde encadrant ; tenant DÉRIVÉ du parcours. ─────
CREATE OR REPLACE FUNCTION public.create_school_class(p_school_path_id uuid, p_name text, p_academic_year text DEFAULT NULL, p_teacher_id uuid DEFAULT NULL)
RETURNS public.school_classes
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_tenant uuid; v_row public.school_classes;
BEGIN
  SELECT tenant_id INTO v_tenant FROM public.school_paths WHERE id = p_school_path_id;
  IF v_tenant IS NULL THEN RAISE EXCEPTION 'Parcours introuvable'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.tenant_memberships tm WHERE tm.tenant_id = v_tenant AND tm.user_id = auth.uid() AND tm.status='active' AND tm.role IN ('owner','admin')) THEN
    RAISE EXCEPTION 'Réservé à un encadrant du tenant';
  END IF;
  INSERT INTO public.school_classes (tenant_id, school_path_id, name, academic_year, teacher_id, created_by)
  VALUES (v_tenant, p_school_path_id, NULLIF(btrim(p_name), ''), p_academic_year, p_teacher_id, auth.uid())
  RETURNING * INTO v_row;
  RETURN v_row;
END $$;
REVOKE ALL ON FUNCTION public.create_school_class(uuid, text, text, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_school_class(uuid, text, text, uuid) TO authenticated;

-- ── RPC assign_student_to_class : garde encadrant ; PROMO STRICTE = upsert qui
--    DÉPLACE l'élève (1 seule classe/tenant) ; l'élève doit être membre du tenant.
CREATE OR REPLACE FUNCTION public.assign_student_to_class(p_class_id uuid, p_student_id uuid)
RETURNS public.school_class_members
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_tenant uuid; v_row public.school_class_members;
BEGIN
  SELECT tenant_id INTO v_tenant FROM public.school_classes WHERE id = p_class_id;
  IF v_tenant IS NULL THEN RAISE EXCEPTION 'Classe introuvable'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.tenant_memberships tm WHERE tm.tenant_id = v_tenant AND tm.user_id = auth.uid() AND tm.status='active' AND tm.role IN ('owner','admin')) THEN
    RAISE EXCEPTION 'Réservé à un encadrant du tenant';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.tenant_memberships tm WHERE tm.tenant_id = v_tenant AND tm.user_id = p_student_id AND tm.status='active') THEN
    RAISE EXCEPTION 'L''élève n''est pas membre de ce tenant';
  END IF;
  INSERT INTO public.school_class_members (tenant_id, school_class_id, student_id)
  VALUES (v_tenant, p_class_id, p_student_id)
  ON CONFLICT (tenant_id, student_id) DO UPDATE SET school_class_id = EXCLUDED.school_class_id, joined_at = now()
  RETURNING * INTO v_row;
  RETURN v_row;
END $$;
REVOKE ALL ON FUNCTION public.assign_student_to_class(uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.assign_student_to_class(uuid, uuid) TO authenticated;

COMMENT ON TABLE public.school_classes IS 'Classes/promotions (modèle promo stricte) — tenant-scopé, liée à un school_path. #43';
COMMENT ON TABLE public.school_class_members IS 'Appartenance élève→classe, 1 seule par tenant (UNIQUE tenant_id,student_id). #43';
