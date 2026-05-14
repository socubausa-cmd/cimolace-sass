#!/bin/bash
# ============================================================================
# deploy-public-vercel.sh — Déploie le public-site Next.js sur Vercel
# Usage : bash scripts/deploy-public-vercel.sh [--prod]
# ============================================================================
set -euo pipefail

ENV="${1:-staging}"
if [ "$ENV" = "--prod" ]; then
  ENV="production"
  VERCEL_ARGS="--prod"
else
  VERCEL_ARGS=""
fi

echo "🚀 Déploiement PUBLIC SITE Next.js sur Vercel — $ENV"
echo ""

# ── 1. Vérification Vercel CLI ──────────────────────────────────────────────
if ! command -v vercel &>/dev/null; then
  echo "📦 Installation Vercel CLI..."
  npm i -g vercel
fi

# ── 2. Déploiement ──────────────────────────────────────────────────────────
echo "🔄 Déploiement..."
cd apps/public-site

vercel \
  --cwd . \
  $VERCEL_ARGS \
  --build-env NEXT_PUBLIC_API_URL=https://api.staging.cimolace.com \
  --build-env NEXT_PUBLIC_SUPABASE_URL="$SUPABASE_URL_STAGING" \
  --build-env NEXT_PUBLIC_SUPABASE_ANON_KEY="$SUPABASE_ANON_KEY_STAGING" \
  --confirm

cd ../..

echo ""
echo "✅ Public site déployé"
echo "   URL staging : https://staging.cimolace.com"
echo ""
