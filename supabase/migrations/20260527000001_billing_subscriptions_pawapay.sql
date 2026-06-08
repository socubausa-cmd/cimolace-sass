-- Allow PawaPay as a SaaS billing provider for school onboarding.

ALTER TABLE billing_subscriptions
  DROP CONSTRAINT IF EXISTS billing_subscriptions_provider_check;

ALTER TABLE billing_subscriptions
  ADD CONSTRAINT billing_subscriptions_provider_check
  CHECK (provider IN ('stripe','chariow','cinetpay','pawapay','nowpayments','paypal'));
