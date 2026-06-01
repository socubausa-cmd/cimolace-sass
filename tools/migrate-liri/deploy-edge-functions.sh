#!/bin/bash
# ════════════════════════════════════════════════════════════════════════════
# Déploie en masse les 26 Edge Functions LIRI sur Supabase
#
# PRÉREQUIS :
#   1. Créer un Personal Access Token sur https://supabase.com/dashboard/account/tokens
#   2. export SUPABASE_ACCESS_TOKEN="sbp_xxxxxxxxx"
#   3. ./deploy-edge-functions.sh
# ════════════════════════════════════════════════════════════════════════════

set -e

PROJECT_REF="fwfupxvmwtxbtbjdeqvu"
FUNCTIONS_DIR="$(dirname "$0")/../../supabase/functions"

if [ -z "$SUPABASE_ACCESS_TOKEN" ]; then
  echo "❌ SUPABASE_ACCESS_TOKEN manquant."
  echo ""
  echo "Crée un Personal Access Token : https://supabase.com/dashboard/account/tokens"
  echo "Puis : export SUPABASE_ACCESS_TOKEN=\"sbp_xxxxxxxxx\""
  exit 1
fi

cd "$(dirname "$0")/../.."

# Liste des fonctions LIRI à déployer (toutes sauf oauth-* et utilitaires v2)
FUNCTIONS=(
  liri-multilang-live
  liri-multilang-video
  liri-tts
  liri-smartboard-designer-chat
  liri-smartboard-architect-structured
  liri-smartboard-vision-describe
  liri-smartboard-vision-segment
  liri-coach-slide
  liri-konva-scene-improve
  liri-formation-engine
  liri-agent-course-generate
  liri-designer-voice-realtime-session
  liri-vision-temp-sweep
  longia-live-realtime
  longia-guest-live
  longia-admin-document
  neuronq-reformulate
  generate-transcript
  generate-mindmap
  generate-quiz
  generate-visual-image
  generate-node-explanation
  embed-knowledge
  answer-question
  studio-cover-prompt-assistant
  studio-longia-chat
)

# Fonctions sans JWT (publiques) — voir config.toml de chaque fonction
NO_JWT_FUNCTIONS=(
  generate-transcript      # Whisper STT — public via Origin check
  liri-tts                  # TTS — public
  liri-multilang-live       # Multilang — public
  liri-multilang-video
)

contains() {
  local needle="$1"; shift
  for x in "$@"; do [ "$x" = "$needle" ] && return 0; done
  return 1
}

echo "🚀 Déploiement de ${#FUNCTIONS[@]} Edge Functions LIRI..."
echo ""

SUCCESS=0
FAILED=0

for fn in "${FUNCTIONS[@]}"; do
  if [ ! -d "supabase/functions/$fn" ]; then
    echo "  ⚠️  $fn : dossier introuvable"
    FAILED=$((FAILED + 1))
    continue
  fi

  FLAGS=""
  if contains "$fn" "${NO_JWT_FUNCTIONS[@]}"; then
    FLAGS="--no-verify-jwt"
  fi

  echo "  📦 Déploiement de $fn..."
  if npx supabase functions deploy "$fn" --project-ref "$PROJECT_REF" $FLAGS 2>&1 | tail -3; then
    echo "  ✅ $fn déployé"
    SUCCESS=$((SUCCESS + 1))
  else
    echo "  ❌ $fn échec"
    FAILED=$((FAILED + 1))
  fi
  echo ""
done

echo "═══════════════════════════════════════"
echo "✅ Succès : $SUCCESS / ${#FUNCTIONS[@]}"
echo "❌ Échecs : $FAILED / ${#FUNCTIONS[@]}"
echo "═══════════════════════════════════════"

# Configurer les secrets utilisés par les Edge Functions
echo ""
echo "🔑 Configuration des secrets (si pas déjà fait) :"
echo ""
echo "Pour activer toutes les fonctions IA, configure ces secrets via :"
echo "  npx supabase secrets set --project-ref $PROJECT_REF \\"
echo "    DEEPSEEK_API_KEY=sk-... \\"
echo "    OPENAI_API_KEY=sk-... \\"
echo "    ANTHROPIC_API_KEY=sk-ant-... \\"
echo "    GROQ_API_KEY=gsk_... \\"
echo "    ELEVENLABS_API_KEY=... \\"
echo "    GOOGLE_CLOUD_TTS_KEY=..."
echo ""
echo "Ou via dashboard : https://supabase.com/dashboard/project/$PROJECT_REF/functions"
