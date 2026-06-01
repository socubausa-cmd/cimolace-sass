#!/bin/bash
# ============================================================================
# deploy-app-vercel.sh — Déploie l'app React/Vite sur Vercel
# Usage : bash scripts/deploy-app-vercel.sh [--prod]
# Prérequis staging : .env.staging correctement rempli
# Prérequis prod    : .env.production correctement rempli
# ============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(dirname "$SCRIPT_DIR")"

ENV="${1:-staging}"
VERCEL_ARGS=""
DEFAULT_API_URL="https://api.staging.cimolace.com"
DEFAULT_APP_URL="https://app.staging.cimolace.com"
ENV_FILE="$ROOT/.env.staging"
if [ "$ENV" = "--prod" ]; then
  ENV="production"
  VERCEL_ARGS="--prod"
  ENV_FILE="$ROOT/.env.production"
  DEFAULT_API_URL="https://api.cimolace.space"
  DEFAULT_APP_URL="https://cimolace.space"
fi

# ── 0. Charger les variables ───────────────────────────────────────────────
if [ -f "$ENV_FILE" ]; then
  set -a; source "$ENV_FILE"; set +a
else
  echo "❌ Fichier $ENV_FILE introuvable."
  if [ "$ENV" = "production" ]; then
    echo "   cp .env.production.example .env.production"
  else
    echo "   cp .env.staging.example .env.staging"
  fi
  echo "   puis remplis les valeurs manquantes."
  exit 1
fi

# ── 0.1 Valider les variables requises ─────────────────────────────────────
MISSING=""
for VAR in SUPABASE_URL SUPABASE_ANON_KEY; do
  if [ -z "${!VAR:-}" ] || [ "${!VAR}" = "replace_me" ]; then MISSING="$MISSING $VAR"; fi
done
if [ -n "$MISSING" ]; then
  echo "❌ Variables manquantes ou placeholder dans $ENV_FILE :"
  for V in $MISSING; do echo "   - $V"; done
  exit 1
fi

echo "🚀 Déploiement APP React/Vite sur Vercel — $ENV"
echo ""

# ── 1. Vérification Vercel CLI ─────────────────────────────────────────────
if ! command -v vercel &>/dev/null; then
  echo "📦 Installation Vercel CLI..."
  npm i -g vercel
fi

# ── 2. Déploiement ─────────────────────────────────────────────────────────
echo "🔄 Déploiement..."
cd "$ROOT/apps/app"

vercel \
  --cwd . \
  $VERCEL_ARGS \
  --build-env VITE_API_URL="${API_URL:-$DEFAULT_API_URL}" \
  --build-env VITE_SUPABASE_URL="$SUPABASE_URL" \
  --build-env VITE_SUPABASE_ANON_KEY="$SUPABASE_ANON_KEY" \
  --build-env VITE_LIVEKIT_URL="${LIVEKIT_URL:-}" \
  --build-env VITE_APP_ENV="$ENV" \
  --confirm

echo ""
echo "✅ App déployée"
echo "   URL : ${APP_URL:-$DEFAULT_APP_URL}"
