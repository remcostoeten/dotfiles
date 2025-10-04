local wezterm = require 'wezterm'
local config = wezterm.config_builder()

-- Test basic config with Kitty-inspired settings
config.color_scheme = 'Cyberdream'
config.font = wezterm.font('JetBrains Mono Nerd Font')
config.font_size = 16
config.window_background_opacity = 0.92

-- Import Cyberdream theme
local cyberdream = require 'themes.cyberdream'
config.colors = cyberdream

return config