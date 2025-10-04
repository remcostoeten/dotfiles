#!/bin/bash

# WezTerm Restart Script with Enhanced Configuration
echo "🚀 Restarting WezTerm with enhanced visual configuration..."

# Kill existing WezTerm instances gracefully
pkill -TERM wezterm

# Wait a moment for graceful shutdown
sleep 1

# Force kill any remaining instances
pkill -KILL wezterm 2>/dev/null

# Start WezTerm with our enhanced config
echo "✨ Starting WezTerm with modern gradient theme and visual effects..."
wezterm --config-file "$HOME/.config/wezterm/wezterm.lua" &

echo "🎨 WezTerm restarted with:"
echo "  • Modern gradient background with transparency"
echo "  • Enhanced tab bar with process icons"
echo "  • Animated status line with git/battery/system info"
echo "  • Powerline separators and nerd font icons"
echo "  • Background blur effects (Linux/Wayland)"
echo ""
echo "🎯 Quick keyboard shortcuts:"
echo "  • Ctrl+Space then 't' - Cycle themes"
echo "  • Ctrl+Space then 'b' - Cycle backgrounds"
echo "  • Ctrl+Space then 'o' - Cycle opacity"
echo "  • Ctrl+Space then 'r' - Reload config"
echo ""
echo "🌈 Enjoy your enhanced WezTerm experience!"