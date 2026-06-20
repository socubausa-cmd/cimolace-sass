-- Accès gratuit / communauté (claim-free) : l'abonnement est posé avec provider='free'.
-- L'ancienne contrainte CHECK ne listait que les providers de PAIEMENT, donc l'insert
-- avec provider='free' violait la contrainte. Comme createOrExtendSubscription n'évalue
-- pas l'erreur d'insert, l'échec était SILENCIEUX : POST /offering-checkout/claim-free
-- renvoyait 201 sans jamais créer la billing_subscription (donc aucun accès réel).
-- On autorise 'free' comme valeur de provider.
ALTER TABLE public.billing_subscriptions
  DROP CONSTRAINT IF EXISTS billing_subscriptions_provider_check;

ALTER TABLE public.billing_subscriptions
  ADD CONSTRAINT billing_subscriptions_provider_check
  CHECK (provider = ANY (ARRAY[
    'stripe'::text,
    'chariow'::text,
    'cinetpay'::text,
    'pawapay'::text,
    'nowpayments'::text,
    'paypal'::text,
    'free'::text
  ]));
