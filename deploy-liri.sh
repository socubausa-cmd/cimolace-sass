#!/usr/bin/env bash
#
# deploy-liri.sh — Déploiement PROD SÛR du portail LIRI (apps/app → prorascience.org)
# ============================================================================
# GARDE-FOU ANTI-RÉGRESSION MULTI-SESSION. Plusieurs agents/sessions travaillent
# sur ce dépôt et déployaient depuis des checkouts différents → la prod faisait
# du yo-yo (un déploiement écrasait le travail d'un autre).
#
# Ce script garantit que la prod ne peut QUE AVANCER :
#   1. déploiement uniquement depuis le checkout CANONIQUE ;
#   2. REFUS de déployer un état en retard sur origin/main (= régression) ;
#   3. après déploiement, main = état déployé (push fast-forward) → zéro divergence.
#
# Usage :  bash deploy-liri.sh
# ============================================================================
set -euo pipefail

CANON="/Users/ngowazulu/Downloads/cimolace/apps/app"
PROJECT_ID="prj_Ytxn7g7wLgvZEmBUXf7phfSxYGJX"   # Vercel cimolace/app

cd "$CANON" || { echo "❌ Checkout canonique introuvable : $CANON"; exit 1; }

# --- 0) on déploie bien le projet attendu (pas un fantôme) --------------------
if ! grep -q "$PROJECT_ID" .vercel/project.json 2>/dev/null; then
  echo "❌ .vercel ne pointe pas sur cimolace/app ($PROJECT_ID) — checkout suspect, on arrête."
  exit 1
fi

BR=$(git rev-parse --abbrev-ref HEAD)
echo "📍 checkout : $(git rev-parse --show-toplevel)  ·  branche : $BR  ·  HEAD : $(git rev-parse --short HEAD)"

# --- 1) anti-régression : HEAD doit contenir TOUT origin/main ----------------
echo "🔄 git fetch origin main…"
git fetch origin main --quiet
if ! git merge-base --is-ancestor origin/main HEAD; then
  echo ""
  echo "⛔ STOP — ta branche est EN RETARD sur origin/main."
  echo "   Déployer maintenant ferait RÉGRESSER le travail d'une autre session."
  echo "   Commits de main absents de ta branche :"
  git log --oneline HEAD..origin/main | sed 's/^/     /' | head -20
  echo ""
  echo "   ➜ Corrige d'abord :  git merge origin/main   (résous, rebuild), puis relance ce script."
  exit 1
fi
echo "✅ anti-régression OK : HEAD ⊇ origin/main (rien ne sera perdu)"

# --- 2) déploiement prod -----------------------------------------------------
echo "🚀 vercel --prod --yes …"
vercel --prod --yes

# --- 3) verrou anti-divergence : main = état déployé (fast-forward SEULEMENT) -
echo "🔒 sync : push fast-forward HEAD → origin/main…"
if git push origin "HEAD:main" 2>/tmp/_dl_push.log; then
  echo "✅ origin/main = état déployé. Aucune divergence possible."
else
  echo "⚠️  push non fast-forward (origin/main a bougé pendant le déploiement) :"
  cat /tmp/_dl_push.log | sed 's/^/     /'
  echo "   ➜ git merge origin/main puis relance ce script (NE JAMAIS --force)."
fi
echo "🎯 Terminé. Vérifie : https://prorascience.org"
