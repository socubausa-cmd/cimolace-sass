-- ============================================================================
-- Migration: Tables cours et apprentissage
-- Date: 2026-05-21
--
-- Tables : courses, course_modules, course_lessons, student_progress,
--          teacher_assignments
-- ============================================================================

-- ── courses ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS courses (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_by      UUID          REFERENCES auth.users(id) ON DELETE SET NULL,

  title           TEXT          NOT NULL,
  description     TEXT          NOT NULL DEFAULT '',
  slug            TEXT,
  category        TEXT          NOT NULL DEFAULT 'general',
  cover_image_url TEXT,

  price_cents     INT           NOT NULL DEFAULT 0,
  currency        TEXT          NOT NULL DEFAULT 'USD',
  is_free         BOOLEAN       GENERATED ALWAYS AS (price_cents = 0) STORED,

  status          TEXT          NOT NULL DEFAULT 'draft'
                                CHECK (status IN ('draft','published','archived')),
  level           TEXT          DEFAULT 'beginner'
                                CHECK (level IN ('beginner','intermediate','advanced')),
  language        TEXT          NOT NULL DEFAULT 'fr',
  duration_hours  NUMERIC(6,2),

  metadata        JSONB         NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),

  UNIQUE (tenant_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_courses_tenant       ON courses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_courses_status       ON courses(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_courses_created_by   ON courses(created_by);

DROP TRIGGER IF EXISTS courses_updated_at ON courses;
CREATE TRIGGER courses_updated_at
  BEFORE UPDATE ON courses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── course_modules ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS course_modules (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  course_id       UUID          NOT NULL REFERENCES courses(id) ON DELETE CASCADE,

  title           TEXT          NOT NULL,
  description     TEXT          NOT NULL DEFAULT '',
  order_index     INT           NOT NULL DEFAULT 0,

  is_free_preview BOOLEAN       NOT NULL DEFAULT false,
  metadata        JSONB         NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_course_modules_course ON course_modules(course_id, order_index);
CREATE INDEX IF NOT EXISTS idx_course_modules_tenant ON course_modules(tenant_id);

DROP TRIGGER IF EXISTS course_modules_updated_at ON course_modules;
CREATE TRIGGER course_modules_updated_at
  BEFORE UPDATE ON course_modules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── course_lessons ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS course_lessons (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  module_id       UUID          NOT NULL REFERENCES course_modules(id) ON DELETE CASCADE,

  title           TEXT          NOT NULL,
  content         TEXT          NOT NULL DEFAULT '',
  video_url       TEXT,
  audio_url       TEXT,
  duration_seconds INT,
  order_index     INT           NOT NULL DEFAULT 0,

  lesson_type     TEXT          NOT NULL DEFAULT 'video'
                                CHECK (lesson_type IN ('video','audio','text','quiz','exercise','live')),
  is_free_preview BOOLEAN       NOT NULL DEFAULT false,
  metadata        JSONB         NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_course_lessons_module ON course_lessons(module_id, order_index);
CREATE INDEX IF NOT EXISTS idx_course_lessons_tenant ON course_lessons(tenant_id);

DROP TRIGGER IF EXISTS course_lessons_updated_at ON course_lessons;
CREATE TRIGGER course_lessons_updated_at
  BEFORE UPDATE ON course_lessons
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── student_progress ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS student_progress (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id             UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id           UUID          NOT NULL REFERENCES course_lessons(id) ON DELETE CASCADE,
  course_id           UUID          REFERENCES courses(id) ON DELETE CASCADE,

  status              TEXT          NOT NULL DEFAULT 'not_started'
                                    CHECK (status IN ('not_started','in_progress','completed')),
  time_spent_seconds  INT           NOT NULL DEFAULT 0,
  last_position_secs  INT           NOT NULL DEFAULT 0,   -- position vidéo
  score               NUMERIC(5,2),                       -- pour quiz

  started_at          TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT now(),

  UNIQUE (user_id, lesson_id)
);

CREATE INDEX IF NOT EXISTS idx_student_progress_user   ON student_progress(tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_student_progress_course ON student_progress(user_id, course_id);
CREATE INDEX IF NOT EXISTS idx_student_progress_lesson ON student_progress(lesson_id);

DROP TRIGGER IF EXISTS student_progress_updated_at ON student_progress;
CREATE TRIGGER student_progress_updated_at
  BEFORE UPDATE ON student_progress
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── teacher_assignments ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS teacher_assignments (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  teacher_id      UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id       UUID          REFERENCES courses(id) ON DELETE CASCADE,
  module_id       UUID          REFERENCES course_modules(id) ON DELETE CASCADE,

  role            TEXT          NOT NULL DEFAULT 'instructor'
                                CHECK (role IN ('instructor','co_instructor','reviewer')),
  assigned_by     UUID          REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
  is_active       BOOLEAN       NOT NULL DEFAULT true,

  UNIQUE (teacher_id, course_id, role)
);

CREATE INDEX IF NOT EXISTS idx_teacher_assignments_teacher ON teacher_assignments(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_assignments_course  ON teacher_assignments(course_id);
CREATE INDEX IF NOT EXISTS idx_teacher_assignments_tenant  ON teacher_assignments(tenant_id);

-- ── RLS ───────────────────────────────────────────────────────────────────

ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_assignments ENABLE ROW LEVEL SECURITY;

-- courses : lecture publique si published
DROP POLICY IF EXISTS "public_read_published_courses" ON courses;
CREATE POLICY "public_read_published_courses"
  ON courses FOR SELECT TO authenticated
  USING (status = 'published');

DROP POLICY IF EXISTS "tenant_admin_manage_courses" ON courses;
CREATE POLICY "tenant_admin_manage_courses"
  ON courses FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM tenant_memberships tm
    WHERE tm.tenant_id = courses.tenant_id AND tm.user_id = auth.uid()
    AND tm.role IN ('owner','admin','teacher')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM tenant_memberships tm
    WHERE tm.tenant_id = courses.tenant_id AND tm.user_id = auth.uid()
    AND tm.role IN ('owner','admin','teacher')
  ));

DROP POLICY IF EXISTS "service_role_courses" ON courses;
CREATE POLICY "service_role_courses" ON courses FOR ALL TO service_role USING (true) WITH CHECK (true);

-- course_modules : même logique
DROP POLICY IF EXISTS "member_read_modules" ON course_modules;
CREATE POLICY "member_read_modules"
  ON course_modules FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM tenant_memberships tm WHERE tm.tenant_id = course_modules.tenant_id AND tm.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "teacher_manage_modules" ON course_modules;
CREATE POLICY "teacher_manage_modules"
  ON course_modules FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM tenant_memberships tm WHERE tm.tenant_id = course_modules.tenant_id
    AND tm.user_id = auth.uid() AND tm.role IN ('owner','admin','teacher')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM tenant_memberships tm WHERE tm.tenant_id = course_modules.tenant_id
    AND tm.user_id = auth.uid() AND tm.role IN ('owner','admin','teacher')
  ));

DROP POLICY IF EXISTS "service_role_modules" ON course_modules;
CREATE POLICY "service_role_modules" ON course_modules FOR ALL TO service_role USING (true) WITH CHECK (true);

-- course_lessons
DROP POLICY IF EXISTS "member_read_lessons" ON course_lessons;
CREATE POLICY "member_read_lessons"
  ON course_lessons FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM tenant_memberships tm WHERE tm.tenant_id = course_lessons.tenant_id AND tm.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "teacher_manage_lessons" ON course_lessons;
CREATE POLICY "teacher_manage_lessons"
  ON course_lessons FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM tenant_memberships tm WHERE tm.tenant_id = course_lessons.tenant_id
    AND tm.user_id = auth.uid() AND tm.role IN ('owner','admin','teacher')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM tenant_memberships tm WHERE tm.tenant_id = course_lessons.tenant_id
    AND tm.user_id = auth.uid() AND tm.role IN ('owner','admin','teacher')
  ));

DROP POLICY IF EXISTS "service_role_lessons" ON course_lessons;
CREATE POLICY "service_role_lessons" ON course_lessons FOR ALL TO service_role USING (true) WITH CHECK (true);

-- student_progress : chaque user voit sa propre progression
DROP POLICY IF EXISTS "user_own_progress" ON student_progress;
CREATE POLICY "user_own_progress"
  ON student_progress FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "teacher_read_progress" ON student_progress;
CREATE POLICY "teacher_read_progress"
  ON student_progress FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM tenant_memberships tm WHERE tm.tenant_id = student_progress.tenant_id
    AND tm.user_id = auth.uid() AND tm.role IN ('owner','admin','teacher')
  ));

DROP POLICY IF EXISTS "service_role_progress" ON student_progress;
CREATE POLICY "service_role_progress" ON student_progress FOR ALL TO service_role USING (true) WITH CHECK (true);

-- teacher_assignments
DROP POLICY IF EXISTS "admin_manage_assignments" ON teacher_assignments;
CREATE POLICY "admin_manage_assignments"
  ON teacher_assignments FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM tenant_memberships tm WHERE tm.tenant_id = teacher_assignments.tenant_id
    AND tm.user_id = auth.uid() AND tm.role IN ('owner','admin')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM tenant_memberships tm WHERE tm.tenant_id = teacher_assignments.tenant_id
    AND tm.user_id = auth.uid() AND tm.role IN ('owner','admin')
  ));

DROP POLICY IF EXISTS "teacher_read_own_assignments" ON teacher_assignments;
CREATE POLICY "teacher_read_own_assignments"
  ON teacher_assignments FOR SELECT TO authenticated
  USING (teacher_id = auth.uid());

DROP POLICY IF EXISTS "service_role_assignments" ON teacher_assignments;
CREATE POLICY "service_role_assignments" ON teacher_assignments FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMENT ON TABLE courses          IS 'Catalogue de cours multi-tenant (LIRI / school / creator).';
COMMENT ON TABLE course_modules   IS 'Modules ordonnés composant un cours.';
COMMENT ON TABLE course_lessons   IS 'Leçons individuelles avec contenu, vidéo et type.';
COMMENT ON TABLE student_progress IS 'Progression par leçon et par étudiant, avec temps passé et score.';
COMMENT ON TABLE teacher_assignments IS 'Affectation des formateurs aux cours et modules.';
