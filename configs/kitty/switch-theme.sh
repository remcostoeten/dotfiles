#!/bin/bash

# Kitty Theme Switcher
# Usage: ./switch-theme.sh [dark|dreamy]

THEME_DIR="$HOME/.config/kitty/themes"
KITTY_CONF="$HOME/.config/kitty/kitty.conf"

if [ $# -eq 0 ]; then
    echo "Usage: $0 [dark|dreamy]"
    echo ""
    echo "Available themes:"
    echo "  dark   - Gruvbox Material Dark (current)"
    echo "  dreamy - Dreamy orange gradient with opacity"
    exit 1
fi

THEME_NAME="$1"

if [ ! -f "$THEME_DIR/$THEME_NAME.conf" ]; then
    echo "Error: Theme '$THEME_NAME' not found in $THEME_DIR/"
    echo "Available themes:"
    ls -1 "$THEME_DIR/" | sed 's/.conf$//' | sed 's/^/  /'
    exit 1
fi

echo "Switching to theme: $THEME_NAME"

# Create backup of current kitty.conf
if [ -f "$KITTY_CONF" ]; then
    cp "$KITTY_CONF" "$KITTY_CONF.backup.$(date +%Y%m%d_%H%M%S)"
fi

# Write new kitty.conf with theme include
cat > "$KITTY_CONF" << EOF
# Kitty Configuration
# Theme: $THEME_NAME
# Generated on $(date)

# Include theme
include $THEME_DIR/$THEME_NAME.conf

# Font settings - Hack Mono with enhanced readability
font_family        Hack Mono Nerd Font
bold_font          Hack Mono Nerd Font Bold
italic_font        Hack Mono Nerd Font Italic
bold_italic_font   Hack Mono Nerd Font Bold Italic

# Font sizing and spacing for better readability
# Line height: 125% (1.25x normal), Column width: 105% (1.05x normal)
font_size          11.0
adjust_line_height 125
adjust_column_width 105

# Performance and GPU settings
repaint_delay      10
input_delay        3
sync_to_monitor    yes

# GPU optimization settings
touch_scroll_multiplier 1.0
disable_ligatures never
# Reduce GPU memory usage
remember_window_size   no
resize_in_steps        yes

# Window settings
window_padding_width 8
tab_bar_style       powerline
tab_powerline_style  angled
active_tab_font_style   bold
inactive_tab_font_style normal

# Other settings
enable_audio_bell no
initial_window_width   100c
initial_window_height  30c

# Cursor
cursor_shape         block
cursor_blink_interval 0

# Keybindings for splits and navigation
# Splits
map ctrl+shift+enter launch --cwd=current --location=hsplit
map ctrl+enter        launch --cwd=current --location=vsplit

# Navigation between splits
map ctrl+left         neighboring_window left
map ctrl+right        neighboring_window right
map ctrl+up           neighboring_window up
map ctrl+down         neighboring_window down

# Alternative navigation with arrow keys
map ctrl+shift+left   neighboring_window left
map ctrl+shift+right  neighboring_window right
map ctrl+shift+up     neighboring_window up
map ctrl+shift+down   neighboring_window down

# Resize splits
map ctrl+alt+left     resize_window narrower
map ctrl+alt+right    resize_window wider
map ctrl+alt+up       resize_window taller
map ctrl+alt+down     resize_window shorter

# Close current split
map ctrl+shift+w      close_window
EOF

echo "Theme switched to '$THEME_NAME' successfully!"
echo "Restart kitty to see the changes."
echo ""
echo "Keybindings:"
echo "  Ctrl+Shift+Enter  - Split horizontally"
echo "  Ctrl+Enter        - Split vertically"
echo "  Ctrl+Arrow keys   - Navigate between splits"
echo "  Ctrl+Alt+Arrows   - Resize splits"
echo "  Ctrl+Shift+W      - Close current split"
echo ""
echo "If you want to go back to the previous theme, the backup is saved as:"
echo "$KITTY_CONF.backup.$(date +%Y%m%d)_*"
echo ""
echo "Or reload the configuration with:"
echo "Ctrl+Shift+F5 (in kitty) or kill -USR1 \$(pgrep kitty)"