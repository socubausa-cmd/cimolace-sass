#!/usr/bin/env bash
#
# install-front-health-watchdog.sh — installe la SURVEILLANCE prod LIRI en
# LaunchAgent macOS (démarrage auto au login, redémarrage auto, notif macOS).
# ============================================================================
# Pourquoi une copie hors du repo : `~/Downloads` est protégé par le TCC macOS
# → un LaunchAgent qui y accède échoue en « Operation not permitted ». On copie
# donc le watcher + sa dépendance Playwright dans ~/Library/Application Support
# (hors TCC ; le navigateur Chromium du cache ~/Library/Caches/ms-playwright est
# réutilisé). Cf. mémoire `vite-prod-crash-build-only`.
#
# Usage :  bash scripts/install-front-health-watchdog.sh              (installe / met à jour)
#          bash scripts/install-front-health-watchdog.sh --uninstall  (retire)
# ============================================================================
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$HOME/Library/Application Support/liri-watch"
LABEL="com.cimolace.liri-front-health"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
UID_N="$(id -u)"
URL="${WATCH_URL:-https://app.cimolace.space/liri}"

if [ "${1:-}" = "--uninstall" ]; then
  launchctl bootout "gui/$UID_N/$LABEL" 2>/dev/null || true
  rm -f "$PLIST"
  echo "🗑️  surveillance désinstallée (données $DEST conservées ; supprime-les à la main si besoin)."
  exit 0
fi

echo "📦 copie du watcher hors TCC → $DEST"
mkdir -p "$DEST/scripts" "$HOME/Library/Logs" "$HOME/Library/LaunchAgents"
cp "$REPO/scripts/smoke-front-health.mjs" "$REPO/scripts/watch-front-health.sh" "$REPO/scripts/rollback-to-healthy.sh" "$DEST/scripts/"

PWV="$(node -e "console.log(require('$REPO/node_modules/@playwright/test/package.json').version)")"
( cd "$DEST" && { [ -f package.json ] || npm init -y >/dev/null 2>&1; } && npm i "@playwright/test@$PWV" >/dev/null 2>&1 )
echo "   Playwright $PWV prêt (navigateur réutilisé depuis ~/Library/Caches/ms-playwright)."

NODE_BIN_DIR="$(dirname "$(command -v node)")"
cat > "$PLIST" <<PLISTEOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key><array>
    <string>/bin/bash</string>
    <string>$DEST/scripts/watch-front-health.sh</string>
    <string>$URL</string>
  </array>
  <key>EnvironmentVariables</key><dict>
    <key>PATH</key><string>$NODE_BIN_DIR:/usr/bin:/bin:/usr/sbin:/sbin</string>
    <key>WATCH_INTERVAL</key><string>900</string>
    <key>WATCH_ON_FAIL</key><string>notify</string>
    <key>WATCH_AUTOROLLBACK</key><string>1</string>
    <key>WATCH_LOG</key><string>$HOME/Library/Logs/liri-front-health.log</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>60</integer>
  <key>StandardOutPath</key><string>$HOME/Library/Logs/liri-front-health.out.log</string>
  <key>StandardErrorPath</key><string>$HOME/Library/Logs/liri-front-health.err.log</string>
</dict></plist>
PLISTEOF

launchctl bootout "gui/$UID_N/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$UID_N" "$PLIST"
echo "✅ surveillance installée & lancée (check /15 min · notif macOS si régression)."
echo "   Journal      : ~/Library/Logs/liri-front-health.log"
echo "   Statut       : launchctl list | grep $LABEL"
echo "   Désinstaller : bash scripts/install-front-health-watchdog.sh --uninstall"
