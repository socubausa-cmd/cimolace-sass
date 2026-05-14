#!/bin/bash
# ============================================================================
# deploy-api-cloudrun.sh — Déploie l'API NestJS sur Google Cloud Run
# Usage : bash scripts/deploy-api-cloudrun.sh [--prod]
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
for VAR in SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY LIVEKIT_API_KEY LIVEKIT_API_SECRET LIVEKIT_URL; do
  if [ -z "${!VAR:-}" ] || [ "${!VAR}" = "replace_me" ]; then MISSING="$MISSING $VAR"; fi
done
if [ -n "$MISSING" ]; then
  echo "❌ Variables manquantes ou placeholder dans .env.staging :"
  for V in $MISSING; do echo "   - $V"; done
  exit 1
fi

ENV="${1:-staging}"
if [ "$ENV" = "--prod" ]; then ENV="production"; fi

PROJECT_ID="${GCLOUD_PROJECT:-cimolace-$ENV}"
SERVICE_NAME="isna-api"
REGION="${GCLOUD_REGION:-europe-west1}"
IMAGE="gcr.io/$PROJECT_ID/$SERVICE_NAME:$(date +%Y%m%d-%H%M%S)"

echo "🚀 Déploiement API NestJS sur Cloud Run — $ENV"
echo "   Projet  : $PROJECT_ID"
echo "   Service : $SERVICE_NAME"
echo "   Région  : $REGION"
echo ""

# ── 1. Vérification gcloud ─────────────────────────────────────────────────
if ! command -v gcloud &>/dev/null; then
  echo "❌ gcloud CLI requis : https://cloud.google.com/sdk/docs/install"
  exit 1
fi

gcloud config set project "$PROJECT_ID" 2>/dev/null || {
  echo "❌ Projet $PROJECT_ID introuvable."
  echo "   gcloud projects create $PROJECT_ID --name='Cimolace $ENV'"
  echo "   puis active le billing : https://console.cloud.google.com/billing"
  exit 1
}

# ── 2. Activer les APIs ────────────────────────────────────────────────────
gcloud services enable cloudbuild.googleapis.com run.googleapis.com containerregistry.googleapis.com --quiet 2>/dev/null || true

# ── 3. Build & Push Docker ─────────────────────────────────────────────────
echo "📦 Build image Docker..."
gcloud builds submit --tag "$IMAGE" --timeout=600s --quiet

# ── 4. Déployer Cloud Run ─────────────────────────────────────────────────
echo "🔄 Déploiement sur Cloud Run..."

gcloud run deploy "$SERVICE_NAME" \
  --image "$IMAGE" \
  --platform managed \
  --region "$REGION" \
  --port 4000 \
  --memory 1Gi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 5 \
  --timeout 900 \
  --concurrency 80 \
  --allow-unauthenticated \
  --set-env-vars "\
NODE_ENV=$ENV,\
PORT=4000,\
SUPABASE_URL=$SUPABASE_URL,\
SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY,\
SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY,\
SUPABASE_JWT_SECRET=$SUPABASE_JWT_SECRET,\
LIVEKIT_URL=$LIVEKIT_URL,\
LIVEKIT_API_KEY=$LIVEKIT_API_KEY,\
LIVEKIT_API_SECRET=$LIVEKIT_API_SECRET,\
STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY:-replace_me},\
STRIPE_BILLING_WEBHOOK_SECRET=${STRIPE_BILLING_WEBHOOK_SECRET:-replace_me},\
DEEPSEEK_API_KEY=${DEEPSEEK_API_KEY:-replace_me},\
OPENAI_API_KEY=${OPENAI_API_KEY:-replace_me},\
ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY:-replace_me},\
RESEND_API_KEY=${RESEND_API_KEY:-replace_me},\
RESEND_FROM=${RESEND_FROM:-noreply@staging.cimolace.com},\
CHARIOW_API_KEY=${CHARIOW_API_KEY:-replace_me},\
CINETPAY_API_KEY=${CINETPAY_API_KEY:-replace_me},\
CINETPAY_SITE_ID=${CINETPAY_SITE_ID:-replace_me},\
APP_URL=${APP_URL:-https://app.staging.cimolace.com},\
PUBLIC_SITE_URL=${PUBLIC_SITE_URL:-https://staging.cimolace.com},\
API_URL=${API_URL:-https://api.staging.cimolace.com}" \
  --quiet

# ── 5. URL du service ─────────────────────────────────────────────────────
URL=$(gcloud run services describe "$SERVICE_NAME" --region "$REGION" --format='value(status.url)' 2>/dev/null)
echo ""
echo "✅ Déploiement terminé"
echo "   URL : $URL"
echo "   Health : $URL/health"
echo ""
echo "   curl $URL/health"
