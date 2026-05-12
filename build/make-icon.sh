#!/bin/bash
# Generates icon.icns + icon.png from icon.svg using macOS built-in tools.
# Run from the project root: bash build/make-icon.sh

set -euo pipefail

cd "$(dirname "$0")"

SRC=icon.svg
ICONSET=icon.iconset
mkdir -p "$ICONSET"

# 1. SVG → 1024px PNG via Quick Look
qlmanage -t -s 1024 -o /tmp "$SRC" >/dev/null 2>&1
cp "/tmp/$(basename "$SRC").png" "$ICONSET/icon_512x512@2x.png"

# 2. Generate all required sizes for .iconset via sips
declare -a SIZES=(16 32 64 128 256 512)
for s in "${SIZES[@]}"; do
  sips -z "$s" "$s" "$ICONSET/icon_512x512@2x.png" \
       --out "$ICONSET/icon_${s}x${s}.png" >/dev/null
done
# @2x retina variants
for s in 16 32 128 256; do
  s2=$((s*2))
  sips -z "$s2" "$s2" "$ICONSET/icon_512x512@2x.png" \
       --out "$ICONSET/icon_${s}x${s}@2x.png" >/dev/null
done

# 3. iconset → .icns
iconutil -c icns "$ICONSET" -o icon.icns

# 4. Also keep a single 512px PNG for electron-builder's PNG fallback
cp "$ICONSET/icon_512x512.png" icon.png 2>/dev/null || sips -z 512 512 "$ICONSET/icon_512x512@2x.png" --out icon.png >/dev/null

# Cleanup intermediate iconset
rm -rf "$ICONSET"

echo "  → build/icon.icns ($(stat -f%z icon.icns) bytes)"
echo "  → build/icon.png  ($(stat -f%z icon.png) bytes)"
