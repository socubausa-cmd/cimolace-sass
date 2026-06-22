-- Suivi de la vérification de domaine Resend par tenant (no-code back-office).
-- email_domain_id = id du domaine côté Resend (retourné par POST /domains),
-- nécessaire pour POST /domains/:id/verify et GET /domains/:id.
ALTER TABLE public.tenant_notification_settings
  ADD COLUMN IF NOT EXISTS email_domain_id text;
