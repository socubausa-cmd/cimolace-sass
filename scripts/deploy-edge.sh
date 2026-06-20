#!/bin/bash
# ============================================================================
# deploy-edge.sh — Déploie les edge functions IA (post-production) sur Supabase
#                  + pose (optionnellement) le secret Mistral.
#
# Usage :
#   MISTRAL_API_KEY=xxxx bash scripts/deploy-edge.sh        # secret + déploiement
#   bash scripts/deploy-edge.sh                             # déploiement seul
#   PROJECT_REF=autre_ref MISTRAL_API_KEY=xxxx bash scripts/deploy-edge.sh
#
# Variables facultatives (posées comme secrets si présentes dans l'env) :
#   MISTRAL_MODEL, MISTRAL_MODEL_MINDMAP, MISTRAL_MODEL_QUIZ,
#   MISTRAL_MODEL_EXPLANATION, MISTRAL_IMAGE_MODEL, SMARTBOARD_MISTRAL_MODEL
#
# Prérequis : CLI `supabase` installée + `supabase login` avec un compte
#             ayant accès au projet (PROJECT_REF).
# ============================================================================
set -uo pipefail

# Projet Supabase prod par défaut (surchargeable via env PROJECT_REF).
PROJECT_REF="${PROJECT_REF:-fwfupxvmwtxbtbjdeqvu}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(dirname "$SCRIPT_DIR")"
cd "$ROOT"

# Fonctions IA à (re)déployer : modifiées directement OU dépendantes du
# helper partagé _shared/aiClaudeDeepSeekGrok.ts (qui a changé → re-bundle).
FUNCTIONS=(
  generate-visual-image                  # Mistral image par défaut (outil Agents) + repli DALL·E/Imagen/xAI
  generate-mindmap                       # fix 500 validateMindmap + fallback Mistral (large)
  generate-quiz                          # fallback Mistral (small)
  generate-node-explanation              # résumé mindmap élève — fallback Mistral (small)
  liri-smartboard-architect-structured   # structure de cours — Mistral (large) via helper
  liri-coach-slide                       # via helper
  liri-konva-scene-improve               # via helper
  studio-longia-chat                     # via helper
  neuronq-reformulate                    # via helper
  longia-guest-live                      # via helper
  longia-admin-document                  # via helper
)

if ! command -v supabase &>/dev/null; then
  echo "❌ CLI supabase introuvable. Installe-la : npm i -g supabase"
  exit 1
fi

echo "🚀 Déploiement edge functions IA — projet $PROJECT_REF"
echo "   Racine : $ROOT"
echo ""

# ── 1. Secret Mistral (optionnel) ───────────────────────────────────────────
#     Passe par un fichier temporaire 0600 pour éviter d'exposer la clé dans
#     l'historique shell / la liste des processus (argv).
if [ -n "${MISTRAL_API_KEY:-}" ]; then
  echo "🔑 Pose des secrets Mistral…"
  TMPENV="$(mktemp)"
  chmod 600 "$TMPENV"
  {
    printf 'MISTRAL_API_KEY=%s\n' "$MISTRAL_API_KEY"
    for V in MISTRAL_MODEL MISTRAL_MODEL_MINDMAP MISTRAL_MODEL_QUIZ \
             MISTRAL_MODEL_EXPLANATION MISTRAL_IMAGE_MODEL SMARTBOARD_MISTRAL_MODEL; do
      [ -n "${!V:-}" ] && printf '%s=%s\n' "$V" "${!V}"
    done
  } > "$TMPENV"
  if supabase secrets set --env-file "$TMPENV" --project-ref "$PROJECT_REF"; then
    echo "   ✓ Secrets posés."
  else
    echo "   ✗ Échec de la pose des secrets (continue quand même le déploiement)."
  fi
  rm -f "$TMPENV"
else
  echo "⚠  MISTRAL_API_KEY non fourni → déploiement du CODE seul."
  echo "   Le fallback Mistral (texte + image) restera INACTIF tant que le secret"
  echo "   n'est pas posé. Relance avec : MISTRAL_API_KEY=xxxx bash scripts/deploy-edge.sh"
fi
echo ""

# ── 2. Déploiement des fonctions ────────────────────────────────────────────
OK=()
FAIL=()
for FN in "${FUNCTIONS[@]}"; do
  echo "▶ deploy $FN"
  if supabase functions deploy "$FN" --project-ref "$PROJECT_REF"; then
    OK+=("$FN")
  else
    FAIL+=("$FN")
    echo "   ✗ échec $FN"
  fi
  echo ""
done

# ── 3. Bilan ────────────────────────────────────────────────────────────────
echo "═══════════════════ Bilan ═══════════════════"
echo "✅ Déployées (${#OK[@]}) :"
for F in "${OK[@]:-}"; do [ -n "$F" ] && echo "   - $F"; done
if [ "${#FAIL[@]}" -gt 0 ]; then
  echo "❌ Échecs (${#FAIL[@]}) :"
  for F in "${FAIL[@]}"; do echo "   - $F"; done
  exit 1
fi
echo ""
echo "🎉 Toutes les fonctions IA sont déployées."
[ -z "${MISTRAL_API_KEY:-}" ] && echo "   (pense à poser MISTRAL_API_KEY pour activer le fallback Mistral)"
