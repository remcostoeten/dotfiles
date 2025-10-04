#!/bin/bash
# CLI Theme Switcher for WezTerm

THEMES=("modern_gradient" "cyberdream" "catppuccin" "pumpkin")
THEME_NAMES=("Modern Gradient 🌈" "Cyberdream 🌃" "Catppuccin 🌙" "Pumpkin Spice 🎃")

# Get current theme or default to first
CURRENT_THEME_FILE="$HOME/.config/wezterm/.current_theme"
if [[ -f "$CURRENT_THEME_FILE" ]]; then
    CURRENT=$(cat "$CURRENT_THEME_FILE")
else
    CURRENT=0
fi

# Handle arguments
case "$1" in
    "next"|"")
        # Cycle to next theme
        CURRENT=$(( (CURRENT + 1) % ${#THEMES[@]} ))
        ;;
    "prev")
        # Cycle to previous theme
        CURRENT=$(( (CURRENT - 1 + ${#THEMES[@]}) % ${#THEMES[@]} ))
        ;;
    "list")
        echo "Available themes:"
        for i in "${!THEMES[@]}"; do
            marker=""
            [[ $i -eq $CURRENT ]] && marker=" (current)"
            echo "  $i: ${THEME_NAMES[$i]}$marker"
        done
        exit 0
        ;;
    [0-9])
        if [[ $1 -lt ${#THEMES[@]} ]]; then
            CURRENT=$1
        else
            echo "Invalid theme number. Use 'list' to see available themes."
            exit 1
        fi
        ;;
    *)
        echo "Usage: $0 [next|prev|list|0-3]"
        echo "  next: Switch to next theme (default)"
        echo "  prev: Switch to previous theme"
        echo "  list: Show available themes"
        echo "  0-3:  Switch to specific theme number"
        exit 1
        ;;
esac

# Save current theme
echo "$CURRENT" > "$CURRENT_THEME_FILE"

# Apply theme using WezTerm CLI
THEME_KEY="${THEMES[$CURRENT]}"
THEME_NAME="${THEME_NAMES[$CURRENT]}"

# Create a temp Lua script to change theme
TEMP_SCRIPT="$HOME/.config/wezterm/.temp_theme.lua"
cat > "$TEMP_SCRIPT" << EOF
local wezterm = require 'wezterm'

-- Get all windows
for _, gui_window in ipairs(wezterm.gui.gui_windows()) do
    local overrides = gui_window:get_config_overrides() or {}
    
    if "$THEME_KEY" == "modern_gradient" then
        local modern_gradient = require('themes.modern-gradient')
        overrides.colors = modern_gradient
        overrides.color_scheme = nil
    elseif "$THEME_KEY" == "cyberdream" then
        local cyberdream = require('themes.cyberdream')
        overrides.colors = cyberdream
        overrides.color_scheme = nil
    elseif "$THEME_KEY" == "catppuccin" then
        overrides.color_scheme = "Catppuccin Mocha"
        overrides.colors = nil
    elseif "$THEME_KEY" == "pumpkin" then
        local pumpkin = require('themes.pumpkin-spice')
        overrides.colors = pumpkin.colors
        overrides.color_scheme = nil
    end
    
    gui_window:set_config_overrides(overrides)
    gui_window:toast_notification('Theme Changed', '$THEME_NAME', nil, 2000)
end
EOF

# Execute the theme change
wezterm cli spawn --cwd="$HOME/.config/wezterm" -- lua "$TEMP_SCRIPT" 2>/dev/null || {
    echo "Applied theme: $THEME_NAME"
    echo "Note: Theme will be active on next WezTerm restart"
}

# Cleanup
rm -f "$TEMP_SCRIPT"