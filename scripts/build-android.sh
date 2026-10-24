#!/usr/bin/env bash
# ============================================================
# build-android.sh — prépare le dossier public/ et synchronise le projet Android
# Utilisé en local (./scripts/build-android.sh) et en CI (workflow build-apk).
# ============================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PUBLIC="$ROOT/public"
rm -rf "$PUBLIC"
mkdir -p "$PUBLIC"

# Fichiers web à embarquer dans l'APK (tout sauf le tooling)
cp "$ROOT/index.html" "$ROOT/style.css" "$ROOT/sw.js" "$PUBLIC/"
cp "$ROOT/manifest.webmanifest" "$PUBLIC/"
cp "$ROOT/icon-192.png" "$ROOT/icon-512.png" "$PUBLIC/"
cp "$ROOT/screenshot-narrow.png" "$ROOT/screenshot-wide.png" "$PUBLIC/"

# app.js : le service worker est désactivé dans l'APK (assets embarqués,
# le SW casserait la mise à jour du cache)
sed "s|if ('serviceWorker' in navigator)|if (false \&\& 'serviceWorker' in navigator)|" \
  "$ROOT/app.js" > "$PUBLIC/app.js"

# Permissions Android pour les rappels (le dossier android/ est régénéré à chaque build)
MANIFEST="$ROOT/android/app/src/main/AndroidManifest.xml"
if [ -f "$MANIFEST" ] && ! grep -q 'POST_NOTIFICATIONS' "$MANIFEST"; then
  python3 - "$MANIFEST" <<'PYEOF'
import io, sys
p = sys.argv[1]
s = io.open(p, encoding='utf-8').read()
old = '    <uses-permission android:name="android.permission.INTERNET" />'
extra = (
    "\n    <!-- Rappels de re-test : notification locale (Android 13+) -->"
    '\n    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />'
    "\n    <!-- Réveil exact pour les rappels quotidiens (Android 12+) -->"
    '\n    <uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM" />'
)
assert s.count(old) == 1
io.open(p, 'w', encoding='utf-8').write(s.replace(old, old + extra))
PYEOF
fi

npx cap sync android
echo "✔ public/ prêt et projet Android synchronisé"
