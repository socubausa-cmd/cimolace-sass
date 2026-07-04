#!/usr/bin/env bash
#
# rollback-to-healthy.sh — restaure la prod LIRI en promouvant le déploiement
# Vercel le plus récent qui PASSE le smoke test (React monte, pas de page blanche).
# ============================================================================
# Neutralise un `vercel --prod` cassé poussé à la main par une session // (crash
# undefined.default). Appelé par watch-front-health.sh après régression confirmée.
# Compatible bash 3.2 (le /bin/bash de macOS).
#
# GARDE-FOU : teste d'abord l'URL PUBLIQUE (app.cimolace.space) — si elle est
# déjà saine, ne rétrograde RIEN. `vercel ls` liste par âge de CRÉATION (pas par
# alias prod) : on ne peut donc pas se fier au 1er de la liste pour savoir ce qui
# est en prod. On promeut le 1er déploiement qui passe le smoke — dans le vrai
# scénario (prod cassée par un déploiement récent) c'est le bon rollback, et le
# garde-fou public empêche toute rétrogradation quand la prod va déjà bien.
#
# Usage :  bash scripts/rollback-to-healthy.sh [url-publique]
# Sortie : 0 = rien à faire ou rollback effectué, 1 = aucun sain trouvé.
# ============================================================================
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SMOKE="$ROOT/scripts/smoke-front-health.mjs"
SCOPE="${VERCEL_SCOPE:-cimolace}"
PROD_URL="${1:-${WATCH_URL:-https://app.cimolace.space/liri}}"
LOG="${WATCH_LOG:-/tmp/liri-front-health.log}"
log() { echo "[$(date '+%F %T')] $*" | tee -a "$LOG"; }

# 1) Garde-fou : si la PROD PUBLIQUE est déjà saine, ne rien rétrograder.
if node "$SMOKE" "$PROD_URL" >/dev/null 2>&1; then
  log "✓ prod ($PROD_URL) déjà saine — rollback inutile."
  exit 0
fi

# 2) Prod cassée : promouvoir le déploiement Ready le + récent qui passe le smoke.
#    NB: `vercel ls` écrit le tableau sur STDERR → 2>&1 ; cwd neutre car le lien
#    .vercel de la racine repo est neutralisé (.vercel.disabled).
urls="$(cd /tmp 2>/dev/null; vercel ls app --scope "$SCOPE" 2>&1 | grep -i 'Ready' | grep -oE 'https://app-[a-z0-9]+-cimolace\.vercel\.app')"
[ -z "$urls" ] && { log "⛔ rollback : aucun déploiement Ready listé."; exit 1; }

for u in $urls; do
  if node "$SMOKE" "$u/liri" >/dev/null 2>&1; then
    log "↩️ rollback : déploiement sain ($u) → promotion…"
    if vercel promote "$u" --scope "$SCOPE" --yes >/dev/null 2>&1; then
      log "✅ rollback effectué → $u"
      exit 0
    fi
    # promote KO (souvent : ce déploiement EST déjà la prod). Re-tester la prod.
    if node "$SMOKE" "$PROD_URL" >/dev/null 2>&1; then
      log "✓ prod redevenue saine — ok (pas de rétrogradation)."
      exit 0
    fi
    log "⚠️ promote KO sur $u, essai suivant…"
  fi
done
log "⛔ rollback : aucun déploiement sain promu — intervention MANUELLE requise."
exit 1
