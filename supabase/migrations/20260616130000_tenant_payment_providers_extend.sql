-- ============================================================================
-- Migration : extension de tenant_payment_providers (config moyens de paiement)
-- Date : 2026-06-16
--
-- État prod constaté (migration 20260528190001_tenant_payment_providers.sql) :
--   * La table existe déjà avec un schéma « 2 providers » :
--       provider CHECK IN ('stripe','paypal') + colonnes en clair
--       public_key / secret_key / webhook_secret + mode + is_active.
--   * PAS de colonne `credentials` (jsonb chiffré), PAS de `product_map`
--     (Chariow), PAS de `enabled`, PAS de traçabilité de test `last_test_*`.
--
-- Ce que fait cette migration (NON destructive, idempotente) :
--   1. Relâche le CHECK provider → ajoute pawapay / chariow / cinetpay.
--   2. ADD COLUMN IF NOT EXISTS pour les colonnes cibles du nouveau moteur :
--      credentials jsonb (CHIFFRÉ, AES-256-GCM via crypto.util.ts),
--      product_map jsonb (Chariow : {start,business,entreprise,setup}),
--      enabled boolean, last_test_at / last_test_ok / last_test_message.
--   3. Aligne `enabled` sur l'ancien `is_active` (backfill) sans le supprimer.
--   4. Trigger updated_at.
--   5. RLS : conserve les policies owner/admin existantes (calquées sur
--      tenant_oauth_providers / pédagogie tenant-scoped) + ajoute un bypass
--      explicite service_role (le moteur de checkout lit en service_role).
--
-- Les colonnes en clair public_key/secret_key/webhook_secret de l'ancien
-- schéma sont CONSERVÉES (compat ascendante) mais ne sont plus écrites par le
-- nouveau module : tout passe désormais par `credentials` chiffré.
-- ============================================================================

BEGIN;

-- Garde-fou : si la table n'existait pas (env neuf), on la crée au schéma cible.
CREATE TABLE IF NOT EXISTS public.tenant_payment_providers (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider        text NOT NULL,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  UNIQUE (tenant_id, provider)
);

-- ── 1. Élargir la liste des agrégateurs autorisés ───────────────────────────
-- L'ancien CHECK ne tolérait que stripe|paypal. On le remplace.
ALTER TABLE public.tenant_payment_providers
  DROP CONSTRAINT IF EXISTS tenant_payment_providers_provider_check;
ALTER TABLE public.tenant_payment_providers
  ADD CONSTRAINT tenant_payment_providers_provider_check
  CHECK (provider IN ('stripe', 'pawapay', 'chariow', 'paypal', 'cinetpay'));

-- ── 2. Colonnes cibles du nouveau moteur ────────────────────────────────────
ALTER TABLE public.tenant_payment_providers
  ADD COLUMN IF NOT EXISTS enabled boolean NOT NULL DEFAULT false;

-- credentials : objet chiffré (format iv:tag:ciphertext) stocké en jsonb sous
-- une clé unique { enc: "<chaîne chiffrée>" }. jsonb (et pas text) pour rester
-- homogène avec le reste du schéma billing et permettre des métadonnées futures.
ALTER TABLE public.tenant_payment_providers
  ADD COLUMN IF NOT EXISTS credentials jsonb;

-- product_map : Chariow → {start, business, entreprise, setup} = product IDs.
ALTER TABLE public.tenant_payment_providers
  ADD COLUMN IF NOT EXISTS product_map jsonb;

-- Traçabilité du dernier test de connexion réel.
ALTER TABLE public.tenant_payment_providers
  ADD COLUMN IF NOT EXISTS last_test_at timestamptz;
ALTER TABLE public.tenant_payment_providers
  ADD COLUMN IF NOT EXISTS last_test_ok boolean;
ALTER TABLE public.tenant_payment_providers
  ADD COLUMN IF NOT EXISTS last_test_message text;

-- Colonnes que l'ancien schéma garantissait, recréées au cas où on est parti
-- du garde-fou CREATE TABLE ci-dessus (env neuf).
ALTER TABLE public.tenant_payment_providers
  ADD COLUMN IF NOT EXISTS mode text;
ALTER TABLE public.tenant_payment_providers
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE public.tenant_payment_providers
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- ── 3. Backfill enabled depuis l'ancien is_active (si la colonne existe) ─────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tenant_payment_providers'
      AND column_name = 'is_active'
  ) THEN
    UPDATE public.tenant_payment_providers
      SET enabled = COALESCE(is_active, false)
      WHERE enabled IS DISTINCT FROM COALESCE(is_active, false);
  END IF;
END $$;

-- ── 4. Index ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS tenant_payment_providers_tenant_provider_idx
  ON public.tenant_payment_providers (tenant_id, provider);
CREATE INDEX IF NOT EXISTS tenant_payment_providers_tenant_enabled_idx
  ON public.tenant_payment_providers (tenant_id, enabled);

-- ── 5. Trigger updated_at ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.tenant_payment_providers_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tenant_payment_providers_set_updated_at
  ON public.tenant_payment_providers;
CREATE TRIGGER tenant_payment_providers_set_updated_at
  BEFORE UPDATE ON public.tenant_payment_providers
  FOR EACH ROW EXECUTE FUNCTION public.tenant_payment_providers_touch_updated_at();

-- ── 6. RLS ──────────────────────────────────────────────────────────────────
-- Modèle calqué sur tenant_payment_providers (20260528190001) /
-- tenant_oauth_providers / pédagogie tenant-scoping : owner|admin actif du
-- tenant via tenant_memberships. On (re)crée les policies idempotemment.
ALTER TABLE public.tenant_payment_providers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_payment_providers_select" ON public.tenant_payment_providers;
CREATE POLICY "tenant_payment_providers_select"
  ON public.tenant_payment_providers
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_memberships
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin')
        AND status = 'active'
    )
  );

DROP POLICY IF EXISTS "tenant_payment_providers_insert" ON public.tenant_payment_providers;
CREATE POLICY "tenant_payment_providers_insert"
  ON public.tenant_payment_providers
  FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_memberships
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin')
        AND status = 'active'
    )
  );

DROP POLICY IF EXISTS "tenant_payment_providers_update" ON public.tenant_payment_providers;
CREATE POLICY "tenant_payment_providers_update"
  ON public.tenant_payment_providers
  FOR UPDATE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_memberships
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin')
        AND status = 'active'
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_memberships
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin')
        AND status = 'active'
    )
  );

DROP POLICY IF EXISTS "tenant_payment_providers_delete" ON public.tenant_payment_providers;
CREATE POLICY "tenant_payment_providers_delete"
  ON public.tenant_payment_providers
  FOR DELETE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_memberships
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin')
        AND status = 'active'
    )
  );

-- Bypass explicite service_role : le moteur de checkout (API NestJS) lit/écrit
-- cette config avec la clé service_role. (La clé service_role contourne déjà
-- la RLS ; cette policy rend l'intention explicite et survit à un éventuel
-- FORCE ROW LEVEL SECURITY futur.)
DROP POLICY IF EXISTS "tenant_payment_providers_service_role" ON public.tenant_payment_providers;
CREATE POLICY "tenant_payment_providers_service_role"
  ON public.tenant_payment_providers
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.tenant_payment_providers IS
  'Config des moyens de paiement par tenant (stripe|pawapay|chariow|paypal|cinetpay). credentials = jsonb CHIFFRÉ AES-256-GCM (crypto.util.ts), jamais en clair. Lu par le moteur de checkout avec fallback env plateforme.';
COMMENT ON COLUMN public.tenant_payment_providers.credentials IS
  'Secrets CHIFFRÉS (AES-256-GCM, format iv:tag:ciphertext) sous { enc: "..." }. Selon provider : stripe={secret_key,webhook_secret}, pawapay={api_token,signing_secret}, chariow={api_key,webhook_secret}.';
COMMENT ON COLUMN public.tenant_payment_providers.product_map IS
  'Chariow : mapping plan → product ID {start, business, entreprise, setup}.';

COMMIT;
