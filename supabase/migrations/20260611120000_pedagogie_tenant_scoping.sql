-- ============================================================================
-- Migration: tenant scoping du modèle pédagogique (school_paths → replay_assets)
-- Date: 2026-06-11
--
-- État prod constaté avant cette migration :
--  * course_modules possède déjà tenant_id (FK tenants) et course_id → courses(id).
--  * Les 6 autres tables du sous-arbre pédagogique n'avaient PAS de tenant_id ;
--    la lecture élève reposait sur des policies temporaires USING (true) qui
--    exposaient le contenu de TOUS les tenants à tout utilisateur authentifié.
--  * Les policies owner « *_rw_under_path » joignaient pc.id = cm.course_id,
--    jointure devenue fausse depuis que course_modules.course_id référence
--    courses(id) et non plus path_courses(id) → policies mortes silencieusement.
--
-- Ce que fait cette migration :
--  1. Ajoute tenant_id aux 6 tables manquantes + backfill descendant.
--  2. Triggers BEFORE INSERT pour auto-dériver tenant_id du parent (l'API
--     NestJS écrit en service_role sans connaître ces colonnes).
--  3. Remplace les policies USING (true) et les policies owner cassées par
--     des policies scoper tenant via tenant_memberships (1 EXISTS indexé).
--  4. Seed : membership student ISNA pour l'élève de test jkalonji06.
-- ============================================================================

BEGIN;

-- ── 1. Colonnes tenant_id ───────────────────────────────────────────────────

ALTER TABLE public.school_paths       ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.path_courses       ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.module_weeks       ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.week_days          ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.pedagogical_blocks ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.replay_assets      ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;

-- ── 2. Backfill descendant ──────────────────────────────────────────────────
-- Source de vérité : courses.tenant_id (déjà NOT NULL) et course_modules.tenant_id.

UPDATE public.path_courses pc SET tenant_id = c.tenant_id
FROM public.courses c
WHERE c.id = pc.course_id AND pc.tenant_id IS NULL;

UPDATE public.school_paths sp SET tenant_id = sub.tenant_id
FROM (
  SELECT DISTINCT ON (path_id) path_id, tenant_id
  FROM public.path_courses WHERE tenant_id IS NOT NULL
) sub
WHERE sub.path_id = sp.id AND sp.tenant_id IS NULL;

-- Rattrapage : path_courses sans course_id lié (ancien modèle) → tenant du path.
UPDATE public.path_courses pc SET tenant_id = sp.tenant_id
FROM public.school_paths sp
WHERE sp.id = pc.path_id AND pc.tenant_id IS NULL AND sp.tenant_id IS NOT NULL;

UPDATE public.module_weeks mw SET tenant_id = cm.tenant_id
FROM public.course_modules cm
WHERE cm.id = mw.module_id AND mw.tenant_id IS NULL;

UPDATE public.week_days wd SET tenant_id = mw.tenant_id
FROM public.module_weeks mw
WHERE mw.id = wd.week_id AND wd.tenant_id IS NULL;

UPDATE public.pedagogical_blocks pb SET tenant_id = wd.tenant_id
FROM public.week_days wd
WHERE wd.id = pb.day_id AND pb.tenant_id IS NULL;

UPDATE public.replay_assets ra SET tenant_id = pb.tenant_id
FROM public.pedagogical_blocks pb
WHERE pb.id = ra.block_id AND ra.tenant_id IS NULL;

-- ── 3. Index ────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_school_paths_tenant       ON public.school_paths(tenant_id);
CREATE INDEX IF NOT EXISTS idx_path_courses_tenant       ON public.path_courses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_module_weeks_tenant       ON public.module_weeks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_week_days_tenant          ON public.week_days(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pedagogical_blocks_tenant ON public.pedagogical_blocks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_replay_assets_tenant      ON public.replay_assets(tenant_id);

-- ── 4. Triggers : auto-remplissage du tenant_id à l'INSERT ─────────────────
-- SECURITY DEFINER : la lecture du parent ne doit pas dépendre des policies
-- RLS de l'utilisateur qui insère.

CREATE OR REPLACE FUNCTION public.pedagogy_fill_tenant_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.tenant_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  CASE TG_TABLE_NAME
    WHEN 'school_paths' THEN
      -- Pas de parent : on prend le tenant où le créateur est staff.
      SELECT tm.tenant_id INTO NEW.tenant_id
      FROM public.tenant_memberships tm
      WHERE tm.user_id = NEW.owner_id
        AND tm.status = 'active'
        AND tm.role IN ('owner', 'admin', 'teacher')
      ORDER BY tm.created_at
      LIMIT 1;
    WHEN 'path_courses' THEN
      SELECT c.tenant_id INTO NEW.tenant_id FROM public.courses c WHERE c.id = NEW.course_id;
      IF NEW.tenant_id IS NULL THEN
        SELECT sp.tenant_id INTO NEW.tenant_id FROM public.school_paths sp WHERE sp.id = NEW.path_id;
      END IF;
    WHEN 'module_weeks' THEN
      SELECT cm.tenant_id INTO NEW.tenant_id FROM public.course_modules cm WHERE cm.id = NEW.module_id;
    WHEN 'week_days' THEN
      SELECT mw.tenant_id INTO NEW.tenant_id FROM public.module_weeks mw WHERE mw.id = NEW.week_id;
    WHEN 'pedagogical_blocks' THEN
      SELECT wd.tenant_id INTO NEW.tenant_id FROM public.week_days wd WHERE wd.id = NEW.day_id;
    WHEN 'replay_assets' THEN
      SELECT pb.tenant_id INTO NEW.tenant_id FROM public.pedagogical_blocks pb WHERE pb.id = NEW.block_id;
    ELSE
      NULL;
  END CASE;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS school_paths_fill_tenant ON public.school_paths;
CREATE TRIGGER school_paths_fill_tenant
  BEFORE INSERT ON public.school_paths
  FOR EACH ROW EXECUTE FUNCTION public.pedagogy_fill_tenant_id();

DROP TRIGGER IF EXISTS path_courses_fill_tenant ON public.path_courses;
CREATE TRIGGER path_courses_fill_tenant
  BEFORE INSERT ON public.path_courses
  FOR EACH ROW EXECUTE FUNCTION public.pedagogy_fill_tenant_id();

DROP TRIGGER IF EXISTS module_weeks_fill_tenant ON public.module_weeks;
CREATE TRIGGER module_weeks_fill_tenant
  BEFORE INSERT ON public.module_weeks
  FOR EACH ROW EXECUTE FUNCTION public.pedagogy_fill_tenant_id();

DROP TRIGGER IF EXISTS week_days_fill_tenant ON public.week_days;
CREATE TRIGGER week_days_fill_tenant
  BEFORE INSERT ON public.week_days
  FOR EACH ROW EXECUTE FUNCTION public.pedagogy_fill_tenant_id();

DROP TRIGGER IF EXISTS pedagogical_blocks_fill_tenant ON public.pedagogical_blocks;
CREATE TRIGGER pedagogical_blocks_fill_tenant
  BEFORE INSERT ON public.pedagogical_blocks
  FOR EACH ROW EXECUTE FUNCTION public.pedagogy_fill_tenant_id();

DROP TRIGGER IF EXISTS replay_assets_fill_tenant ON public.replay_assets;
CREATE TRIGGER replay_assets_fill_tenant
  BEFORE INSERT ON public.replay_assets
  FOR EACH ROW EXECUTE FUNCTION public.pedagogy_fill_tenant_id();

-- ── 5. Policies ─────────────────────────────────────────────────────────────

-- 5a. Suppression des policies temporaires USING (true) (fuite inter-tenant).
DROP POLICY IF EXISTS "sp_student_read" ON public.school_paths;
DROP POLICY IF EXISTS "pc_student_read" ON public.path_courses;
DROP POLICY IF EXISTS "cm_student_read" ON public.course_modules;
DROP POLICY IF EXISTS "mw_student_read" ON public.module_weeks;
DROP POLICY IF EXISTS "wd_student_read" ON public.week_days;
DROP POLICY IF EXISTS "pb_student_read" ON public.pedagogical_blocks;

-- 5b. Suppression des policies owner cassées (jointure pc.id = cm.course_id
--     invalide depuis que course_modules.course_id → courses.id).
DROP POLICY IF EXISTS "course_modules_rw_under_path"     ON public.course_modules;
DROP POLICY IF EXISTS "module_weeks_rw_under_path"       ON public.module_weeks;
DROP POLICY IF EXISTS "week_days_rw_under_path"          ON public.week_days;
DROP POLICY IF EXISTS "pedagogical_blocks_rw_under_path" ON public.pedagogical_blocks;
DROP POLICY IF EXISTS "replay_assets_rw_under_path"      ON public.replay_assets;
-- (path_courses_rw_under_path et les policies school_paths_* owner restent :
--  leurs jointures sont correctes et couvrent le créateur du parcours.)

-- 5c. Lecture : tout membre actif du tenant (élèves inclus).
DROP POLICY IF EXISTS "sp_tenant_member_read" ON public.school_paths;
CREATE POLICY "sp_tenant_member_read" ON public.school_paths
  FOR SELECT TO authenticated
  USING (tenant_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.tenant_memberships tm
    WHERE tm.tenant_id = school_paths.tenant_id AND tm.user_id = auth.uid() AND tm.status = 'active'
  ));

DROP POLICY IF EXISTS "pc_tenant_member_read" ON public.path_courses;
CREATE POLICY "pc_tenant_member_read" ON public.path_courses
  FOR SELECT TO authenticated
  USING (tenant_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.tenant_memberships tm
    WHERE tm.tenant_id = path_courses.tenant_id AND tm.user_id = auth.uid() AND tm.status = 'active'
  ));

DROP POLICY IF EXISTS "cm_tenant_member_read" ON public.course_modules;
CREATE POLICY "cm_tenant_member_read" ON public.course_modules
  FOR SELECT TO authenticated
  USING (tenant_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.tenant_memberships tm
    WHERE tm.tenant_id = course_modules.tenant_id AND tm.user_id = auth.uid() AND tm.status = 'active'
  ));

DROP POLICY IF EXISTS "mw_tenant_member_read" ON public.module_weeks;
CREATE POLICY "mw_tenant_member_read" ON public.module_weeks
  FOR SELECT TO authenticated
  USING (tenant_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.tenant_memberships tm
    WHERE tm.tenant_id = module_weeks.tenant_id AND tm.user_id = auth.uid() AND tm.status = 'active'
  ));

DROP POLICY IF EXISTS "wd_tenant_member_read" ON public.week_days;
CREATE POLICY "wd_tenant_member_read" ON public.week_days
  FOR SELECT TO authenticated
  USING (tenant_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.tenant_memberships tm
    WHERE tm.tenant_id = week_days.tenant_id AND tm.user_id = auth.uid() AND tm.status = 'active'
  ));

DROP POLICY IF EXISTS "pb_tenant_member_read" ON public.pedagogical_blocks;
CREATE POLICY "pb_tenant_member_read" ON public.pedagogical_blocks
  FOR SELECT TO authenticated
  USING (tenant_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.tenant_memberships tm
    WHERE tm.tenant_id = pedagogical_blocks.tenant_id AND tm.user_id = auth.uid() AND tm.status = 'active'
  ));

DROP POLICY IF EXISTS "ra_tenant_member_read" ON public.replay_assets;
CREATE POLICY "ra_tenant_member_read" ON public.replay_assets
  FOR SELECT TO authenticated
  USING (tenant_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.tenant_memberships tm
    WHERE tm.tenant_id = replay_assets.tenant_id AND tm.user_id = auth.uid() AND tm.status = 'active'
  ));

-- 5d. Écriture : staff du tenant (owner/admin/teacher) — même modèle que
--     courses/course_lessons. L'API service_role bypasse de toute façon.
DROP POLICY IF EXISTS "sp_tenant_staff_manage" ON public.school_paths;
CREATE POLICY "sp_tenant_staff_manage" ON public.school_paths
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.tenant_memberships tm
    WHERE tm.tenant_id = school_paths.tenant_id AND tm.user_id = auth.uid()
      AND tm.status = 'active' AND tm.role IN ('owner', 'admin', 'teacher')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.tenant_memberships tm
    WHERE tm.tenant_id = school_paths.tenant_id AND tm.user_id = auth.uid()
      AND tm.status = 'active' AND tm.role IN ('owner', 'admin', 'teacher')
  ));

DROP POLICY IF EXISTS "pc_tenant_staff_manage" ON public.path_courses;
CREATE POLICY "pc_tenant_staff_manage" ON public.path_courses
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.tenant_memberships tm
    WHERE tm.tenant_id = path_courses.tenant_id AND tm.user_id = auth.uid()
      AND tm.status = 'active' AND tm.role IN ('owner', 'admin', 'teacher')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.tenant_memberships tm
    WHERE tm.tenant_id = path_courses.tenant_id AND tm.user_id = auth.uid()
      AND tm.status = 'active' AND tm.role IN ('owner', 'admin', 'teacher')
  ));

DROP POLICY IF EXISTS "cm_tenant_staff_manage" ON public.course_modules;
CREATE POLICY "cm_tenant_staff_manage" ON public.course_modules
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.tenant_memberships tm
    WHERE tm.tenant_id = course_modules.tenant_id AND tm.user_id = auth.uid()
      AND tm.status = 'active' AND tm.role IN ('owner', 'admin', 'teacher')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.tenant_memberships tm
    WHERE tm.tenant_id = course_modules.tenant_id AND tm.user_id = auth.uid()
      AND tm.status = 'active' AND tm.role IN ('owner', 'admin', 'teacher')
  ));

DROP POLICY IF EXISTS "mw_tenant_staff_manage" ON public.module_weeks;
CREATE POLICY "mw_tenant_staff_manage" ON public.module_weeks
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.tenant_memberships tm
    WHERE tm.tenant_id = module_weeks.tenant_id AND tm.user_id = auth.uid()
      AND tm.status = 'active' AND tm.role IN ('owner', 'admin', 'teacher')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.tenant_memberships tm
    WHERE tm.tenant_id = module_weeks.tenant_id AND tm.user_id = auth.uid()
      AND tm.status = 'active' AND tm.role IN ('owner', 'admin', 'teacher')
  ));

DROP POLICY IF EXISTS "wd_tenant_staff_manage" ON public.week_days;
CREATE POLICY "wd_tenant_staff_manage" ON public.week_days
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.tenant_memberships tm
    WHERE tm.tenant_id = week_days.tenant_id AND tm.user_id = auth.uid()
      AND tm.status = 'active' AND tm.role IN ('owner', 'admin', 'teacher')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.tenant_memberships tm
    WHERE tm.tenant_id = week_days.tenant_id AND tm.user_id = auth.uid()
      AND tm.status = 'active' AND tm.role IN ('owner', 'admin', 'teacher')
  ));

DROP POLICY IF EXISTS "pb_tenant_staff_manage" ON public.pedagogical_blocks;
CREATE POLICY "pb_tenant_staff_manage" ON public.pedagogical_blocks
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.tenant_memberships tm
    WHERE tm.tenant_id = pedagogical_blocks.tenant_id AND tm.user_id = auth.uid()
      AND tm.status = 'active' AND tm.role IN ('owner', 'admin', 'teacher')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.tenant_memberships tm
    WHERE tm.tenant_id = pedagogical_blocks.tenant_id AND tm.user_id = auth.uid()
      AND tm.status = 'active' AND tm.role IN ('owner', 'admin', 'teacher')
  ));

DROP POLICY IF EXISTS "ra_tenant_staff_manage" ON public.replay_assets;
CREATE POLICY "ra_tenant_staff_manage" ON public.replay_assets
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.tenant_memberships tm
    WHERE tm.tenant_id = replay_assets.tenant_id AND tm.user_id = auth.uid()
      AND tm.status = 'active' AND tm.role IN ('owner', 'admin', 'teacher')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.tenant_memberships tm
    WHERE tm.tenant_id = replay_assets.tenant_id AND tm.user_id = auth.uid()
      AND tm.status = 'active' AND tm.role IN ('owner', 'admin', 'teacher')
  ));

-- ── 6. Seed : l'élève de test doit être membre du tenant isna ──────────────
-- jkalonji06@gmail.com est owner du tenant zahirwellness mais joue l'élève
-- ISNA dans le scénario de test ; sans membership isna il perdrait l'accès.
INSERT INTO public.tenant_memberships (tenant_id, user_id, role, status)
SELECT '4f6faaa8-43a0-46d6-b98a-99ea1154f9ea', '61cfde3a-5d74-4169-98b1-0b86b2f0f607', 'student', 'active'
WHERE NOT EXISTS (
  SELECT 1 FROM public.tenant_memberships
  WHERE tenant_id = '4f6faaa8-43a0-46d6-b98a-99ea1154f9ea'
    AND user_id = '61cfde3a-5d74-4169-98b1-0b86b2f0f607'
);

COMMENT ON COLUMN public.school_paths.tenant_id IS 'Tenant propriétaire du parcours — rempli par trigger depuis la membership staff du créateur si absent.';

COMMIT;
