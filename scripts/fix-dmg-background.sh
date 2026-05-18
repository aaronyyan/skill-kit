#!/bin/bash
# Post-build: ad-hoc sign the app and rebuild DMG with correct background.
# Run after: npx tauri build

set -e

PROJ="/Users/yanlixing/Documents/New project 4"
TAURI_DIR="$PROJ/src-tauri"
RELEASE_DIR="$TAURI_DIR/target/release/bundle/dmg"
APP="$TAURI_DIR/target/release/bundle/macos/SkillKit.app"
BG_IMG="$TAURI_DIR/assets/dmg-background.png"
BUNDLE_SCRIPT="$RELEASE_DIR/bundle_dmg.sh"

if [ ! -f "$BUNDLE_SCRIPT" ]; then
    echo "ERROR: bundle_dmg.sh not found. Run 'npx tauri build' first."
    exit 1
fi

# 1. Ad-hoc sign the app bundle
echo "Signing: $APP"
codesign --force --deep --sign - "$APP"

# 2. Patch bundle_dmg.sh: remove chflags hidden
sed -i '' '/chflags hidden.*\.background/d' "$BUNDLE_SCRIPT"

# 3. Clean old DMGs
rm -f "$RELEASE_DIR/"*.dmg 2>/dev/null || true

# 4. Rebuild DMG
cd "$RELEASE_DIR"
bash "$BUNDLE_SCRIPT" \
    --volname "SkillKit" \
    --icon "SkillKit.app" 188 200 \
    --app-drop-link 532 200 \
    --window-size 720 440 \
    --hide-extension "SkillKit.app" \
    --background "$BG_IMG" \
    "SkillKit_0.1.0_aarch64.dmg" \
    "$APP"

echo "Done: $RELEASE_DIR/SkillKit_0.1.0_aarch64.dmg"
