#!/bin/zsh
set -e
cd "${0:A:h}/.."

echo "==> Building Worldwalker macOS Icon..."
python3 scripts/build-icon.py macos/Worldwalker.icns

echo "==> Compiling Swift Wrapper..."
mkdir -p .module-cache
swiftc -O -module-cache-path .module-cache macos/WorldwalkerWrapper.swift -o macos/Worldwalker

echo "==> Assembling /Applications/Worldwalker.app..."
mkdir -p /Applications/Worldwalker.app/Contents/MacOS /Applications/Worldwalker.app/Contents/Resources
cp macos/Info.plist /Applications/Worldwalker.app/Contents/Info.plist
cp macos/Worldwalker /Applications/Worldwalker.app/Contents/MacOS/Worldwalker
chmod +x /Applications/Worldwalker.app/Contents/MacOS/Worldwalker
cp macos/Worldwalker.icns /Applications/Worldwalker.app/Contents/Resources/Worldwalker.icns

echo "==> Ensuring Worldwalker is in macOS Dock..."
if [[ -x "/opt/homebrew/bin/dockutil" ]]; then
  /opt/homebrew/bin/dockutil --add "/Applications/Worldwalker.app" --replacing "Worldwalker" 2>/dev/null || \
  /opt/homebrew/bin/dockutil --add "/Applications/Worldwalker.app"
fi

echo "==> Worldwalker.app ready and added to Dock!"
