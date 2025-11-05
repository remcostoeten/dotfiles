#!/bin/bash
# Complete WezTerm Theme Fixer - Removes all conflicting settings

CONFIG_FILE="/home/remco-stoeten/.config/wezterm/wezterm.lua"
BACKUP_FILE="/home/remco-stoeten/.config/wezterm/wezterm.lua.original"

# Create backup
cp "$CONFIG_FILE" "$BACKUP_FILE"

case "$1" in
    "modern"|"1")
        echo "🌈 Switching to Modern Gradient theme..."
        THEME_NAME="modern_gradient"
        THEME_REQUIRE="require('themes.modern-gradient')"
        FRAME_BG="#0F0D15"
        FRAME_ACCENT="#FF6B9D"
        ;;
    "cyber"|"2")
        echo "🌃 Switching to Cyberdream theme..."
        THEME_NAME="cyberdream"
        THEME_REQUIRE="require('themes.cyberdream')"
        FRAME_BG="#16181a"
        FRAME_ACCENT="#00d4aa"
        ;;
    "cat"|"3")
        echo "🌙 Switching to Catppuccin theme..."
        THEME_NAME="catppuccin"
        THEME_REQUIRE="nil"
        COLOR_SCHEME="'Catppuccin Mocha'"
        FRAME_BG="#1e1e2e"
        FRAME_ACCENT="#cba6f7"
        ;;
    "pumpkin"|"4")
        echo "🎃 Switching to Pumpkin Spice theme..."
        THEME_NAME="pumpkin"
        THEME_REQUIRE="require('themes.pumpkin-spice').colors"
        FRAME_BG="#2D1B0E"
        FRAME_ACCENT="#FF8C42"
        ;;
    *)
        echo "Complete WezTerm Theme Fixer"
        echo "Usage: $0 [theme]"
        echo ""
        echo "Available themes:"
        echo "  modern (1)  - Modern Gradient 🌈"
        echo "  cyber (2)   - Cyberdream 🌃"
        echo "  cat (3)     - Catppuccin 🌙"
        echo "  pumpkin (4) - Pumpkin Spice 🎃"
        echo ""
        echo "This script will:"
        echo "  - Remove hardcoded purple background gradient"
        echo "  - Remove conflicting window frame colors"
        echo "  - Set the theme properly"
        echo "  - Restart WezTerm"
        exit 1
        ;;
esac

# Create new config with theme
cat > "$CONFIG_FILE" << 'EOF'
local wezterm = require 'wezterm'
local config = wezterm.config_builder()

-- 🔤 Font configuration
config.font = wezterm.font_with_fallback {
  {
    family = 'JetBrains Mono Nerd Font',
    weight = 'Medium',
    harfbuzz_features = { 'calt=1', 'liga=1', 'ss01=1', 'ss02=1', 'zero=1' },
  },
  {
    family = 'Hack Nerd Font',
    harfbuzz_features = { 'calt=1', 'liga=1' },
  },
  { family = 'Symbols Nerd Font Mono' },
}
config.font_size = 16.0
config.line_height = 1.2
config.cell_width = 0.9

-- 🎨 THEME CONFIGURATION (will be replaced by script)
EOF

# Add theme-specific configuration
if [[ "$THEME_NAME" == "catppuccin" ]]; then
    cat >> "$CONFIG_FILE" << EOF
config.color_scheme = $COLOR_SCHEME
EOF
else
    cat >> "$CONFIG_FILE" << EOF
config.colors = $THEME_REQUIRE
EOF
fi

# Add rest of configuration
cat >> "$CONFIG_FILE" << EOF

-- 🖼️ Window appearance
config.window_decorations = 'RESIZE'
config.window_close_confirmation = 'NeverPrompt'
config.adjust_window_size_when_changing_font_size = false

-- 📐 Window padding
config.window_padding = {
  left = 20,
  right = 20,
  top = 20,
  bottom = 20,
}

-- 🖼️ Window frame (theme-matching colors)
config.window_frame = {
  active_titlebar_bg = '$FRAME_BG',
  inactive_titlebar_bg = '$FRAME_BG',
  active_titlebar_fg = '#ffffff',
  inactive_titlebar_fg = '#aaaaaa',
  active_titlebar_border_bottom = '$FRAME_ACCENT',
  inactive_titlebar_border_bottom = '#333333',
  button_fg = '#cccccc',
  button_bg = '$FRAME_BG',
  button_hover_fg = '#ffffff',
  button_hover_bg = '$FRAME_ACCENT',
}

-- ⚡ Performance
config.max_fps = 120
config.animation_fps = 60
config.prefer_egl = true
config.enable_wayland = true

-- ✨ Cursor
config.default_cursor_style = 'BlinkingBar'
config.cursor_blink_rate = 800
config.cursor_thickness = '2px'
config.cursor_blink_ease_in = 'Constant'
config.cursor_blink_ease_out = 'Constant'

-- 📄 Behavior
config.enable_scroll_bar = false
config.scrollback_lines = 10000
config.audible_bell = 'Disabled'
config.visual_bell = {
  fade_in_function = 'EaseIn',
  fade_in_duration_ms = 0,
  fade_out_function = 'EaseOut',
  fade_out_duration_ms = 0,
}

-- 🌈 Tab bar
config.use_fancy_tab_bar = false
config.tab_bar_at_bottom = false
config.hide_tab_bar_if_only_one_tab = false
config.show_tab_index_in_tab_bar = false
config.tab_max_width = 25

-- 📎 Window size
config.initial_cols = 120
config.initial_rows = 32

-- 🎨 Visual effects
config.window_background_opacity = 0.95
config.text_background_opacity = 1.0

-- ✨ Platform-specific
if wezterm.target_triple:match('apple') then
  config.macos_window_background_blur = 30
  config.window_decorations = 'RESIZE'
elseif wezterm.target_triple:match('linux') then
  config.enable_wayland = true
  config.window_decorations = 'NONE'
end

-- 🔧 Terminal behavior
config.exit_behavior = 'Close'
config.automatically_reload_config = true
config.check_for_updates = false
config.use_dead_keys = false
config.warn_about_missing_glyphs = false

return config
EOF

echo "✅ Theme configuration updated!"
echo "🔄 Restarting WezTerm..."

# Force restart WezTerm
pkill -f wezterm-gui || pkill wezterm
sleep 1
wezterm start --always-new-process &

echo "🎉 Done! Your WezTerm should now show the $THEME_NAME theme properly."
echo ""
echo "If you want to switch themes again, run:"
echo "  ./fix-theme.sh modern   # for Modern Gradient"
echo "  ./fix-theme.sh cyber    # for Cyberdream"
echo "  ./fix-theme.sh cat      # for Catppuccin"
echo "  ./fix-theme.sh pumpkin  # for Pumpkin Spice"