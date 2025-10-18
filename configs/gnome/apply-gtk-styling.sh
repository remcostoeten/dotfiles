#!/usr/bin/env bash

set -e

BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GTK3_DIR="$HOME/.config/gtk-3.0"
GTK4_DIR="$HOME/.config/gtk-4.0"

log_info "🎨 Applying custom GTK styling..."

mkdir -p "$GTK3_DIR"
mkdir -p "$GTK4_DIR"

if [ -f "$SCRIPT_DIR/gtk/gtk-3.0.css" ]; then
    log_info "Copying GTK 3.0 custom CSS..."
    cp "$SCRIPT_DIR/gtk/gtk-3.0.css" "$GTK3_DIR/gtk.css"
    log_success "GTK 3.0 styling applied"
else
    log_warning "GTK 3.0 CSS file not found"
fi

if [ -f "$SCRIPT_DIR/gtk/gtk-4.0.css" ]; then
    log_info "Copying GTK 4.0 custom CSS..."
    cp "$SCRIPT_DIR/gtk/gtk-4.0.css" "$GTK4_DIR/gtk.css"
    log_success "GTK 4.0 styling applied"
else
    log_warning "GTK 4.0 CSS file not found"
fi

log_info "Configuring GTK settings..."
cat > "$GTK3_DIR/settings.ini" << 'EOF'
[Settings]
gtk-application-prefer-dark-theme=1
gtk-theme-name=Adwaita-dark
gtk-icon-theme-name=Yaru
gtk-font-name=Inter 10
gtk-cursor-theme-name=Yaru
gtk-cursor-theme-size=24
gtk-toolbar-style=GTK_TOOLBAR_BOTH_HORIZ
gtk-toolbar-icon-size=GTK_ICON_SIZE_LARGE_TOOLBAR
gtk-button-images=0
gtk-menu-images=0
gtk-enable-event-sounds=1
gtk-enable-input-feedback-sounds=0
gtk-xft-antialias=1
gtk-xft-hinting=1
gtk-xft-hintstyle=hintmedium
gtk-xft-rgba=rgb
gtk-enable-animations=1
gtk-primary-button-warps-slider=0
EOF

cat > "$GTK4_DIR/settings.ini" << 'EOF'
[Settings]
gtk-application-prefer-dark-theme=1
gtk-theme-name=Adwaita-dark
gtk-icon-theme-name=Yaru
gtk-font-name=Inter 10
gtk-cursor-theme-name=Yaru
gtk-cursor-theme-size=24
gtk-enable-animations=1
gtk-xft-antialias=1
gtk-xft-hinting=1
gtk-xft-hintstyle=hintmedium
gtk-xft-rgba=rgb
EOF

log_success "✨ GTK styling applied successfully!"
log_info "Changes will take effect for newly opened applications."

