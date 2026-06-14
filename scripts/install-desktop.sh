#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LAUNCHER="$HOME/.local/bin/eac-blessed"
DESKTOP="$HOME/.local/share/applications/eac-blessed.desktop"
ICON_DIR="$HOME/.local/share/icons/hicolor/256x256/apps"
ICON="$ICON_DIR/eac-blessed.png"

mkdir -p "$HOME/.local/bin" "$HOME/.local/share/applications" "$ICON_DIR"

install -m 755 "$ROOT/scripts/eac-blessed-launch.sh" "$LAUNCHER"
cp "$ROOT/src-tauri/icons/icon.png" "$ICON"
cp "$ROOT/scripts/eac-blessed.desktop" "$DESKTOP"

update-desktop-database "$HOME/.local/share/applications" 2>/dev/null || true

if [[ -x "$ROOT/src-tauri/target/release/eac-blessed" ]] || \
   find "$ROOT/src-tauri/target/release/bundle/appimage" -name '*.AppImage' -executable -print -quit 2>/dev/null | grep -q .; then
  echo "✅ Launcher instalado. Busca «EAC Blessed» en el menú o ejecuta: eac-blessed"
else
  echo "✅ Launcher instalado, pero falta compilar:"
  echo "   cd $ROOT && npm run app:build"
fi
