-- LIRI SmartBoard V2 — Decks & Slides multi-tenant

CREATE TABLE IF NOT EXISTS smartboard_decks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  source_text TEXT NOT NULL DEFAULT '',
  format JSONB,
  theme JSONB,
  global_rules JSONB,
  layout JSONB,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_smartboard_decks_tenant ON smartboard_decks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_smartboard_decks_status ON smartboard_decks(tenant_id, status);

CREATE TABLE IF NOT EXISTS smartboard_slides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deck_id UUID REFERENCES smartboard_decks(id) ON DELETE CASCADE NOT NULL,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  slide_index INTEGER NOT NULL DEFAULT 0,
  step TEXT,
  title TEXT NOT NULL DEFAULT '',
  subtitle TEXT,
  core_idea TEXT,
  pedagogical_goal TEXT,
  dominant_mode TEXT,
  hero_visual JSONB,
  development JSONB,
  illustration JSONB,
  illustration_image_url TEXT,
  slide_summary TEXT,
  progressive_build JSONB,
  content JSONB,
  visual JSONB,
  graphic JSONB,
  student_action TEXT,
  teacher_note TEXT,
  transition TEXT,
  master_script JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_smartboard_slides_deck ON smartboard_slides(deck_id);
CREATE INDEX IF NOT EXISTS idx_smartboard_slides_tenant ON smartboard_slides(tenant_id);
CREATE INDEX IF NOT EXISTS idx_smartboard_slides_order ON smartboard_slides(deck_id, slide_index);

-- RLS

ALTER TABLE smartboard_decks ENABLE ROW LEVEL SECURITY;
ALTER TABLE smartboard_slides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "SmartBoard decks visibles par membres tenant" ON smartboard_decks;
CREATE POLICY "SmartBoard decks visibles par membres tenant" ON smartboard_decks
  FOR SELECT USING (
    EXISTS(
      SELECT 1 FROM tenant_memberships
      WHERE tenant_id = smartboard_decks.tenant_id
        AND user_id = auth.uid()
        AND status = 'active'
    )
  );

DROP POLICY IF EXISTS "SmartBoard decks modifiables par staff tenant" ON smartboard_decks;
CREATE POLICY "SmartBoard decks modifiables par staff tenant" ON smartboard_decks
  FOR ALL USING (
    EXISTS(
      SELECT 1 FROM tenant_memberships
      WHERE tenant_id = smartboard_decks.tenant_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin', 'teacher')
        AND status = 'active'
    )
  );

DROP POLICY IF EXISTS "SmartBoard slides visibles par membres tenant" ON smartboard_slides;
CREATE POLICY "SmartBoard slides visibles par membres tenant" ON smartboard_slides
  FOR SELECT USING (
    EXISTS(
      SELECT 1 FROM tenant_memberships
      WHERE tenant_id = smartboard_slides.tenant_id
        AND user_id = auth.uid()
        AND status = 'active'
    )
  );

DROP POLICY IF EXISTS "SmartBoard slides modifiables par staff tenant" ON smartboard_slides;
CREATE POLICY "SmartBoard slides modifiables par staff tenant" ON smartboard_slides
  FOR ALL USING (
    EXISTS(
      SELECT 1 FROM tenant_memberships
      WHERE tenant_id = smartboard_slides.tenant_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin', 'teacher')
        AND status = 'active'
    )
  );

-- Triggers

DROP TRIGGER IF EXISTS smartboard_decks_updated_at ON smartboard_decks;
CREATE TRIGGER smartboard_decks_updated_at
  BEFORE UPDATE ON smartboard_decks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS smartboard_slides_updated_at ON smartboard_slides;
CREATE TRIGGER smartboard_slides_updated_at
  BEFORE UPDATE ON smartboard_slides
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
