#!/usr/bin/env bash
# Ensure all runtime dependencies are installed.
# Run once before using record_gif.py for the first time.
set -e

echo "→ Installing Python packages …"
sudo pip3 install playwright pillow -q

echo "→ Installing Playwright Chromium …"
python3 -m playwright install chromium

echo "→ Checking ffmpeg …"
if ! command -v ffmpeg &>/dev/null; then
    sudo apt-get install -y ffmpeg -q
fi

echo "✅ All dependencies ready."
