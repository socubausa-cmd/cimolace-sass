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

# --- 2) mémoriser le déploiement prod ACTUEL (rollback de secours) -----------
PREV_URL=$(vercel ls app --scope cimolace 2>/dev/null | grep -i 'Production' | grep -oE 'https://app-[a-z0-9]+-cimolace\.vercel\.app' | head -1)
echo "↩️  déploiement prod actuel (rollback de secours) : ${PREV_URL:-inconnu}"

# --- 3) déploiement prod -----------------------------------------------------
echo "🚀 vercel --prod --yes --archive=tgz …"
# --archive=tgz : contourne le quota « api-upload-free » (5000 fichiers/24h) que
# des déploiements // répétés épuisent → sinon `missing_archive / Too many requests`.
DEPLOY_OUT=$(vercel --prod --yes --archive=tgz 2>&1); echo "$DEPLOY_OUT"
NEW_URL=$(echo "$DEPLOY_OUT" | grep -oE 'https://app-[a-z0-9]+-cimolace\.vercel\.app' | head -1)

# --- 4) SMOKE TEST RUNTIME — le déploiement MONTE-T-IL vraiment ? -------------
# ⚠️ Un `vite build` VERT ne garantit PAS que la prod monte. Le crash
#   « page blanche globale · TypeError undefined (reading 'default') »
#   (mélange import statique+dynamique d'un gros module, ex: main.tsx → @/App)
#   n'apparaît QU'EN build prod et peut être MASQUÉ en local par le WIP d'une
#   session //. On charge donc un vrai Chromium et on vérifie que React monte.
#   Détails → mémoire `vite-prod-crash-build-only`.
if [ -n "${NEW_URL:-}" ]; then
  echo "🩺 smoke test runtime : ${NEW_URL}/liri …"
  if node "$CANON/../../scripts/smoke-front-health.mjs" "${NEW_URL}/liri"; then
    echo "✅ smoke test OK — React monte, pas de crash bootstrap."
  else
    echo ""
    echo "⛔ SMOKE TEST ÉCHOUÉ — le déploiement CRASHE au runtime (page blanche globale) !"
    if [ -n "${PREV_URL:-}" ]; then
      echo "   ↩️  ROLLBACK automatique → $PREV_URL"
      vercel promote "$PREV_URL" --scope cimolace --yes || echo "   ⚠️ rollback auto échoué — rollback MANUEL requis."
    else
      echo "   ⚠️ URL de rollback inconnue — rollback MANUEL requis (vercel ls app ; vercel promote <url>)."
    fi
    echo "   🚫 origin/main NON mis à jour (l'état committé reste marqué non-déployable)."
    echo "   ➜ Corrige le crash AVANT de redéployer. Cause quasi-certaine : import"
    echo "      statique + dynamique mêlés d'un gros module. Cf. vite-prod-crash-build-only."
    exit 1
  fi
else
  echo "⚠️ URL de déploiement non détectée — smoke test SAUTÉ. Vérifie https://prorascience.org/liri à la main."
fi

# --- 5) verrou anti-divergence : main = état déployé (fast-forward SEULEMENT) -
echo "🔒 sync : push fast-forward HEAD → origin/main…"
if git push origin "HEAD:main" 2>/tmp/_dl_push.log; then
  echo "✅ origin/main = état déployé. Aucune divergence possible."
else
  echo "⚠️  push non fast-forward (origin/main a bougé pendant le déploiement) :"
  cat /tmp/_dl_push.log | sed 's/^/     /'
  echo "   ➜ git merge origin/main puis relance ce script (NE JAMAIS --force)."
fi
echo "🎯 Terminé. Vérifie : https://prorascience.org"
