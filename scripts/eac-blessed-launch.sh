#!/usr/bin/env bash
# Launcher de EAC Blessed con workarounds para WebKit/GBM en Linux.

set -euo pipefail

APP_DIR="${EAC_BLESSED_DIR:-$HOME/Documents/newnotion}"
BINARY="$APP_DIR/src-tauri/target/release/eac-blessed"
APPIMAGE_DIR="$APP_DIR/src-tauri/target/release/bundle/appimage"

export WEBKIT_DISABLE_DMABUF_RENDERER=1
export GDK_BACKEND="${GDK_BACKEND:-x11}"

APPIMAGE=""
if [[ -d "$APPIMAGE_DIR" ]]; then
  APPIMAGE="$(find "$APPIMAGE_DIR" -maxdepth 1 -name '*.AppImage' -executable -print -quit 2>/dev/null || true)"
fi

if [[ -n "$APPIMAGE" && -x "$APPIMAGE" ]]; then
  exec "$APPIMAGE" "$@"
elif [[ -x "$BINARY" ]]; then
  exec "$BINARY" "$@"
else
  notify-send "EAC Blessed" "Compila primero: npm run app:build" 2>/dev/null || true
  echo "No encontré EAC Blessed en $APP_DIR" >&2
  echo "Compila con: cd $APP_DIR && npm run app:build" >&2
  exit 1
fi
