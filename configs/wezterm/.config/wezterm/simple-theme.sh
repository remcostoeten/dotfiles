#!/bin/bash
# Simple WezTerm Theme Switcher - Modifies config directly

CONFIG_FILE="/home/remco-stoeten/.config/wezterm/wezterm.lua"
BACKUP_FILE="/home/remco-stoeten/.config/wezterm/wezterm.lua.backup"

# Create backup if it doesn't exist
if [[ ! -f "$BACKUP_FILE" ]]; then
    cp "$CONFIG_FILE" "$BACKUP_FILE"
fi

case "$1" in
    "modern"|"modern_gradient"|"1")
        echo "Switching to Modern Gradient theme..."
        sed -i "s/config\.colors = .*/config.colors = modern_gradient/" "$CONFIG_FILE"
        sed -i "s/config\.color_scheme = .*/-- config.color_scheme = nil/" "$CONFIG_FILE"
        ;;
    "cyber"|"cyberdream"|"2")
        echo "Switching to Cyberdream theme..."
        sed -i "s/config\.colors = .*/config.colors = require('themes.cyberdream')/" "$CONFIG_FILE"
        sed -i "s/config\.color_scheme = .*/-- config.color_scheme = nil/" "$CONFIG_FILE"
        ;;
    "cat"|"catppuccin"|"3")
        echo "Switching to Catppuccin theme..."
        sed -i "s/config\.colors = .*/-- config.colors = nil/" "$CONFIG_FILE"
        sed -i "s/-- config\.color_scheme = .*/config.color_scheme = 'Catppuccin Mocha'/" "$CONFIG_FILE"
        ;;
    "pumpkin"|"4")
        echo "Switching to Pumpkin Spice theme..."
        sed -i "s/config\.colors = .*/config.colors = require('themes.pumpkin-spice').colors/" "$CONFIG_FILE"
        sed -i "s/config\.color_scheme = .*/-- config.color_scheme = nil/" "$CONFIG_FILE"
        ;;
    "opacity")
        if [[ -n "$2" ]]; then
            echo "Setting opacity to $2..."
            sed -i "s/config\.window_background_opacity = .*/config.window_background_opacity = $2/" "$CONFIG_FILE"
        else
            echo "Usage: $0 opacity <0.1-1.0>"
            echo "Example: $0 opacity 0.8"
            exit 1
        fi
        ;;
    "list")
        echo "Available themes:"
        echo "  modern    - Modern Gradient 🌈"
        echo "  cyber     - Cyberdream 🌃" 
        echo "  cat       - Catppuccin 🌙"
        echo "  pumpkin   - Pumpkin Spice 🎃"
        echo ""
        echo "Opacity:"
        echo "  opacity <value>  - Set opacity (0.1-1.0)"
        echo ""
        echo "Other:"
        echo "  restart   - Restart WezTerm"
        echo "  restore   - Restore backup config"
        exit 0
        ;;
    "restart")
        echo "Restarting WezTerm..."
        pkill -f wezterm-gui || pkill wezterm
        sleep 1
        wezterm start --always-new-process &
        echo "WezTerm restarted!"
        exit 0
        ;;
    "restore")
        echo "Restoring backup config..."
        cp "$BACKUP_FILE" "$CONFIG_FILE"
        echo "Config restored. Restart WezTerm to see changes."
        exit 0
        ;;
    *)
        echo "Simple WezTerm Theme Switcher"
        echo "Usage: $0 [theme|opacity|command]"
        echo ""
        echo "Themes:"
        echo "  modern    - Modern Gradient 🌈"
        echo "  cyber     - Cyberdream 🌃"
        echo "  cat       - Catppuccin 🌙" 
        echo "  pumpkin   - Pumpkin Spice 🎃"
        echo ""
        echo "Commands:"
        echo "  opacity <0.1-1.0>  - Set window opacity"
        echo "  restart            - Restart WezTerm"
        echo "  list              - Show all options"
        echo "  restore           - Restore backup config"
        echo ""
        echo "Examples:"
        echo "  $0 modern"
        echo "  $0 opacity 0.8"
        echo "  $0 restart"
        exit 1
        ;;
esac

# Force reload WezTerm config
echo "Reloading WezTerm configuration..."
pkill -SIGUSR1 wezterm 2>/dev/null || {
    echo "Auto-reload failed. Restarting WezTerm..."
    pkill -f wezterm-gui || pkill wezterm
    sleep 1
    wezterm start --always-new-process &
}

echo "Done! Check your WezTerm window."