#!/bin/bash
# ============================================================================
# deploy-app-vercel.sh — Déploie l'app React/Vite sur Vercel
# Usage : bash scripts/deploy-app-vercel.sh [--prod]
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

# ── 0.1 Valider les variables requises ─────────────────────────────────────
MISSING=""
for VAR in SUPABASE_URL SUPABASE_ANON_KEY; do
  if [ -z "${!VAR:-}" ] || [ "${!VAR}" = "replace_me" ]; then MISSING="$MISSING $VAR"; fi
done
if [ -n "$MISSING" ]; then
  echo "❌ Variables manquantes ou placeholder dans .env.staging :"
  for V in $MISSING; do echo "   - $V"; done
  exit 1
fi

ENV="${1:-staging}"
VERCEL_ARGS=""
if [ "$ENV" = "--prod" ]; then ENV="production"; VERCEL_ARGS="--prod"; fi

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
  --build-env VITE_API_URL="${API_URL:-https://api.staging.cimolace.com}" \
  --build-env VITE_SUPABASE_URL="$SUPABASE_URL" \
  --build-env VITE_SUPABASE_ANON_KEY="$SUPABASE_ANON_KEY" \
  --build-env VITE_LIVEKIT_URL="${LIVEKIT_URL:-}" \
  --confirm

echo ""
echo "✅ App déployée"
echo "   URL : https://app.staging.cimolace.com"
