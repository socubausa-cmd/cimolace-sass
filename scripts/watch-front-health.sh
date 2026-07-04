#!/usr/bin/env bash
#
# watch-front-health.sh — SURVEILLANCE anti-régression de la prod LIRI.
# ============================================================================
# Plusieurs sessions // déploient sur le même prod. Si l'une redéploie un HEAD
# committé cassé (crash « page blanche » undefined.default) SANS passer par le
# smoke test de deploy-liri.sh, la prod tombe. Ce script relance le smoke test
# en boucle et SORT (exit 2) dès qu'une régression est CONFIRMÉE (2 échecs de
# suite, pour ignorer un hoquet réseau transitoire). Prod saine = boucle
# silencieuse. Cf. mémoire `vite-prod-crash-build-only`.
#
# Usage :  bash scripts/watch-front-health.sh [url]
#   env  :  WATCH_INTERVAL=600 (s entre checks)  ·  WATCH_LOG=/tmp/liri-front-health.log
#   Durable (survit à la fermeture de session) : l'installer en launchd/cron.
# ============================================================================
set -uo pipefail

URL="${1:-https://app.cimolace.space/liri}"
INTERVAL="${WATCH_INTERVAL:-600}"          # 10 min par défaut
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SMOKE="$ROOT/scripts/smoke-front-health.mjs"
LOG="${WATCH_LOG:-/tmp/liri-front-health.log}"

echo "[$(date '+%F %T')] 👁️  surveillance démarrée — $URL (check /${INTERVAL}s)" | tee -a "$LOG"
fails=0
while true; do
  if node "$SMOKE" "$URL" >/tmp/_watch_smoke.json 2>/dev/null; then
    [ "$fails" -gt 0 ] && echo "[$(date '+%F %T')] ↩️ rétabli" | tee -a "$LOG"
    fails=0
    echo "[$(date '+%F %T')] ✅ prod saine" >> "$LOG"
    sleep "$INTERVAL"
  else
    fails=$((fails + 1))
    echo "[$(date '+%F %T')] ⚠️ smoke KO ($fails/2) — $(tr -d '\n' </tmp/_watch_smoke.json)" | tee -a "$LOG"
    if [ "$fails" -ge 2 ]; then
      echo "[$(date '+%F %T')] ⛔ RÉGRESSION CONFIRMÉE — prod BLANCHE. Rollback requis (vercel promote <url-saine>)." | tee -a "$LOG"
      cat /tmp/_watch_smoke.json
      exit 2
    fi
    sleep 20   # re-test rapide pour confirmer (anti faux-positif)
  fi
done
