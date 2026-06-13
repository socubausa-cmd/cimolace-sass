-- ─────────────────────────────────────────────────────────────────────────────
-- Activation de l'abonnement FORFAITAIRE zahirwellness
--
-- Forfait UNIQUE 150 €/mois couvrant À LA FOIS MEDOS (clé mdk_) ET mbolo (clé mbk_).
-- Le gating (apps/api/src/auth/api-key.guard.ts) vérifie l'abonnement au niveau
-- TENANT → une seule ligne `billing_subscriptions` active débloque TOUTES les clés
-- et services du tenant. Pas de facturation par service.
--
-- Frais de configuration : 500 € (paiement unique, déjà réglé par zahirwellness).
--
-- Idempotent — rejouable sans effet de bord. Atomique : si quoi que ce soit
-- échoue, toute la migration est annulée (jamais le flag de gating sans abo actif).
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) Le plan forfaitaire dans billing_plans
--    (schéma : key UNIQUE / label / price_cents / currency / billing_cycle / features)
INSERT INTO public.billing_plans
  (key, label, description, price_cents, currency, billing_cycle, features, is_active)
VALUES (
  'zahir-forfait',
  'Forfait Cimolace — MEDOS + Mbolo',
  'Abonnement forfaitaire mensuel couvrant les services MEDOS et la boutique Mbolo (accès API tenant).',
  15000, 'EUR', 'monthly',
  '{"medos": true, "mbolo": true, "forfait": true}'::jsonb,
  true
)
ON CONFLICT (key) DO UPDATE SET
  label         = EXCLUDED.label,
  description   = EXCLUDED.description,
  price_cents   = EXCLUDED.price_cents,
  currency      = EXCLUDED.currency,
  billing_cycle = EXCLUDED.billing_cycle,
  features      = EXCLUDED.features,
  is_active     = true;

-- 2) Le forfait est lié au TENANT (services), pas à un utilisateur → user_id nullable.
--    Rétro-compatible : les lignes existantes gardent leur user_id ; seules les
--    futures (abonnements plateforme provisionnés par admin) peuvent l'omettre.
--    No-op si déjà nullable.
ALTER TABLE public.billing_subscriptions ALTER COLUMN user_id DROP NOT NULL;

-- 3) Créer l'abonnement actif pour zahirwellness (si pas déjà actif), puis activer
--    le gating sur le tenant. current_period_end = NULL = actif sans échéance
--    (bootstrap) : aucun risque de 402 accidentel avant que le webhook Stripe ne
--    prenne le relais des renouvellements et ne pose les vraies dates de période.
DO $$
DECLARE
  v_tenant_id UUID;
  v_has_active BOOLEAN;
BEGIN
  SELECT id INTO v_tenant_id FROM public.tenants WHERE slug = 'zahirwellness' LIMIT 1;
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Tenant zahirwellness introuvable — migration annulée.';
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.billing_subscriptions
    WHERE tenant_id = v_tenant_id AND status = 'active'
  ) INTO v_has_active;

  IF NOT v_has_active THEN
    INSERT INTO public.billing_subscriptions (
      tenant_id, plan_id, provider, status,
      amount_cents, currency,
      current_period_start, current_period_end, metadata
    )
    VALUES (
      v_tenant_id, 'zahir-forfait', 'stripe', 'active',
      15000, 'EUR',
      now(), NULL,
      '{"forfait": true, "covers": ["medos", "mbolo"], "setup_paid_eur": 500, "bootstrap": true}'::jsonb
    );
    RAISE NOTICE 'Abonnement forfait 150€/mois créé pour zahirwellness (tenant %).', v_tenant_id;
  ELSE
    RAISE NOTICE 'zahirwellness a déjà un abonnement actif — insertion ignorée.';
  END IF;

  -- Activer le gating sur le tenant (deep-merge metadata, préserve branding & co)
  UPDATE public.tenants
  SET metadata = COALESCE(metadata, '{}'::jsonb)
                 || jsonb_build_object(
                      'billing',
                      COALESCE(metadata->'billing', '{}'::jsonb) || '{"api_gating": true}'::jsonb
                    ),
      updated_at = now()
  WHERE id = v_tenant_id;
  RAISE NOTICE 'Gating abonnement ACTIVÉ pour zahirwellness (metadata.billing.api_gating = true).';
END $$;

-- 4) Vérification (à exécuter manuellement après la migration) :
-- SELECT t.slug,
--        t.metadata->'billing' AS billing_flags,
--        s.status, s.plan_id, s.amount_cents, s.currency, s.current_period_end
-- FROM public.tenants t
-- LEFT JOIN public.billing_subscriptions s ON s.tenant_id = t.id
-- WHERE t.slug = 'zahirwellness';
