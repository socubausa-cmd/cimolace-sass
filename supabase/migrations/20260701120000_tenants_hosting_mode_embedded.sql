-- ────────────────────────────────────────────────────────────────────────────
-- HÉBERGÉ vs EMBARQUÉ — séparation dure LIRI.
--
-- Un tenant « EMBARQUÉ » a acheté la licence d'intégration : LIRI vit invisible
-- dans SON site (ex. prorascience.org), façon Zoom/Stripe/LiveKit. Il ne doit
-- JAMAIS être résolu ni joignable depuis le host neutre liri.cimolace.space.
--
-- Source de vérité = flag EXPLICITE `metadata.hosting_mode` ('embedded'|'hosted').
-- Côté API (tenant.service.isEmbeddedTenant), un défaut sûr s'applique en son
-- absence : un tenant à `primary_domain` non nul est présumé embarqué. Cette
-- migration rend le flag EXPLICITE pour les tenants embarqués connus (idempotente,
-- merge NON destructif : préserve site/settings/branding).
-- ────────────────────────────────────────────────────────────────────────────

UPDATE public.tenants
SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('hosting_mode', 'embedded')
WHERE slug IN ('isna', 'zahirwellness')
  AND COALESCE(metadata->>'hosting_mode', '') <> 'embedded';
