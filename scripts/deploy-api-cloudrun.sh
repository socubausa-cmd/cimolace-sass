#!/bin/bash
# ============================================================================
# deploy-api-cloudrun.sh — Déploie l'API NestJS sur Google Cloud Run
# Usage : bash scripts/deploy-api-cloudrun.sh [--prod]
# Prérequis staging : .env.staging correctement rempli
# Prérequis prod    : .env.production correctement rempli
# ============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(dirname "$SCRIPT_DIR")"
ENV="${1:-staging}"
ENV_FILE="$ROOT/.env.staging"
DEFAULT_APP_URL="https://app.staging.cimolace.com"
DEFAULT_PUBLIC_SITE_URL="https://staging.cimolace.com"
DEFAULT_API_URL="https://api.staging.cimolace.com"
DEFAULT_CORS_ALLOWED_ORIGINS="$DEFAULT_APP_URL,$DEFAULT_PUBLIC_SITE_URL"
SERVICE_NAME="isna-api"

if [ "$ENV" = "--prod" ]; then
  ENV="production"
  ENV_FILE="$ROOT/.env.production"
  DEFAULT_APP_URL="https://cimolace.space"
  DEFAULT_PUBLIC_SITE_URL="https://cimolace.space"
  DEFAULT_API_URL="https://api.cimolace.space"
  DEFAULT_CORS_ALLOWED_ORIGINS="https://cimolace.space,https://www.cimolace.space"
  SERVICE_NAME="cimolace-api"
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
for VAR in SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY LIVEKIT_API_KEY LIVEKIT_API_SECRET LIVEKIT_URL; do
  if [ -z "${!VAR:-}" ] || [ "${!VAR}" = "replace_me" ]; then MISSING="$MISSING $VAR"; fi
done
if [ -n "$MISSING" ]; then
  echo "❌ Variables manquantes ou placeholder dans $ENV_FILE :"
  for V in $MISSING; do echo "   - $V"; done
  exit 1
fi

PROJECT_ID="${GCLOUD_PROJECT:-cimolace-$ENV}"
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

gcloud config set project "$PROJECT_ID" || {
  echo "❌ Projet $PROJECT_ID introuvable."
  echo "   gcloud projects create $PROJECT_ID --name='Cimolace $ENV'"
  echo "   puis active le billing : https://console.cloud.google.com/billing"
  exit 1
}

# ── 2. Activer les APIs ────────────────────────────────────────────────────
gcloud services enable cloudbuild.googleapis.com run.googleapis.com containerregistry.googleapis.com --quiet || true

# ── 3. Build & Push Docker ─────────────────────────────────────────────────
echo "📦 Build image Docker (Dockerfile.full)..."
# Dockerfile.full copies the entire src/ — Dockerfile is a minimal healthcheck-only stub
gcloud builds submit \
  --config "$ROOT/cloudbuild.api.yaml" \
  --substitutions "_IMAGE=$IMAGE" \
  --timeout=600s \
  --quiet \
  "$ROOT"

# ── 4. Déployer Cloud Run ─────────────────────────────────────────────────
echo "🔄 Déploiement sur Cloud Run..."

gcloud run deploy "$SERVICE_NAME" \
  --image "$IMAGE" \
  --platform managed \
  --region "$REGION" \
  --port 8080 \
  --memory 1Gi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 5 \
  --timeout 900 \
  --concurrency 80 \
  --allow-unauthenticated \
  --set-env-vars "^|||^\
NODE_ENV=$ENV|||\
SUPABASE_URL=$SUPABASE_URL|||\
SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY|||\
SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY|||\
SUPABASE_JWT_SECRET=$SUPABASE_JWT_SECRET|||\
LIVEKIT_URL=$LIVEKIT_URL|||\
LIVEKIT_API_KEY=$LIVEKIT_API_KEY|||\
LIVEKIT_API_SECRET=$LIVEKIT_API_SECRET|||\
STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY:-replace_me}|||\
STRIPE_BILLING_WEBHOOK_SECRET=${STRIPE_BILLING_WEBHOOK_SECRET:-replace_me}|||\
DEEPSEEK_API_KEY=${DEEPSEEK_API_KEY:-replace_me}|||\
OPENAI_API_KEY=${OPENAI_API_KEY:-replace_me}|||\
ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY:-replace_me}|||\
RESEND_API_KEY=${RESEND_API_KEY:-replace_me}|||\
RESEND_FROM=${RESEND_FROM:-noreply@cimolace.space}|||\
CHARIOW_API_KEY=${CHARIOW_API_KEY:-replace_me}|||\
CINETPAY_API_KEY=${CINETPAY_API_KEY:-replace_me}|||\
CINETPAY_SITE_ID=${CINETPAY_SITE_ID:-replace_me}|||\
APP_URL=${APP_URL:-$DEFAULT_APP_URL}|||\
PUBLIC_SITE_URL=${PUBLIC_SITE_URL:-$DEFAULT_PUBLIC_SITE_URL}|||\
API_URL=${API_URL:-$DEFAULT_API_URL}|||\
CORS_ALLOWED_ORIGINS=${CORS_ALLOWED_ORIGINS:-$DEFAULT_CORS_ALLOWED_ORIGINS}|||\
MEDOS_EMBED_JWT_SECRET=${MEDOS_EMBED_JWT_SECRET:-replace_me}" \
  --quiet

# ── 5. URL du service ─────────────────────────────────────────────────────
URL=$(gcloud run services describe "$SERVICE_NAME" --region "$REGION" --format='value(status.url)')
echo ""
echo "✅ Déploiement terminé"
echo "   URL : $URL"
echo "   Health : $URL/health"
echo ""
echo "   curl $URL/health"
