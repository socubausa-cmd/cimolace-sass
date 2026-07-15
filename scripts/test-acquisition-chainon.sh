#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Test E2E du chaînon acquisition→provisioning (branche feat/funnel-provisioning).
# À lancer APRÈS déploiement Railway + config webhook Stripe TEST.
#
#   ./test-acquisition-chainon.sh checkout   → démarre l'achat, affiche l'URL Stripe
#   ./test-acquisition-chainon.sh verify     → vérifie que le tenant a été provisionné
#   ./test-acquisition-chainon.sh cleanup    → supprime le tenant de test
#
# ⚠️ SÉCURITÉ : vérifie que Railway STRIPE_SECRET_KEY = sk_test_… (JAMAIS sk_live)
#    avant de tester — sinon tu crées une vraie session de paiement.
# ─────────────────────────────────────────────────────────────────────────────
set -u
API_BASE="${API_BASE:-https://api.cimolace.space}"
PLAN="${PLAN:-cimolace-medos-solo}"
EMAIL="${EMAIL:-test-acq-chainon@example.com}"
ORG="${ORG:-Cabinet Test Chainon}"
CMD="${1:-checkout}"

case "$CMD" in
  checkout)
    echo "→ POST $API_BASE/billing/acquisition/checkout (plan=$PLAN, email=$EMAIL)"
    curl -sS -X POST "$API_BASE/billing/acquisition/checkout" \
      -H 'Content-Type: application/json' \
      -d "{\"email\":\"$EMAIL\",\"planKey\":\"$PLAN\",\"orgName\":\"$ORG\",\"intent\":\"new_tenant\"}"
    echo ""
    echo ""
    echo "→ Ouvre l'URL renvoyée (champ \"url\"), paie avec la carte TEST Stripe :"
    echo "    4242 4242 4242 4242 · date future · CVC quelconque"
    echo "  Puis : ./test-acquisition-chainon.sh verify"
    ;;

  verify)
    [ -z "${DATABASE_URL:-}" ] && { echo "source ton .env.production d'abord (DATABASE_URL)"; exit 1; }
    echo "== TENANT créé pour $EMAIL ? =="
    psql "$DATABASE_URL" -tAF' | ' -c "
      SELECT t.slug, t.name, t.infrastructure_type, t.metadata->>'hosting_mode' AS hosting_mode, t.status
      FROM tenants t WHERE t.metadata->>'created_via'='acquisition'
      ORDER BY t.created_at DESC LIMIT 3;"
    echo ""
    echo "== ABONNEMENT actif + lié au subscription Stripe ? =="
    psql "$DATABASE_URL" -tAF' | ' -c "
      SELECT bs.plan_id, bs.status, bs.provider,
             (bs.provider_subscription_id IS NOT NULL) AS lie_stripe,
             (bs.amount_cents/100.0) AS eur, bs.currency,
             bs.current_period_end::date AS echeance
      FROM billing_subscriptions bs
      JOIN tenants t ON t.id=bs.tenant_id
      WHERE t.metadata->>'created_via'='acquisition' AND (bs.metadata->>'acquisition')='true'
      ORDER BY bs.created_at DESC LIMIT 3;"
    echo ""
    echo "== MOTEURS provisionnés (tenant_services) ? =="
    psql "$DATABASE_URL" -tAF' | ' -c "
      SELECT t.slug, count(*) AS n_moteurs, string_agg(ts.service_key, ',' ORDER BY ts.service_key) AS moteurs
      FROM tenant_services ts JOIN tenants t ON t.id=ts.tenant_id
      WHERE t.metadata->>'created_via'='acquisition' AND ts.active
      GROUP BY t.slug ORDER BY max(ts.created_at) DESC LIMIT 3;"
    echo ""
    echo "== MEMBERSHIP owner ? =="
    psql "$DATABASE_URL" -tAF' | ' -c "
      SELECT t.slug, tm.role, tm.status
      FROM tenant_memberships tm JOIN tenants t ON t.id=tm.tenant_id
      WHERE t.metadata->>'created_via'='acquisition' AND tm.role='owner'
      ORDER BY tm.created_at DESC LIMIT 3;"
    ;;

  cleanup)
    [ -z "${DATABASE_URL:-}" ] && { echo "source ton .env.production d'abord"; exit 1; }
    echo "⚠️  Supprime les tenants de test (created_via=acquisition). Ctrl-C pour annuler."
    read -r _
    psql "$DATABASE_URL" -c "
      WITH victims AS (SELECT id FROM tenants WHERE metadata->>'created_via'='acquisition')
      DELETE FROM billing_subscriptions WHERE tenant_id IN (SELECT id FROM victims);"
    psql "$DATABASE_URL" -c "
      WITH victims AS (SELECT id FROM tenants WHERE metadata->>'created_via'='acquisition')
      DELETE FROM tenant_services WHERE tenant_id IN (SELECT id FROM victims);"
    psql "$DATABASE_URL" -c "
      WITH victims AS (SELECT id FROM tenants WHERE metadata->>'created_via'='acquisition')
      DELETE FROM tenant_memberships WHERE tenant_id IN (SELECT id FROM victims);"
    psql "$DATABASE_URL" -c "DELETE FROM tenants WHERE metadata->>'created_via'='acquisition';"
    echo "✓ nettoyé (les users auth restent — les supprimer via le dashboard Supabase si besoin)"
    ;;

  *) echo "usage: $0 {checkout|verify|cleanup}"; exit 1 ;;
esac
