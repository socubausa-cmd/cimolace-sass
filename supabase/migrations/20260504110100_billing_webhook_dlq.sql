-- REQ-BILL-003 — File d’attente des webhooks billing ayant échoué après
-- idempotence (claim), avec rejeu HTTP planifié et backoff exponentiel.

CREATE TABLE IF NOT EXISTS public.billing_webhook_dlq (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  event_id TEXT NOT NULL,
  raw_body TEXT NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'application/json',
  headers JSONB NOT NULL DEFAULT '{}'::jsonb,
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT DEFAULT NULL,
  next_retry_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_error TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'completed', 'dead')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, event_id)
);

CREATE INDEX IF NOT EXISTS billing_webhook_dlq_pending_retry_idx
  ON public.billing_webhook_dlq (next_retry_at ASC)
  WHERE status = 'pending';

COMMENT ON TABLE public.billing_webhook_dlq IS
  'REQ-BILL-003: webhooks billing à rejouer après erreur ; rejeu via billing-process-webhook-dlq.';

ALTER TABLE public.billing_webhook_dlq ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.billing_webhook_dlq FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.billing_webhook_dlq TO service_role;
