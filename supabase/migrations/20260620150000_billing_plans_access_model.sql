-- Modèle d'accès configurable par service :
--   paid      = payant (passe par le checkout Stripe/PawaPay)
--   free      = gratuit (accès direct accordé, sans paiement)
--   community = communauté (adhésion gratuite à un espace communautaire, ex. le Temple)
-- Non-destructif : défaut 'paid' → toutes les offres existantes restent payantes.

ALTER TABLE public.billing_plans
  ADD COLUMN IF NOT EXISTS access_model text NOT NULL DEFAULT 'paid';
