-- Migration: forum
-- Tables forum_categories, forum_topics, forum_posts avec RLS multi-tenant.

-- ── CATEGORIES ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS forum_categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL,
  description TEXT,
  color       TEXT DEFAULT '#6366f1',
  icon        TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (tenant_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_forum_categories_tenant ON forum_categories(tenant_id);

ALTER TABLE forum_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "forum_categories_tenant_select"
  ON forum_categories FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_memberships WHERE user_id = auth.uid() AND status = 'active'
    )
  );

CREATE POLICY "forum_categories_admin_all"
  ON forum_categories FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_memberships WHERE user_id = auth.uid() AND role IN ('owner','admin') AND status = 'active'
    )
  );

-- ── TOPICS ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS forum_topics (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  author_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category      TEXT NOT NULL DEFAULT 'general',
  title         TEXT NOT NULL CHECK (char_length(title) <= 500),
  content       TEXT NOT NULL CHECK (char_length(content) <= 10000),
  is_pinned     BOOLEAN NOT NULL DEFAULT false,
  is_locked     BOOLEAN NOT NULL DEFAULT false,
  views_count   INTEGER NOT NULL DEFAULT 0,
  replies_count INTEGER NOT NULL DEFAULT 0,
  last_post_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_forum_topics_tenant ON forum_topics(tenant_id);
CREATE INDEX IF NOT EXISTS idx_forum_topics_author ON forum_topics(author_id);
CREATE INDEX IF NOT EXISTS idx_forum_topics_category ON forum_topics(tenant_id, category);
CREATE INDEX IF NOT EXISTS idx_forum_topics_pinned ON forum_topics(tenant_id, is_pinned, created_at DESC);

ALTER TABLE forum_topics ENABLE ROW LEVEL SECURITY;

-- Membres actifs peuvent lire
CREATE POLICY "forum_topics_member_select"
  ON forum_topics FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_memberships WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- Membres actifs peuvent créer
CREATE POLICY "forum_topics_member_insert"
  ON forum_topics FOR INSERT
  WITH CHECK (
    author_id = auth.uid()
    AND tenant_id IN (
      SELECT tenant_id FROM tenant_memberships WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- Auteur peut modifier son topic (si pas verrouillé)
CREATE POLICY "forum_topics_author_update"
  ON forum_topics FOR UPDATE
  USING (author_id = auth.uid() AND is_locked = false);

-- Admin/owner peuvent tout modifier (pin, lock, delete)
CREATE POLICY "forum_topics_admin_all"
  ON forum_topics FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_memberships WHERE user_id = auth.uid() AND role IN ('owner','admin') AND status = 'active'
    )
  );

-- ── POSTS (réponses) ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS forum_posts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  topic_id    UUID NOT NULL REFERENCES forum_topics(id) ON DELETE CASCADE,
  author_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content     TEXT NOT NULL CHECK (char_length(content) <= 10000),
  parent_id   UUID REFERENCES forum_posts(id) ON DELETE SET NULL,  -- pour les réponses imbriquées
  is_solution BOOLEAN NOT NULL DEFAULT false,  -- marquer la meilleure réponse
  likes_count INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_forum_posts_topic ON forum_posts(topic_id);
CREATE INDEX IF NOT EXISTS idx_forum_posts_tenant ON forum_posts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_forum_posts_author ON forum_posts(author_id);
CREATE INDEX IF NOT EXISTS idx_forum_posts_parent ON forum_posts(parent_id) WHERE parent_id IS NOT NULL;

ALTER TABLE forum_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "forum_posts_member_select"
  ON forum_posts FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_memberships WHERE user_id = auth.uid() AND status = 'active'
    )
  );

CREATE POLICY "forum_posts_member_insert"
  ON forum_posts FOR INSERT
  WITH CHECK (
    author_id = auth.uid()
    AND tenant_id IN (
      SELECT tenant_id FROM tenant_memberships WHERE user_id = auth.uid() AND status = 'active'
    )
  );

CREATE POLICY "forum_posts_author_update"
  ON forum_posts FOR UPDATE
  USING (author_id = auth.uid());

CREATE POLICY "forum_posts_admin_all"
  ON forum_posts FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_memberships WHERE user_id = auth.uid() AND role IN ('owner','admin') AND status = 'active'
    )
  );

-- ── TRIGGERS updated_at ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_forum_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_forum_topics_updated_at ON forum_topics;
CREATE TRIGGER trg_forum_topics_updated_at
  BEFORE UPDATE ON forum_topics
  FOR EACH ROW EXECUTE FUNCTION update_forum_updated_at();

DROP TRIGGER IF EXISTS trg_forum_posts_updated_at ON forum_posts;
CREATE TRIGGER trg_forum_posts_updated_at
  BEFORE UPDATE ON forum_posts
  FOR EACH ROW EXECUTE FUNCTION update_forum_updated_at();

-- Trigger pour incrémenter replies_count sur le topic parent
CREATE OR REPLACE FUNCTION forum_increment_replies()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE forum_topics SET replies_count = replies_count + 1, last_post_at = now()
    WHERE id = NEW.topic_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE forum_topics SET replies_count = GREATEST(replies_count - 1, 0)
    WHERE id = OLD.topic_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_forum_posts_count ON forum_posts;
CREATE TRIGGER trg_forum_posts_count
  AFTER INSERT OR DELETE ON forum_posts
  FOR EACH ROW EXECUTE FUNCTION forum_increment_replies();

-- Seed catégories par défaut (exécuté une seule fois via DO block pour idempotence)
-- Les vraies catégories seront créées par le back-office tenant.

COMMENT ON TABLE forum_categories IS 'Catégories forum par tenant.';
COMMENT ON TABLE forum_topics IS 'Discussions/sujets forum. replies_count mis à jour par trigger.';
COMMENT ON TABLE forum_posts IS 'Réponses à un topic. parent_id pour les fils imbriqués.';
