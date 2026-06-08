-- ────────────────────────────────────────────────────────────────────────────
-- Ajoute 'liri' aux infrastructure_type autorisés sur tenants.
-- LIRI Studio peut désormais exister comme infrastructure standalone
-- (live + IA pur, sans LMS École).
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE tenants
  DROP CONSTRAINT IF EXISTS tenants_infrastructure_type_check;

ALTER TABLE tenants
  ADD CONSTRAINT tenants_infrastructure_type_check
  CHECK (
    infrastructure_type IS NULL OR
    infrastructure_type IN (
      'liri',        -- ⭐ Studio live + IA standalone
      'school',      -- École en ligne (LMS complet)
      'medos',       -- Cabinet médical (EHR)
      'mbolo',       -- E-commerce Afrique
      'wellness',    -- Bien-être / coaching
      'creator',     -- Studio créateur de contenu
      'temple',      -- Spirituel / cérémonies
      'community'    -- Forum / messagerie
    )
  );

COMMENT ON COLUMN tenants.infrastructure_type IS
  'Type d''infrastructure choisi à l''onboarding. Détermine les moteurs activés par défaut et le branding tenant.';
