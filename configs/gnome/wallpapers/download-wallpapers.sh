#!/usr/bin/env bash

set -e

WALLPAPER_DIR="$HOME/Pictures/Wallpapers/Aesthetic"
mkdir -p "$WALLPAPER_DIR"

echo "🖼️  Downloading beautiful wallpapers for your aesthetic setup..."
echo "Wallpapers will be saved to: $WALLPAPER_DIR"
echo ""

WALLPAPERS=(
    "https://images.unsplash.com/photo-1557683316-973673baf926?w=3840"
    "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=3840"
    "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=3840"
    "https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=3840"
)

if ! command -v wget &> /dev/null; then
    echo "❌ wget not found. Please install wget first:"
    echo "   sudo apt install wget"
    exit 1
fi

cd "$WALLPAPER_DIR"

for i in "${!WALLPAPERS[@]}"; do
    url="${WALLPAPERS[$i]}"
    filename="aesthetic-wallpaper-$((i+1)).jpg"
    
    if [ ! -f "$filename" ]; then
        echo "⬇️  Downloading wallpaper $((i+1))/${#WALLPAPERS[@]}..."
        wget -q "$url" -O "$filename"
        echo "✅ Saved: $filename"
    else
        echo "⏭️  Skipping $filename (already exists)"
    fi
done

echo ""
echo "✨ All wallpapers downloaded!"
echo ""
echo "To set a wallpaper:"
echo "  gsettings set org.gnome.desktop.background picture-uri \"file://$WALLPAPER_DIR/aesthetic-wallpaper-1.jpg\""
echo "  gsettings set org.gnome.desktop.screensaver picture-uri \"file://$WALLPAPER_DIR/aesthetic-wallpaper-1.jpg\""
echo ""
echo "Or use GNOME Settings → Appearance → Background"

