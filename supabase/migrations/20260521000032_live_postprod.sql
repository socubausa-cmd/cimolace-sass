-- ============================================================================
-- Migration: Tables live interactif + post-production
-- Date: 2026-05-21
--
-- Tables : live_scripts, live_questions, live_chat_messages, postprod_versions
-- Dépend de : tenants, auth.users, live_sessions (déjà migrée)
-- ============================================================================

-- ── live_scripts ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS live_scripts (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  live_session_id   UUID          NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,

  title             TEXT          NOT NULL,
  content           TEXT          NOT NULL DEFAULT '',
  duration_seconds  INT           NOT NULL DEFAULT 0,
  order_index       INT           NOT NULL DEFAULT 0,
  slide_url         TEXT,
  notes             TEXT,

  created_at        TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_live_scripts_session ON live_scripts(live_session_id, order_index);
CREATE INDEX IF NOT EXISTS idx_live_scripts_tenant  ON live_scripts(tenant_id);

DROP TRIGGER IF EXISTS live_scripts_updated_at ON live_scripts;
CREATE TRIGGER live_scripts_updated_at
  BEFORE UPDATE ON live_scripts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── live_questions ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS live_questions (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  live_session_id   UUID          NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
  user_id           UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  content           TEXT          NOT NULL,
  category          TEXT          NOT NULL DEFAULT 'general',
  status            TEXT          NOT NULL DEFAULT 'open'
                                  CHECK (status IN ('open','answered','dismissed')),

  answer            TEXT,
  answered_by       UUID          REFERENCES auth.users(id) ON DELETE SET NULL,
  answered_at       TIMESTAMPTZ,

  upvotes           INT           NOT NULL DEFAULT 0,
  is_anonymous      BOOLEAN       NOT NULL DEFAULT false,

  created_at        TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_live_questions_session ON live_questions(live_session_id, status);
CREATE INDEX IF NOT EXISTS idx_live_questions_tenant  ON live_questions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_live_questions_user    ON live_questions(user_id);

DROP TRIGGER IF EXISTS live_questions_updated_at ON live_questions;
CREATE TRIGGER live_questions_updated_at
  BEFORE UPDATE ON live_questions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── live_chat_messages ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS live_chat_messages (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  live_session_id   UUID          NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
  user_id           UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  content           TEXT          NOT NULL,
  message_type      TEXT          NOT NULL DEFAULT 'text'
                                  CHECK (message_type IN ('text','emoji','system','pin')),
  is_pinned         BOOLEAN       NOT NULL DEFAULT false,
  is_deleted        BOOLEAN       NOT NULL DEFAULT false,
  reply_to_id       UUID          REFERENCES live_chat_messages(id) ON DELETE SET NULL,
  metadata          JSONB         NOT NULL DEFAULT '{}',

  created_at        TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_live_chat_session ON live_chat_messages(live_session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_live_chat_tenant  ON live_chat_messages(tenant_id);
CREATE INDEX IF NOT EXISTS idx_live_chat_pinned  ON live_chat_messages(live_session_id, is_pinned)
  WHERE is_pinned = true;

-- ── postprod_versions ─────────────────────────────────────────────────────
-- Versions de post-production d'un contenu vidéo (course-builder)

CREATE TABLE IF NOT EXISTS postprod_versions (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  source_id       UUID          NOT NULL,   -- course_id, live_session_id, ou autre
  source_type     TEXT          NOT NULL    -- 'course', 'live', 'masterclass'
                                CHECK (source_type IN ('course','live','masterclass','studio')),

  version_number  INT           NOT NULL DEFAULT 1,
  label           TEXT,                     -- ex: "v2 - sous-titres FR"
  status          TEXT          NOT NULL DEFAULT 'draft'
                                CHECK (status IN ('draft','processing','ready','published','archived')),

  video_url       TEXT,
  thumbnail_url   TEXT,
  duration_seconds INT,
  file_size_bytes  BIGINT,

  transcript      TEXT,
  subtitles       JSONB         NOT NULL DEFAULT '[]',  -- [{lang, url}]
  chapters        JSONB         NOT NULL DEFAULT '[]',  -- [{title, start_sec}]

  processing_job_id TEXT,
  processing_error  TEXT,

  created_by      UUID          REFERENCES auth.users(id) ON DELETE SET NULL,
  published_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_postprod_source   ON postprod_versions(source_id, source_type);
CREATE INDEX IF NOT EXISTS idx_postprod_tenant   ON postprod_versions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_postprod_status   ON postprod_versions(tenant_id, status);

DROP TRIGGER IF EXISTS postprod_versions_updated_at ON postprod_versions;
CREATE TRIGGER postprod_versions_updated_at
  BEFORE UPDATE ON postprod_versions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── RLS ───────────────────────────────────────────────────────────────────

ALTER TABLE live_scripts      ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_questions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE postprod_versions ENABLE ROW LEVEL SECURITY;

-- live_scripts : lecture membres, écriture teacher+
DO $$ BEGIN
  DROP POLICY IF EXISTS "member_read_scripts" ON live_scripts;
  CREATE POLICY "member_read_scripts" ON live_scripts FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.tenant_id = live_scripts.tenant_id AND tm.user_id = auth.uid()));
  DROP POLICY IF EXISTS "teacher_manage_scripts" ON live_scripts;
  CREATE POLICY "teacher_manage_scripts" ON live_scripts FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.tenant_id = live_scripts.tenant_id AND tm.user_id = auth.uid() AND tm.role IN ('owner','admin','teacher')))
    WITH CHECK (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.tenant_id = live_scripts.tenant_id AND tm.user_id = auth.uid() AND tm.role IN ('owner','admin','teacher')));
  DROP POLICY IF EXISTS "sr_scripts" ON live_scripts;
  CREATE POLICY "sr_scripts" ON live_scripts FOR ALL TO service_role USING (true) WITH CHECK (true);
END $$;

-- live_questions : membres lisent et posent des questions, host/admin répondent
DO $$ BEGIN
  DROP POLICY IF EXISTS "member_manage_questions" ON live_questions;
  CREATE POLICY "member_manage_questions" ON live_questions FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.tenant_id = live_questions.tenant_id AND tm.user_id = auth.uid()))
    WITH CHECK (user_id = auth.uid());
  DROP POLICY IF EXISTS "sr_questions" ON live_questions;
  CREATE POLICY "sr_questions" ON live_questions FOR ALL TO service_role USING (true) WITH CHECK (true);
END $$;

-- live_chat_messages : membres lisent et écrivent
DO $$ BEGIN
  DROP POLICY IF EXISTS "member_chat" ON live_chat_messages;
  CREATE POLICY "member_chat" ON live_chat_messages FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.tenant_id = live_chat_messages.tenant_id AND tm.user_id = auth.uid()))
    WITH CHECK (user_id = auth.uid());
  DROP POLICY IF EXISTS "sr_chat" ON live_chat_messages;
  CREATE POLICY "sr_chat" ON live_chat_messages FOR ALL TO service_role USING (true) WITH CHECK (true);
END $$;

-- postprod_versions : teacher+ gèrent, membres lisent les versions publiées
DO $$ BEGIN
  DROP POLICY IF EXISTS "member_read_postprod" ON postprod_versions;
  CREATE POLICY "member_read_postprod" ON postprod_versions FOR SELECT TO authenticated
    USING (status = 'published' AND EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.tenant_id = postprod_versions.tenant_id AND tm.user_id = auth.uid()));
  DROP POLICY IF EXISTS "teacher_manage_postprod" ON postprod_versions;
  CREATE POLICY "teacher_manage_postprod" ON postprod_versions FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.tenant_id = postprod_versions.tenant_id AND tm.user_id = auth.uid() AND tm.role IN ('owner','admin','teacher')))
    WITH CHECK (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.tenant_id = postprod_versions.tenant_id AND tm.user_id = auth.uid() AND tm.role IN ('owner','admin','teacher')));
  DROP POLICY IF EXISTS "sr_postprod" ON postprod_versions;
  CREATE POLICY "sr_postprod" ON postprod_versions FOR ALL TO service_role USING (true) WITH CHECK (true);
END $$;

COMMENT ON TABLE live_scripts       IS 'Scripts de présentation ordonnés pour les sessions live.';
COMMENT ON TABLE live_questions      IS 'Questions posées par les participants pendant un live, avec réponses.';
COMMENT ON TABLE live_chat_messages  IS 'Messages du chat en temps réel pendant les sessions live.';
COMMENT ON TABLE postprod_versions   IS 'Versions post-production des contenus vidéo (cours, lives, masterclass).';
