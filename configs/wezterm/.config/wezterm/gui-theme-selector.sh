#!/bin/bash
# GUI Theme Selector for WezTerm using zenity

# Check if zenity is available
if ! command -v zenity &> /dev/null; then
    echo "zenity is not installed. Install it with: sudo apt install zenity"
    echo "Or use the CLI versions: ./cli-theme.sh and ./cli-opacity.sh"
    exit 1
fi

SCRIPT_DIR="$(dirname "$0")"
THEME_SCRIPT="$SCRIPT_DIR/cli-theme.sh"
OPACITY_SCRIPT="$SCRIPT_DIR/cli-opacity.sh"

# Main menu
while true; do
    CHOICE=$(zenity --list \
        --title="WezTerm Theme Manager" \
        --text="Choose what you want to modify:" \
        --column="Option" --column="Description" \
        "themes" "Change color theme (Modern Gradient, Cyberdream, etc.)" \
        "opacity" "Adjust window transparency" \
        "restart" "Restart WezTerm" \
        "exit" "Close this manager" \
        --height=300 --width=500)

    case "$CHOICE" in
        "themes")
            # Theme selection
            THEME_CHOICE=$(zenity --list \
                --title="Select Theme" \
                --text="Choose a WezTerm theme:" \
                --column="ID" --column="Theme" --column="Description" \
                "0" "Modern Gradient 🌈" "Vibrant purple/pink gradient" \
                "1" "Cyberdream 🌃" "Dark cyberpunk theme" \
                "2" "Catppuccin 🌙" "Popular pastel theme" \
                "3" "Pumpkin Spice 🎃" "Autumn orange theme" \
                --height=300 --width=500)
            
            if [[ -n "$THEME_CHOICE" ]]; then
                "$THEME_SCRIPT" "$THEME_CHOICE"
                zenity --info --text="Theme applied! Check your WezTerm window." --timeout=3
            fi
            ;;
            
        "opacity")
            # Opacity selection
            OPACITY_CHOICE=$(zenity --list \
                --title="Select Opacity" \
                --text="Choose transparency level:" \
                --column="ID" --column="Level" --column="Description" \
                "0" "100% (Solid)" "No transparency" \
                "1" "90%" "Slightly transparent" \
                "2" "80%" "Moderately transparent" \
                "3" "70%" "Quite transparent" \
                "4" "60%" "Very transparent" \
                "5" "50%" "Highly transparent" \
                --height=300 --width=500)
            
            if [[ -n "$OPACITY_CHOICE" ]]; then
                "$OPACITY_SCRIPT" "$OPACITY_CHOICE"
                zenity --info --text="Opacity applied! Check your WezTerm window." --timeout=3
            fi
            ;;
            
        "restart")
            # Restart WezTerm
            if zenity --question --text="Restart WezTerm now?\n\nThis will close all WezTerm windows and restart the terminal."; then
                "$SCRIPT_DIR/restart-wezterm.sh"
                zenity --info --text="WezTerm restarted!" --timeout=2
            fi
            ;;
            
        "exit")
            exit 0
            ;;
            
        *)
            exit 0
            ;;
    esac
done