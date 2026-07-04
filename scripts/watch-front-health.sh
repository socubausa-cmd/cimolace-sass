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

# WATCH_ON_FAIL=exit   (défaut) : sort (exit 2) sur régression → re-invoque Claude (session run_in_background).
# WATCH_ON_FAIL=notify           : notifie macOS (osascript) 1×/épisode et CONTINUE → mode launchd permanent.
ON_FAIL="${WATCH_ON_FAIL:-exit}"
notify() { [ "$ON_FAIL" = "notify" ] && command -v osascript >/dev/null && osascript -e "display notification \"$2\" with title \"$1\" sound name \"Basso\"" >/dev/null 2>&1 || true; }

echo "[$(date '+%F %T')] 👁️  surveillance démarrée — $URL (check /${INTERVAL}s · on-fail=$ON_FAIL)" | tee -a "$LOG"
fails=0; notified=0
while true; do
  if node "$SMOKE" "$URL" >/tmp/_watch_smoke.json 2>/dev/null; then
    if [ "$notified" = "1" ]; then
      echo "[$(date '+%F %T')] ↩️ prod RÉTABLIE" | tee -a "$LOG"
      notify "✅ LIRI prod rétablie" "La prod remonte correctement."
    fi
    fails=0; notified=0
    echo "[$(date '+%F %T')] ✅ prod saine" >> "$LOG"
    sleep "$INTERVAL"
  else
    fails=$((fails + 1))
    echo "[$(date '+%F %T')] ⚠️ smoke KO ($fails/2) — $(tr -d '\n' </tmp/_watch_smoke.json)" | tee -a "$LOG"
    if [ "$fails" -ge 2 ]; then
      echo "[$(date '+%F %T')] ⛔ RÉGRESSION CONFIRMÉE — prod BLANCHE." | tee -a "$LOG"
      # Auto-rollback (WATCH_AUTOROLLBACK=1) : restaure le dernier build sain.
      if [ "${WATCH_AUTOROLLBACK:-0}" = "1" ]; then
        echo "[$(date '+%F %T')] 🔧 auto-rollback en cours…" | tee -a "$LOG"
        if bash "$ROOT/scripts/rollback-to-healthy.sh"; then
          notify "↩️ LIRI prod auto-rétablie" "Un déploiement cassé (page blanche) a été annulé automatiquement."
          fails=0; notified=0
          sleep 45   # laisser l'alias basculer + purge CDN avant le prochain check
          continue
        fi
        # rollback KO → on retombe dans l'alerte ci-dessous
      fi
      if [ "$ON_FAIL" = "notify" ]; then
        [ "$notified" != "1" ] && notify "⛔ LIRI prod cassée (page blanche)" "Rollback auto impossible — intervention requise (bash scripts/rollback-to-healthy.sh)."
        notified=1
        sleep "$INTERVAL"
      else
        cat /tmp/_watch_smoke.json
        exit 2
      fi
    else
      sleep 20   # re-test rapide pour confirmer (anti faux-positif)
    fi
  fi
done
