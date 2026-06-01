-- ============================================================================
-- Migration: Tables diverses — NeuroRecall, IRI, Secrétariat, Débats
-- Date: 2026-05-21
--
-- Tables : recall_decks, recall_cards, iri_pages,
--          secretariat_documents, secretariat_workflow,
--          debates, debate_votes
-- ============================================================================

-- ══════════════════════════════════════════════════════════════════════════════
-- NEURO-RECALL (flashcards répétition espacée)
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS recall_decks (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_by      UUID          REFERENCES auth.users(id) ON DELETE SET NULL,

  title           TEXT          NOT NULL,
  description     TEXT,
  source_type     TEXT          DEFAULT 'manual'
                                CHECK (source_type IN ('manual','ai','course','masterclass')),
  source_id       UUID,
  card_count      INT           NOT NULL DEFAULT 0,
  language        TEXT          NOT NULL DEFAULT 'fr',
  is_public       BOOLEAN       NOT NULL DEFAULT false,
  metadata        JSONB         NOT NULL DEFAULT '{}',

  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recall_decks_tenant ON recall_decks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_recall_decks_author ON recall_decks(created_by);

DROP TRIGGER IF EXISTS recall_decks_updated_at ON recall_decks;
CREATE TRIGGER recall_decks_updated_at
  BEFORE UPDATE ON recall_decks FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── recall_cards ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS recall_cards (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  deck_id         UUID          NOT NULL REFERENCES recall_decks(id) ON DELETE CASCADE,
  user_id         UUID          REFERENCES auth.users(id) ON DELETE SET NULL,

  front           TEXT          NOT NULL,
  back            TEXT          NOT NULL,
  hint            TEXT,
  card_type       TEXT          NOT NULL DEFAULT 'basic'
                                CHECK (card_type IN ('basic','cloze','image','audio')),
  tags            TEXT[]        NOT NULL DEFAULT '{}',

  -- Spaced repetition (SM-2 / FSRS)
  ease_factor     NUMERIC(4,2)  NOT NULL DEFAULT 2.5,
  interval_days   INT           NOT NULL DEFAULT 1,
  repetitions     INT           NOT NULL DEFAULT 0,
  due_at          TIMESTAMPTZ   NOT NULL DEFAULT now(),
  last_reviewed_at TIMESTAMPTZ,
  last_rating     INT,          -- 1=again 2=hard 3=good 4=easy

  metadata        JSONB         NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recall_cards_deck   ON recall_cards(deck_id);
CREATE INDEX IF NOT EXISTS idx_recall_cards_due    ON recall_cards(user_id, due_at) WHERE due_at <= now() + interval '1 day';
CREATE INDEX IF NOT EXISTS idx_recall_cards_tenant ON recall_cards(tenant_id);

DROP TRIGGER IF EXISTS recall_cards_updated_at ON recall_cards;
CREATE TRIGGER recall_cards_updated_at
  BEFORE UPDATE ON recall_cards FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ══════════════════════════════════════════════════════════════════════════════
-- IRI — Pages immersives (éditeur de pages riches)
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS iri_pages (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_by      UUID          REFERENCES auth.users(id) ON DELETE SET NULL,

  title           TEXT          NOT NULL,
  slug            TEXT          NOT NULL,
  content         JSONB         NOT NULL DEFAULT '{}',   -- blocs éditeur
  cover_image_url TEXT,
  excerpt         TEXT,
  page_type       TEXT          NOT NULL DEFAULT 'page'
                                CHECK (page_type IN ('page','landing','article','course_page','event')),
  status          TEXT          NOT NULL DEFAULT 'draft'
                                CHECK (status IN ('draft','published','scheduled','archived')),
  password        TEXT,         -- page protégée par mot de passe
  seo             JSONB         NOT NULL DEFAULT '{}',   -- {title, description, og_image}
  published_at    TIMESTAMPTZ,
  metadata        JSONB         NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),

  UNIQUE (tenant_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_iri_pages_tenant  ON iri_pages(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_iri_pages_slug    ON iri_pages(tenant_id, slug);
CREATE INDEX IF NOT EXISTS idx_iri_pages_type    ON iri_pages(tenant_id, page_type, status);

DROP TRIGGER IF EXISTS iri_pages_updated_at ON iri_pages;
CREATE TRIGGER iri_pages_updated_at
  BEFORE UPDATE ON iri_pages FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ══════════════════════════════════════════════════════════════════════════════
-- SECRÉTARIAT
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS secretariat_documents (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_by      UUID          REFERENCES auth.users(id) ON DELETE SET NULL,

  title           TEXT          NOT NULL,
  type            TEXT          NOT NULL DEFAULT 'general'
                                CHECK (type IN ('general','contract','invoice','certificate','report','correspondence','other')),
  content         TEXT          NOT NULL DEFAULT '',
  file_url        TEXT,
  file_size_bytes BIGINT,
  mime_type       TEXT,

  status          TEXT          NOT NULL DEFAULT 'draft'
                                CHECK (status IN ('draft','review','approved','archived')),
  is_confidential BOOLEAN       NOT NULL DEFAULT false,
  tags            TEXT[]        NOT NULL DEFAULT '{}',
  metadata        JSONB         NOT NULL DEFAULT '{}',

  signed_at       TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sec_docs_tenant ON secretariat_documents(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_sec_docs_type   ON secretariat_documents(tenant_id, type);

DROP TRIGGER IF EXISTS secretariat_documents_updated_at ON secretariat_documents;
CREATE TRIGGER secretariat_documents_updated_at
  BEFORE UPDATE ON secretariat_documents FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS secretariat_workflow (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  document_id     UUID          REFERENCES secretariat_documents(id) ON DELETE CASCADE,

  step_name       TEXT          NOT NULL,
  status          TEXT          NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending','in_progress','approved','rejected','skipped')),
  assigned_to     UUID          REFERENCES auth.users(id) ON DELETE SET NULL,
  notes           TEXT,
  updated_by      UUID          REFERENCES auth.users(id) ON DELETE SET NULL,
  order_index     INT           NOT NULL DEFAULT 0,
  due_at          TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sec_workflow_doc    ON secretariat_workflow(document_id);
CREATE INDEX IF NOT EXISTS idx_sec_workflow_tenant ON secretariat_workflow(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_sec_workflow_user   ON secretariat_workflow(assigned_to);

DROP TRIGGER IF EXISTS secretariat_workflow_updated_at ON secretariat_workflow;
CREATE TRIGGER secretariat_workflow_updated_at
  BEFORE UPDATE ON secretariat_workflow FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ══════════════════════════════════════════════════════════════════════════════
-- DÉBATS (utilisés dans les sessions live)
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS debates (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  live_session_id UUID          REFERENCES live_sessions(id) ON DELETE SET NULL,

  title           TEXT          NOT NULL,
  description     TEXT,
  side_a          TEXT          NOT NULL DEFAULT 'Pour',
  side_b          TEXT          NOT NULL DEFAULT 'Contre',
  status          TEXT          NOT NULL DEFAULT 'upcoming'
                                CHECK (status IN ('upcoming','active','closed','archived')),

  votes_a         INT           NOT NULL DEFAULT 0,
  votes_b         INT           NOT NULL DEFAULT 0,
  scheduled_at    TIMESTAMPTZ,
  ended_at        TIMESTAMPTZ,
  metadata        JSONB         NOT NULL DEFAULT '{}',

  created_by      UUID          REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_debates_tenant  ON debates(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_debates_session ON debates(live_session_id);

DROP TRIGGER IF EXISTS debates_updated_at ON debates;
CREATE TRIGGER debates_updated_at
  BEFORE UPDATE ON debates FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS debate_votes (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  debate_id   UUID        NOT NULL REFERENCES debates(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  side        TEXT        NOT NULL CHECK (side IN ('a','b')),
  voted_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (debate_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_debate_votes_debate ON debate_votes(debate_id);
CREATE INDEX IF NOT EXISTS idx_debate_votes_user   ON debate_votes(user_id);

-- ── RLS ───────────────────────────────────────────────────────────────────

ALTER TABLE recall_decks          ENABLE ROW LEVEL SECURITY;
ALTER TABLE recall_cards          ENABLE ROW LEVEL SECURITY;
ALTER TABLE iri_pages             ENABLE ROW LEVEL SECURITY;
ALTER TABLE secretariat_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE secretariat_workflow  ENABLE ROW LEVEL SECURITY;
ALTER TABLE debates               ENABLE ROW LEVEL SECURITY;
ALTER TABLE debate_votes          ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  -- recall_decks : membres lisent, auteur gère
  DROP POLICY IF EXISTS "member_read_decks" ON recall_decks;
  CREATE POLICY "member_read_decks" ON recall_decks FOR SELECT TO authenticated
    USING (is_public = true OR created_by = auth.uid() OR EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.tenant_id = recall_decks.tenant_id AND tm.user_id = auth.uid()));
  DROP POLICY IF EXISTS "user_manage_own_decks" ON recall_decks;
  CREATE POLICY "user_manage_own_decks" ON recall_decks FOR ALL TO authenticated
    USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());
  DROP POLICY IF EXISTS "sr_recall_decks" ON recall_decks;
  CREATE POLICY "sr_recall_decks" ON recall_decks FOR ALL TO service_role USING (true) WITH CHECK (true);

  -- recall_cards
  DROP POLICY IF EXISTS "user_manage_own_cards" ON recall_cards;
  CREATE POLICY "user_manage_own_cards" ON recall_cards FOR ALL TO authenticated
    USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM recall_decks rd WHERE rd.id = recall_cards.deck_id AND rd.created_by = auth.uid()))
    WITH CHECK (user_id = auth.uid() OR EXISTS (SELECT 1 FROM recall_decks rd WHERE rd.id = recall_cards.deck_id AND rd.created_by = auth.uid()));
  DROP POLICY IF EXISTS "sr_recall_cards" ON recall_cards;
  CREATE POLICY "sr_recall_cards" ON recall_cards FOR ALL TO service_role USING (true) WITH CHECK (true);

  -- iri_pages
  DROP POLICY IF EXISTS "public_read_iri" ON iri_pages;
  CREATE POLICY "public_read_iri" ON iri_pages FOR SELECT TO authenticated
    USING (status = 'published');
  DROP POLICY IF EXISTS "admin_manage_iri" ON iri_pages;
  CREATE POLICY "admin_manage_iri" ON iri_pages FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.tenant_id = iri_pages.tenant_id AND tm.user_id = auth.uid() AND tm.role IN ('owner','admin')))
    WITH CHECK (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.tenant_id = iri_pages.tenant_id AND tm.user_id = auth.uid() AND tm.role IN ('owner','admin')));
  DROP POLICY IF EXISTS "sr_iri_pages" ON iri_pages;
  CREATE POLICY "sr_iri_pages" ON iri_pages FOR ALL TO service_role USING (true) WITH CHECK (true);

  -- secretariat
  DROP POLICY IF EXISTS "staff_read_sec_docs" ON secretariat_documents;
  CREATE POLICY "staff_read_sec_docs" ON secretariat_documents FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.tenant_id = secretariat_documents.tenant_id AND tm.user_id = auth.uid() AND tm.role IN ('owner','admin','secretariat')));
  DROP POLICY IF EXISTS "sr_sec_docs" ON secretariat_documents;
  CREATE POLICY "sr_sec_docs" ON secretariat_documents FOR ALL TO service_role USING (true) WITH CHECK (true);

  DROP POLICY IF EXISTS "staff_read_sec_workflow" ON secretariat_workflow;
  CREATE POLICY "staff_read_sec_workflow" ON secretariat_workflow FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.tenant_id = secretariat_workflow.tenant_id AND tm.user_id = auth.uid() AND tm.role IN ('owner','admin','secretariat')))
    WITH CHECK (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.tenant_id = secretariat_workflow.tenant_id AND tm.user_id = auth.uid() AND tm.role IN ('owner','admin','secretariat')));
  DROP POLICY IF EXISTS "sr_sec_workflow" ON secretariat_workflow;
  CREATE POLICY "sr_sec_workflow" ON secretariat_workflow FOR ALL TO service_role USING (true) WITH CHECK (true);

  -- debates
  DROP POLICY IF EXISTS "member_read_debates" ON debates;
  CREATE POLICY "member_read_debates" ON debates FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.tenant_id = debates.tenant_id AND tm.user_id = auth.uid()));
  DROP POLICY IF EXISTS "sr_debates" ON debates;
  CREATE POLICY "sr_debates" ON debates FOR ALL TO service_role USING (true) WITH CHECK (true);

  -- debate_votes
  DROP POLICY IF EXISTS "user_manage_own_vote" ON debate_votes;
  CREATE POLICY "user_manage_own_vote" ON debate_votes FOR ALL TO authenticated
    USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  DROP POLICY IF EXISTS "member_read_votes" ON debate_votes;
  CREATE POLICY "member_read_votes" ON debate_votes FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.tenant_id = debate_votes.tenant_id AND tm.user_id = auth.uid()));
  DROP POLICY IF EXISTS "sr_debate_votes" ON debate_votes;
  CREATE POLICY "sr_debate_votes" ON debate_votes FOR ALL TO service_role USING (true) WITH CHECK (true);
END $$;

COMMENT ON TABLE recall_decks          IS 'Jeux de flashcards pour la répétition espacée (NeuroRecall).';
COMMENT ON TABLE recall_cards          IS 'Cartes individuelles avec algorithme SM-2 de répétition.';
COMMENT ON TABLE iri_pages             IS 'Pages immersives multi-blocs créées avec l''éditeur IRI.';
COMMENT ON TABLE secretariat_documents IS 'Documents du secrétariat (contrats, certificats, rapports).';
COMMENT ON TABLE secretariat_workflow  IS 'Étapes de validation des documents secrétariat.';
COMMENT ON TABLE debates               IS 'Débats interactifs associés aux sessions live.';
COMMENT ON TABLE debate_votes          IS 'Votes des participants aux débats (un vote par user/débat).';
