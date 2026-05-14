#!/bin/bash
# ============================================================================
# deploy-public-vercel.sh — Déploie le public-site Next.js sur Vercel
# Usage : bash scripts/deploy-public-vercel.sh [--prod]
# Prérequis : .env.staging correctement rempli
# ============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$ROOT/.env.staging"

# ── 0. Charger les variables ───────────────────────────────────────────────
if [ -f "$ENV_FILE" ]; then
  set -a; source "$ENV_FILE"; set +a
else
  echo "❌ Fichier $ENV_FILE introuvable."
  echo "   cp .env.staging.example .env.staging"
  echo "   puis remplis les valeurs manquantes."
  exit 1
fi

# ── 0.1 Valider ────────────────────────────────────────────────────────────
for VAR in SUPABASE_URL SUPABASE_ANON_KEY; do
  if [ -z "${!VAR:-}" ] || [ "${!VAR}" = "replace_me" ]; then MISSING="$MISSING $VAR"; fi
done
if [ -n "${MISSING:-}" ]; then
  echo "❌ Variables manquantes dans .env.staging :${MISSING:-}"
  exit 1
fi

ENV="${1:-staging}"
VERCEL_ARGS=""
if [ "$ENV" = "--prod" ]; then ENV="production"; VERCEL_ARGS="--prod"; fi

echo "🚀 Déploiement PUBLIC SITE Next.js sur Vercel — $ENV"

if ! command -v vercel &>/dev/null; then
  echo "📦 Installation Vercel CLI..."; npm i -g vercel
fi

cd "$ROOT/apps/public-site"

vercel \
  --cwd . \
  $VERCEL_ARGS \
  --build-env NEXT_PUBLIC_API_URL="${API_URL:-https://api.staging.cimolace.com}" \
  --build-env NEXT_PUBLIC_SUPABASE_URL="$SUPABASE_URL" \
  --build-env NEXT_PUBLIC_SUPABASE_ANON_KEY="$SUPABASE_ANON_KEY" \
  --confirm

echo ""
echo "✅ Public site déployé"
echo "   URL : https://staging.cimolace.com"
