#!/bin/bash
# ============================================================================
# deploy-app-vercel.sh — Déploie l'app React/Vite sur Vercel
# Usage : bash scripts/deploy-app-vercel.sh [--prod]
# ============================================================================
set -euo pipefail

ENV="${1:-staging}"
if [ "$ENV" = "--prod" ]; then
  ENV="production"
  VERCEL_ARGS="--prod"
else
  VERCEL_ARGS=""
fi

echo "🚀 Déploiement APP React/Vite sur Vercel — $ENV"
echo ""

# ── 1. Vérification Vercel CLI ──────────────────────────────────────────────
if ! command -v vercel &>/dev/null; then
  echo "📦 Installation Vercel CLI..."
  npm i -g vercel
fi

# ── 2. Déploiement ──────────────────────────────────────────────────────────
echo "🔄 Déploiement..."
cd apps/app

vercel \
  --cwd . \
  $VERCEL_ARGS \
  --build-env VITE_API_URL=https://api.staging.cimolace.com \
  --build-env VITE_SUPABASE_URL="$SUPABASE_URL_STAGING" \
  --build-env VITE_SUPABASE_ANON_KEY="$SUPABASE_ANON_KEY_STAGING" \
  --build-env VITE_LIVEKIT_URL="$LIVEKIT_URL" \
  --confirm

cd ../..

echo ""
echo "✅ App déployée"
echo "   URL staging : https://app.staging.cimolace.com"
echo ""
