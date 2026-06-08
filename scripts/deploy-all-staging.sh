#!/bin/bash
# ============================================================================
# deploy-all-staging.sh — Déploie TOUTE la stack staging en une commande
# Usage : bash scripts/deploy-all-staging.sh
# Prérequis : .env.staging correctement rempli
# ============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$ROOT/.env.staging"

# ── Charger les variables ──────────────────────────────────────────────────
if [ -f "$ENV_FILE" ]; then
  set -a; source "$ENV_FILE"; set +a
else
  echo "❌ Fichier $ENV_FILE introuvable."
  echo "   cp .env.staging.example .env.staging"
  echo "   puis remplis les valeurs manquantes."
  exit 1
fi

echo "════════════════════════════════════════════════════════════════════════"
echo "  DÉPLOIEMENT COMPLET — ISNA V2 STAGING"
echo "════════════════════════════════════════════════════════════════════════"
echo ""

# ── 1. Build local (typecheck all apps) ──────────────────────────────────
echo "📋 [1/4] Typecheck + Build local"
cd "$ROOT/apps/api"          && npx tsc --noEmit -p tsconfig.json && npx nest build      && cd "$ROOT"
cd "$ROOT/apps/app"          && npx tsc --noEmit -p tsconfig.json && npm run build       && cd "$ROOT"
cd "$ROOT/apps/patient-portal" && npx tsc -b && cd "$ROOT"
cd "$ROOT/apps/med-app"      && npx tsc -b                                               && cd "$ROOT"
echo "   ✅ Build OK"
echo ""

# ── 2. API Cloud Run ──────────────────────────────────────────────────────
echo "📋 [2/4] Déploiement API sur Cloud Run"
bash "$SCRIPT_DIR/deploy-api-cloudrun.sh"
echo ""

# ── 3. Frontends Vercel ────────────────────────────────────────────────────
echo "📋 [3/4] Déploiement App + Public sur Vercel"
bash "$SCRIPT_DIR/deploy-app-vercel.sh"
bash "$SCRIPT_DIR/deploy-public-vercel.sh"
echo ""

# ── 4. Portails Vercel ────────────────────────────────────────────────────
echo "📋 [4/4] Déploiement Patient Portal + Med App sur Vercel"
if ! command -v vercel &>/dev/null; then npm i -g vercel; fi

cd "$ROOT/apps/patient-portal"
vercel --cwd . \
  --build-env VITE_API_URL="${API_URL:-https://api.staging.cimolace.com}" \
  --build-env VITE_SUPABASE_URL="$SUPABASE_URL" \
  --build-env VITE_SUPABASE_ANON_KEY="$SUPABASE_ANON_KEY" \
  --confirm
cd "$ROOT"

cd "$ROOT/apps/med-app"
vercel --cwd . \
  --build-env VITE_API_URL="${API_URL:-https://api.staging.cimolace.com}" \
  --build-env VITE_SUPABASE_URL="$SUPABASE_URL" \
  --build-env VITE_SUPABASE_ANON_KEY="$SUPABASE_ANON_KEY" \
  --confirm
cd "$ROOT"
echo ""

echo "════════════════════════════════════════════════════════════════════════"
echo "  ✅ DÉPLOIEMENT STAGING TERMINÉ"
echo ""
echo "  Vérifier :"
echo "    curl ${API_URL:-https://api.staging.cimolace.com}/health"
echo "    open ${APP_URL:-https://app.staging.cimolace.com}"
echo "    open ${PUBLIC_SITE_URL:-https://staging.cimolace.com}"
echo "════════════════════════════════════════════════════════════════════════"
