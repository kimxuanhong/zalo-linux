#!/bin/bash

# Check and install dependencies for Zalo Linux

echo "[Zalo Bridge] Checking dependencies..."

# Check for ImageMagick (import)
if ! command -v import &> /dev/null; then
    echo "[Zalo Bridge] ImageMagick not found (missing 'import'). Installing..."
    
    # Try different package managers
    if command -v apt &> /dev/null; then
        echo "[Zalo Bridge] Using apt..."
        sudo apt-get update && sudo apt-get install -y imagemagick
    elif command -v pacman &> /dev/null; then
        echo "[Zalo Bridge] Using pacman..."
        sudo pacman -S imagemagick
    elif command -v dnf &> /dev/null; then
        echo "[Zalo Bridge] Using dnf..."
        sudo dnf install imagemagick
    elif command -v zypper &> /dev/null; then
        echo "[Zalo Bridge] Using zypper..."
        sudo zypper install imagemagick
    else
        echo "[Zalo Bridge] ERROR: Could not find package manager. Please install ImageMagick manually:"
        echo "  Ubuntu/Debian: sudo apt install imagemagick"
        echo "  Fedora: sudo dnf install imagemagick"
        echo "  Arch: sudo pacman -S imagemagick"
        exit 1
    fi
else
    echo "[Zalo Bridge] ✓ ImageMagick is installed"
fi

echo "[Zalo Bridge] Dependencies check completed"
exit 0
