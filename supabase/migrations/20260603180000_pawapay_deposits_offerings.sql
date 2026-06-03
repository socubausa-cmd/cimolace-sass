-- Généralise pawapay_deposits aux offres PRORASCIENCE / Ngowazulu
-- (abonnement mentorat, consultation, offrande) au-delà des seuls live_sessions.
--
-- ⚠️ `supabase db push` est cassé sur ce projet (historique distant désynchro).
--    Appliquer ce fichier À LA MAIN dans le SQL Editor du dashboard Supabase.

-- 1) Un dépôt d'offre n'est pas rattaché à un live → live_session_id devient nullable.
ALTER TABLE pawapay_deposits ALTER COLUMN live_session_id DROP NOT NULL;

-- 2) Nature du paiement + offre associée.
ALTER TABLE pawapay_deposits ADD COLUMN IF NOT EXISTS kind TEXT;       -- 'subscription' | 'consultation' | 'donation' | 'live_session'
ALTER TABLE pawapay_deposits ADD COLUMN IF NOT EXISTS plan_slug TEXT;  -- ex: 'ngowazulu-mentorat-1x-week'

COMMENT ON COLUMN pawapay_deposits.kind IS
  'Nature du paiement: subscription | consultation | donation | live_session';
COMMENT ON COLUMN pawapay_deposits.plan_slug IS
  'Slug billing_plans pour un abonnement/consultation Ngowazulu (NULL pour live/don)';
