#!/bin/bash
# ============================================================================
# deploy-all-staging.sh — Déploie TOUTE la stack staging en une commande
# Usage : bash scripts/deploy-all-staging.sh
# ============================================================================
set -euo pipefail

echo "════════════════════════════════════════════════════════════════════════"
echo "  DÉPLOIEMENT COMPLET — ISNA V2 STAGING"
echo "════════════════════════════════════════════════════════════════════════"
echo ""

# ── 1. Build local ──────────────────────────────────────────────────────────
echo "📋 [1/4] Typecheck + Build local"
cd apps/api && npx tsc --noEmit -p tsconfig.json && npx nest build && cd ../..
cd apps/app && npx tsc --noEmit && npm run build && cd ../..
echo "   ✅ Build OK"
echo ""

# ── 2. API Cloud Run ────────────────────────────────────────────────────────
echo "📋 [2/4] Déploiement API sur Cloud Run"
bash scripts/deploy-api-cloudrun.sh
echo ""

# ── 3. App Vercel ───────────────────────────────────────────────────────────
echo "📋 [3/4] Déploiement App React/Vite sur Vercel"
bash scripts/deploy-app-vercel.sh
echo ""

# ── 4. Public Site Vercel ───────────────────────────────────────────────────
echo "📋 [4/4] Déploiement Public Site Next.js sur Vercel"
bash scripts/deploy-public-vercel.sh
echo ""

echo "════════════════════════════════════════════════════════════════════════"
echo "  ✅ DÉPLOIEMENT STAGING TERMINÉ"
echo ""
echo "  URLs :"
echo "    API    : https://api.staging.cimolace.com/health"
echo "    App    : https://app.staging.cimolace.com"
echo "    Public : https://staging.cimolace.com"
echo ""
echo "  Vérifier :"
echo "    curl https://api.staging.cimolace.com/health"
echo "    curl -H 'X-Tenant-Slug: isna' https://api.staging.cimolace.com/tenants/current"
echo "════════════════════════════════════════════════════════════════════════"
