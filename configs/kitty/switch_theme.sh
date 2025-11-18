#!/bin/bash

# Kitty Theme Switcher Script
# Usage: switch_theme.sh [theme_name]

THEME_DIR="$HOME/.config/kitty"
CONFIG_FILE="$HOME/.config/kitty/kitty.conf"

# List available themes
list_themes() {
    echo "Available themes:"
    ls -1 "$THEME_DIR"/*.conf | grep -v kitty.conf | sed 's/.*\///' | sed 's/.conf$//' | nl
}

# Switch theme
switch_theme() {
    local theme_name="$1"
    local theme_file="$THEME_DIR/${theme_name}.conf"

    if [[ ! -f "$theme_file" ]]; then
        echo "Error: Theme '$theme_name' not found"
        echo
        list_themes
        exit 1
    fi

    # Update the config file
    sed -i "s|include .*/.config/kitty/themes/.*\.conf|include $theme_file|" "$CONFIG_FILE"

    echo "Switched to theme: $theme_name"
    echo "Restart kitty or reload configuration to apply changes"
}

# Interactive theme selection
interactive_switch() {
    echo "Kitty Theme Switcher"
    echo "==================="
    echo

    list_themes
    echo

    read -p "Select theme number: " choice

    local theme_file=$(ls -1 "$THEME_DIR"/*.conf | grep -v kitty.conf | sed -n "${choice}p")
    local theme_name=$(basename "$theme_file" .conf)

    if [[ -z "$theme_name" ]]; then
        echo "Invalid selection"
        exit 1
    fi

    switch_theme "$theme_name"
}

# Main logic
if [[ $# -eq 0 ]]; then
    interactive_switch
elif [[ "$1" == "--list" || "$1" == "-l" ]]; then
    list_themes
else
    switch_theme "$1"
fi