#!/bin/bash
# ============================================================================
# Script de déploiement staging — ISNA/Cimolace V2
# Usage: bash scripts/deploy-staging.sh
# ============================================================================
set -e

echo "🚀 Déploiement Staging ISNA V2"
echo "================================"

# ── 1. Vérification prérequis ──────────────────────────────────────────────
command -v node >/dev/null 2>&1 || { echo "❌ Node.js requis"; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "❌ npm requis"; exit 1; }

# ── 2. Variables d'environnement ───────────────────────────────────────────
if [ ! -f .env.staging ]; then
  echo "📝 Création .env.staging..."
  cat > .env.staging << 'EOF'
# ── Staging Environment ─────────────────────────────────────────────────────
NODE_ENV=staging
APP_ENV=staging
PORT=4000

# ── URLs ────────────────────────────────────────────────────────────────────
PUBLIC_SITE_URL=https://staging.cimolace.com
APP_URL=https://app.staging.cimolace.com
API_URL=https://api.staging.cimolace.com

# ── Supabase (STAGING — projet dédié) ───────────────────────────────────────
SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# ── LiveKit ─────────────────────────────────────────────────────────────────
LIVEKIT_URL=wss://staging-xxxxx.livekit.cloud
LIVEKIT_API_KEY=APIxxxxxxxx
LIVEKIT_API_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# ── Stripe (TEST MODE) ──────────────────────────────────────────────────────
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxxxxx
STRIPE_BILLING_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxx

# ── Paiements Africains (TEST) ──────────────────────────────────────────────
CHARIOW_API_KEY=test_xxxxxxxx
CHARIOW_WEBHOOK_SECRET=test_whsec_xxxxxxxx
CINETPAY_API_KEY=test_xxxxxxxx
CINETPAY_SITE_ID=123456

# ── IA ──────────────────────────────────────────────────────────────────────
DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxxxxx
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxx
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxx

# ── Email ───────────────────────────────────────────────────────────────────
RESEND_API_KEY=re_xxxxxxxx
RESEND_FROM=noreply@staging.cimolace.com

# ── Feature Flags ───────────────────────────────────────────────────────────
USE_API_V2_MARKETING=true
MEDOS_ENABLED=true
EOF
  echo "✅ .env.staging créé"
fi

# ── 3. Installation dépendances ─────────────────────────────────────────────
echo "📦 Installation des dépendances..."
npm install

# ── 4. Build ────────────────────────────────────────────────────────────────
echo "🔨 Build API..."
cd apps/api && npm run build && cd ../..

echo "🔨 Build Frontend App..."
cd apps/app && npm run build && cd ../..

echo "🔨 Build Public Site..."
cd apps/public-site && npm run build && cd ../..

# ── 5. Appliquer les migrations Supabase ────────────────────────────────────
echo "🗄️ Application des migrations SQL..."
echo "⚠️  Exécute manuellement sur le dashboard Supabase :"
echo "   supabase/migrations/20250505_001_tenants.sql"
echo "   supabase/migrations/20250505_002_access_passes.sql"
echo "   supabase/migrations/20250505_003_live_sessions.sql"
echo "   supabase/migrations/20250505000004_marketing.sql"
echo "   supabase/migrations/20260514_001_liri_studio_workspaces.sql"
echo "   supabase/migrations/20260514_002_billing_multi_provider.sql"
echo "   supabase/migrations/20260514_003_missing_tables.sql"
echo "   supabase/seeds/001_tenants_test.sql"

# ── 6. Lancer l'API ─────────────────────────────────────────────────────────
echo "🚀 Démarrage API Staging sur le port ${PORT:-4000}..."
NODE_ENV=staging node apps/api/dist/main.js &
API_PID=$!
echo "   API PID: $API_PID"
sleep 3

# ── 7. Health check ─────────────────────────────────────────────────────────
echo "🏥 Health check..."
curl -s http://localhost:${PORT:-4000}/health || echo "⚠️  API pas encore prête"

echo ""
echo "✅ Déploiement Staging terminé"
echo "   API  : http://localhost:${PORT:-4000}"
echo "   App  : npm run dev:app"
echo "   Site : npm run dev:public-site"
echo ""
echo "⚠️  Pensez à configurer les variables d'environnement dans .env.staging"
echo "   avant de déployer sur Google Cloud Run / Vercel."
EOF
