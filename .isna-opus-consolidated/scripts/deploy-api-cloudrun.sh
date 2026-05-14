#!/bin/bash
# ============================================================================
# deploy-api-cloudrun.sh — Déploie l'API NestJS sur Google Cloud Run
# Usage : bash scripts/deploy-api-cloudrun.sh [--prod]
# ============================================================================
set -euo pipefail

ENV="${1:-staging}"
if [ "$ENV" = "--prod" ]; then
  ENV="production"
fi

PROJECT_ID="cimolace-$ENV"
SERVICE_NAME="isna-api"
REGION="europe-west1"
IMAGE="gcr.io/$PROJECT_ID/$SERVICE_NAME:$(date +%Y%m%d-%H%M%S)"

echo "🚀 Déploiement API NestJS sur Cloud Run — $ENV"
echo "   Projet  : $PROJECT_ID"
echo "   Service : $SERVICE_NAME"
echo "   Région  : $REGION"
echo ""

# ── 1. Vérification gcloud ──────────────────────────────────────────────────
if ! command -v gcloud &>/dev/null; then
  echo "❌ gcloud CLI requis : https://cloud.google.com/sdk/docs/install"
  exit 1
fi

gcloud config set project "$PROJECT_ID" 2>/dev/null || {
  echo "❌ Projet $PROJECT_ID introuvable. Vérifie : gcloud projects list"
  exit 1
}

# ── 2. Activer les APIs nécessaires ─────────────────────────────────────────
gcloud services enable cloudbuild.googleapis.com run.googleapis.com containerregistry.googleapis.com --quiet 2>/dev/null || true

# ── 3. Build & Push image Docker ────────────────────────────────────────────
echo "📦 Build image Docker..."
gcloud builds submit \
  --tag "$IMAGE" \
  --timeout=600s \
  --quiet

# ── 4. Déployer sur Cloud Run ───────────────────────────────────────────────
echo "🔄 Déploiement sur Cloud Run..."

# Récupérer les secrets Supabase depuis les variables d'environnement locales
# (ou depuis Google Secret Manager si configuré)
SUPABASE_URL="${SUPABASE_URL_STAGING:-${SUPABASE_URL:-}}"
SUPABASE_SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY_STAGING:-${SUPABASE_SERVICE_ROLE_KEY:-}}"

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
APP_URL=https://app.staging.cimolace.com,\
PUBLIC_SITE_URL=https://staging.cimolace.com,\
API_URL=https://api.staging.cimolace.com" \
  --quiet

# ── 5. URL du service ───────────────────────────────────────────────────────
URL=$(gcloud run services describe "$SERVICE_NAME" --region "$REGION" --format='value(status.url)' 2>/dev/null)
echo ""
echo "✅ Déploiement terminé"
echo "   URL : $URL"
echo "   Health : $URL/health"
echo ""
echo "⚠️  Pense à vérifier :"
echo "   curl $URL/health"
echo ""
echo "Pour mapper à un domaine personnalisé :"
echo "   gcloud run domain-mappings create --service=$SERVICE_NAME --domain=api.staging.cimolace.com --region=$REGION"
