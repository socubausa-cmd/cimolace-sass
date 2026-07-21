-- 20260714140000_billing_webhook_events_dedup.sql
-- Dédup d'événements webhook (anti double-provisioning / double-tenant au retry Stripe).
-- claimWebhookEvent() insère l'event_id ; un 23505 = déjà traité → l'orchestrateur ne
-- rejoue pas. Table interne, additif, réversible. Aucun impact sur l'existant.
CREATE TABLE IF NOT EXISTS public.billing_webhook_events (
  event_id     text PRIMARY KEY,
  processed_at timestamptz NOT NULL DEFAULT now()
);
-- RLS : jamais exposée à l'API publique (service_role uniquement, comme les autres tables billing internes).
ALTER TABLE public.billing_webhook_events ENABLE ROW LEVEL SECURITY;
