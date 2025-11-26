#!/bin/bash

echo "Installing FFmpeg codecs for Electron..."

# Get Electron version
ELECTRON_VERSION=$(node -p "require('./node_modules/electron/package.json').version")
echo "Electron version: $ELECTRON_VERSION"

# Download FFmpeg library for Linux
FFMPEG_URL="https://github.com/iteufel/electron-ffmpeg/releases/download/v${ELECTRON_VERSION}/ffmpeg-linux-x64.zip"

echo "Downloading FFmpeg from: $FFMPEG_URL"

# Create temp directory
mkdir -p temp_ffmpeg
cd temp_ffmpeg

# Download and extract
wget "$FFMPEG_URL" -O ffmpeg.zip 2>/dev/null || curl -L "$FFMPEG_URL" -o ffmpeg.zip

if [ -f ffmpeg.zip ]; then
    unzip -o ffmpeg.zip
    
    # Copy to Electron directory
    cp libffmpeg.so ../node_modules/electron/dist/
    
    echo "✓ FFmpeg installed successfully!"
    cd ..
    rm -rf temp_ffmpeg
else
    echo "✗ Failed to download FFmpeg"
    echo "Trying alternative method..."
    cd ..
    rm -rf temp_ffmpeg
    
    # Alternative: Use system FFmpeg libraries
    if command -v ffmpeg &> /dev/null; then
        echo "System FFmpeg found, Electron will use system codecs"
    else
        echo "Please install FFmpeg on your system:"
        echo "  Ubuntu/Debian: sudo apt-get install ffmpeg"
        echo "  Arch: sudo pacman -S ffmpeg"
        echo "  Fedora: sudo dnf install ffmpeg"
    fi
fi