#!/bin/bash
set -euo pipefail
if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "Acest script se rulează pe macOS, cu Xcode Command Line Tools disponibile." >&2
  exit 1
fi
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MODE="${1:---universal}"
case "$MODE" in
  --dev) OUT="$ROOT/macos/.dev"; ARCHES=("$(uname -m)"); FLAGS=(-Onone -g) ;;
  --universal) OUT="$ROOT/macos/dist"; ARCHES=(arm64 x86_64); FLAGS=(-O) ;;
  --arm64) OUT="$ROOT/macos/dist-arm64"; ARCHES=(arm64); FLAGS=(-O) ;;
  *) echo "Folosire: bash macos/build.sh [--dev|--universal|--arm64]" >&2; exit 1 ;;
esac
SDK="$(xcrun --sdk macosx --show-sdk-path)"
APP="$OUT/BG3RO-Updater.app"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/BG3RO-build.XXXXXX")"
trap 'if [[ -n "$WORK" && "$WORK" == */BG3RO-build.* ]]; then rm -rf -- "$WORK"; fi' EXIT
BINARIES=()
for ARCH in "${ARCHES[@]}"; do
  echo "Compilez macOS ${ARCH}…"
  BIN="$WORK/BG3ROUpdater-$ARCH"
  xcrun swiftc -parse-as-library -swift-version 5 "${FLAGS[@]}" -sdk "$SDK" \
    -target "$ARCH-apple-macosx12.0" -framework SwiftUI -framework AppKit \
    -framework CryptoKit -framework CoreText "$ROOT"/macos/Sources/*.swift -o "$BIN"
  BINARIES+=("$BIN")
done
if [[ "${#BINARIES[@]}" -eq 2 ]]; then
  xcrun lipo -create "${BINARIES[@]}" -output "$WORK/BG3ROUpdater"
  xcrun lipo "$WORK/BG3ROUpdater" -verify_arch arm64 x86_64
else
  cp "${BINARIES[0]}" "$WORK/BG3ROUpdater"
fi
cp "$ROOT/macos/Info.plist" "$APP/Contents/Info.plist"
for ASSET in brand-mark.png cta-filled.png cta-outline.png EBGaramond-SemiBold.ttf OFL-EB-Garamond.txt; do
  cp "$ROOT/assets/$ASSET" "$APP/Contents/Resources/$ASSET"
done
ICONSET="$WORK/AppIcon.iconset"
mkdir -p "$ICONSET"
for SIZE in 16 32 128 256 512; do
  sips -z "$SIZE" "$SIZE" "$ROOT/assets/brand-mark.png" --out "$ICONSET/icon_${SIZE}x${SIZE}.png" >/dev/null
  DOUBLE=$((SIZE*2))
  sips -z "$DOUBLE" "$DOUBLE" "$ROOT/assets/brand-mark.png" --out "$ICONSET/icon_${SIZE}x${SIZE}@2x.png" >/dev/null
done
iconutil -c icns "$ICONSET" -o "$APP/Contents/Resources/AppIcon.icns"
chmod +x "$WORK/BG3ROUpdater"
mv -f "$WORK/BG3ROUpdater" "$APP/Contents/MacOS/BG3ROUpdater"
codesign --force --sign - "$APP"
plutil -lint "$APP/Contents/Info.plist"
"$APP/Contents/MacOS/BG3ROUpdater" --self-test
if [[ "$MODE" == "--universal" ]]; then
  ditto -c -k --keepParent "$APP" "$OUT/BG3RO-Updater-macOS.zip"
elif [[ "$MODE" == "--arm64" ]]; then
  ditto -c -k --keepParent "$APP" "$OUT/BG3RO-Updater-macOS-AppleSilicon.zip"
fi
echo "Gata: $APP"
