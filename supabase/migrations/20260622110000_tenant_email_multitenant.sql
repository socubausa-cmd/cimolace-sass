-- Email MULTI-TENANT : expéditeur + liens + clé Resend OPTIONNELLE, par tenant.
-- Supporte les domaines custom : chaque école envoie depuis SON domaine vérifié,
-- avec des liens vers SON portail. `resend_api_key` NULL = compte Resend central
-- de Cimolace ; renseigné = compte du tenant (BYO, domaine custom autonome).

ALTER TABLE public.tenant_notification_settings
  ADD COLUMN IF NOT EXISTS email_from       text,
  ADD COLUMN IF NOT EXISTS email_from_name  text,
  ADD COLUMN IF NOT EXISTS app_base_url     text,
  ADD COLUMN IF NOT EXISTS resend_api_key   text,
  ADD COLUMN IF NOT EXISTS email_domain     text,
  ADD COLUMN IF NOT EXISTS email_verified   boolean NOT NULL DEFAULT false;

-- email_queue : tenant_id (→ résout la clé/from à l'envoi) + nom d'expéditeur affiché.
ALTER TABLE public.email_queue
  ADD COLUMN IF NOT EXISTS tenant_id  uuid,
  ADD COLUMN IF NOT EXISTS from_name  text;

-- ── Seed (idempotent, via slug — pas d'uuid codé en dur) ─────────────────────
-- ISNA / Prorascience : domaine prorascience.org (PAS ENCORE vérifié dans Resend
-- → email_verified=false ; passera true une fois le DNS posé + vérifié).
INSERT INTO public.tenant_notification_settings
  (tenant_id, email_from, email_from_name, app_base_url, email_domain, email_verified)
SELECT id, 'noreply@prorascience.org', 'ISNA Prorascience', 'https://prorascience.org', 'prorascience.org', false
FROM public.tenants WHERE slug = 'isna'
ON CONFLICT (tenant_id) DO UPDATE
  SET email_from = EXCLUDED.email_from, email_from_name = EXCLUDED.email_from_name,
      app_base_url = EXCLUDED.app_base_url, email_domain = EXCLUDED.email_domain,
      updated_at = now();

-- Zahir Wellness : domaine zahirwellness.com DÉJÀ vérifié dans le compte Resend
-- central → peut envoyer immédiatement (email_verified=true). Liens via le portail.
INSERT INTO public.tenant_notification_settings
  (tenant_id, email_from, email_from_name, app_base_url, email_domain, email_verified)
SELECT id, 'noreply@zahirwellness.com', 'Zahir Wellness', 'https://app.cimolace.space', 'zahirwellness.com', true
FROM public.tenants WHERE slug = 'zahirwellness'
ON CONFLICT (tenant_id) DO UPDATE
  SET email_from = EXCLUDED.email_from, email_from_name = EXCLUDED.email_from_name,
      email_domain = EXCLUDED.email_domain, email_verified = EXCLUDED.email_verified,
      updated_at = now();
