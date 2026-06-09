-- ========================================================================
-- MEDOS v2 - BIO DIGITAL TWIN AI - Versioning moteur + graphe (P2 C1)
-- ========================================================================
-- Permet de versionner le moteur deterministe (ENGINE_VERSION) et le graphe
-- biologique (GRAPH_VERSION) afin de pouvoir, plus tard, comparer les
-- snapshots de scores produits par differentes versions du moteur ou du
-- graphe.
--
-- Les snapshots eux-memes sont deja historises dans med_organ_scores via
-- des INSERT non-ecrasants (cf. TwinService.computeScores). La presente
-- migration n'ajoute donc qu'un referentiel de versions, pas de table de
-- snapshots dedicacee.
--
-- Idempotente, 100% ASCII.
-- ========================================================================

-- Referentiel des versions de moteur / graphe.
CREATE TABLE IF NOT EXISTS med_engine_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  version TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('engine','graph')),
  description_fr TEXT,
  released_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deprecated_at TIMESTAMPTZ,
  change_notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_med_engine_versions_active
  ON med_engine_versions(is_active);

CREATE INDEX IF NOT EXISTS idx_med_engine_versions_kind
  ON med_engine_versions(kind, is_active);

-- Seed initial : moteur deterministe v1 + graphe biologique v1.
-- Code = cle naturelle (kind:version concatenes mais ici on garde une cle
-- simple lisible pour le seed historique).
INSERT INTO med_engine_versions (code, version, kind, description_fr, is_active)
VALUES
  ('engine_v1', 'v1', 'engine', 'Moteur deterministe v1', true),
  ('graph_v1',  'v1', 'graph',  'Graph biologique v1',    true)
ON CONFLICT (code) DO NOTHING;

-- RLS : lecture pour tout authentifie (referentiel global, tenant NULL),
-- ecriture reservee au service_role (administration plateforme).
ALTER TABLE med_engine_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_all_med_engine_versions" ON med_engine_versions;
CREATE POLICY "read_all_med_engine_versions" ON med_engine_versions
  FOR SELECT
  USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

DROP POLICY IF EXISTS "service_role_med_engine_versions" ON med_engine_versions;
CREATE POLICY "service_role_med_engine_versions" ON med_engine_versions
  TO service_role
  USING (true)
  WITH CHECK (true);
