#!/bin/bash
# CLI Opacity Controller for WezTerm

OPACITY_LEVELS=(1.0 0.9 0.8 0.7 0.6 0.5)
OPACITY_NAMES=("100% (Solid)" "90%" "80%" "70%" "60%" "50% (Very transparent)")

# Get current opacity or default to second (90%)
CURRENT_OPACITY_FILE="$HOME/.config/wezterm/.current_opacity"
if [[ -f "$CURRENT_OPACITY_FILE" ]]; then
    CURRENT=$(cat "$CURRENT_OPACITY_FILE")
else
    CURRENT=1
fi

# Handle arguments
case "$1" in
    "up"|"")
        # Increase opacity (less transparent)
        CURRENT=$(( CURRENT > 0 ? CURRENT - 1 : ${#OPACITY_LEVELS[@]} - 1 ))
        ;;
    "down")
        # Decrease opacity (more transparent)
        CURRENT=$(( (CURRENT + 1) % ${#OPACITY_LEVELS[@]} ))
        ;;
    "list")
        echo "Available opacity levels:"
        for i in "${!OPACITY_LEVELS[@]}"; do
            marker=""
            [[ $i -eq $CURRENT ]] && marker=" (current)"
            echo "  $i: ${OPACITY_NAMES[$i]}$marker"
        done
        exit 0
        ;;
    [0-9])
        if [[ $1 -lt ${#OPACITY_LEVELS[@]} ]]; then
            CURRENT=$1
        else
            echo "Invalid opacity level. Use 'list' to see available levels."
            exit 1
        fi
        ;;
    *)
        echo "Usage: $0 [up|down|list|0-5]"
        echo "  up:   Increase opacity/less transparent (default)"
        echo "  down: Decrease opacity/more transparent"
        echo "  list: Show available opacity levels"
        echo "  0-5:  Set specific opacity level"
        exit 1
        ;;
esac

# Save current opacity
echo "$CURRENT" > "$CURRENT_OPACITY_FILE"

# Apply opacity using WezTerm CLI
OPACITY_VALUE="${OPACITY_LEVELS[$CURRENT]}"
OPACITY_NAME="${OPACITY_NAMES[$CURRENT]}"

# Create a temp Lua script to change opacity
TEMP_SCRIPT="$HOME/.config/wezterm/.temp_opacity.lua"
cat > "$TEMP_SCRIPT" << EOF
local wezterm = require 'wezterm'

-- Get all windows
for _, gui_window in ipairs(wezterm.gui.gui_windows()) do
    local overrides = gui_window:get_config_overrides() or {}
    
    overrides.window_background_opacity = $OPACITY_VALUE
    overrides.text_background_opacity = math.min($OPACITY_VALUE + 0.1, 1.0)
    
    gui_window:set_config_overrides(overrides)
    gui_window:toast_notification('Opacity Changed', '$OPACITY_NAME', nil, 1500)
end
EOF

# Execute the opacity change
wezterm cli spawn --cwd="$HOME/.config/wezterm" -- lua "$TEMP_SCRIPT" 2>/dev/null || {
    echo "Applied opacity: $OPACITY_NAME"
    echo "Note: Opacity will be active on next WezTerm restart"
}

# Cleanup
rm -f "$TEMP_SCRIPT"