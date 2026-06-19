-- Réglages de notification par tenant — éditables NO-CODE depuis le back-office
-- (composant TenantWhatsAppSettings). Permet de changer le numéro WhatsApp de
-- l'école (la « chaîne WhatsApp » notifiée à chaque live programmé) sans redéployer.
--
-- ⚠️ Le numéro N'EST PAS un secret. Les identifiants Twilio (SID/Auth Token)
-- restent dans l'env du worker — JAMAIS dans une table éditable par le tenant.

CREATE TABLE IF NOT EXISTS public.tenant_notification_settings (
  tenant_id                 uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  -- Numéro WhatsApp de l'école (E.164, ex +24166863336) notifié à chaque live programmé.
  whatsapp_school_number    text,
  -- Active l'envoi WhatsApp vers ce numéro (la « chaîne » de l'école).
  whatsapp_channel_enabled  boolean NOT NULL DEFAULT false,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tenant_notification_settings ENABLE ROW LEVEL SECURITY;

-- Lecture/écriture réservées à l'owner/admin du tenant (mêmes règles que
-- tenant_payment_providers). Le worker lit en service_role (bypass RLS).
CREATE POLICY "tenant_notification_settings_select"
  ON public.tenant_notification_settings FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_memberships
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND status = 'active'
    )
  );

CREATE POLICY "tenant_notification_settings_insert"
  ON public.tenant_notification_settings FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_memberships
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND status = 'active'
    )
  );

CREATE POLICY "tenant_notification_settings_update"
  ON public.tenant_notification_settings FOR UPDATE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_memberships
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND status = 'active'
    )
  );
