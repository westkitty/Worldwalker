#!/bin/zsh
set -euo pipefail
cd "${0:A:h}/.."
APP="/Applications/Worldwalker.app"

echo "==> Building Worldwalker macOS icon..."
python3 scripts/build-icon.py macos/Worldwalker.icns

echo "==> Compiling Swift wrapper..."
mkdir -p .module-cache
swiftc -O -module-cache-path .module-cache macos/WorldwalkerWrapper.swift -o macos/Worldwalker

echo "==> Assembling $APP..."
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
cp macos/Info.plist "$APP/Contents/Info.plist"
cp macos/Worldwalker "$APP/Contents/MacOS/Worldwalker"
chmod +x "$APP/Contents/MacOS/Worldwalker"
cp macos/Worldwalker.icns "$APP/Contents/Resources/Worldwalker.icns"
/usr/bin/codesign --force --deep --sign - "$APP"
/usr/bin/xattr -dr com.apple.quarantine "$APP" 2>/dev/null || true

echo "==> Refreshing LaunchServices and Dock..."
/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -f "$APP"
/opt/homebrew/bin/dockutil --add "$APP" --replacing "Worldwalker" --no-restart 2>/dev/null || /opt/homebrew/bin/dockutil --add "$APP" --no-restart
touch "$APP"
killall Dock 2>/dev/null || true

echo "==> Worldwalker.app rebuilt, signed, registered, and pinned to Dock."
