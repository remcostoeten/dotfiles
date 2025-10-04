-- Test script to verify WezTerm key bindings
local wezterm = require 'wezterm'

print("WezTerm Key Bindings Test")
print("========================")

-- Test that modules can be loaded
local status_bg, background_module = pcall(require, 'modules.background')
local status_themes, themes = pcall(require, 'modules.themes')

print("Background module loaded:", status_bg)
print("Themes module loaded:", status_themes)

if status_bg then
    print("Background module functions available:")
    print("  - cycleBackground:", type(background_module.cycleBackground))
    print("  - cycleOpacity:", type(background_module.cycleOpacity))
end

if status_themes then
    print("Themes module functions available:")
    print("  - cycle_theme:", type(themes._theme_utils.cycle_theme))
end

print("\nTo test the key bindings:")
print("1. Press Ctrl+Space (you should see a ring focus)")
print("2. Then press 't' for themes, 'b' for background, or 'o' for opacity")
print("3. You should see a notification if it works")