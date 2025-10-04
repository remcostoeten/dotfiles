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

-- 🎨 TESTING: Simple dark theme to verify config loading
-- local pumpkin_theme = require('themes.pumpkin-gradient')
-- config.colors = pumpkin_theme.colors
-- config.window_background_gradient = pumpkin_theme.window_background_gradient

-- Simple test colors
config.colors = {
  background = '#0D0804',  -- Very dark brown
  foreground = '#E8D5C4',  -- Light cream
  cursor_bg = '#FF6B1A',   -- Bright orange
}

-- 🖼️ Background image (your custom bg.png - testing with relative path)
config.window_background_image = 'backgrounds/bg.png'
config.window_background_image_hsb = {
  brightness = 0.3,   -- Much more visible for testing
  hue = 1.0,
  saturation = 0.8,   -- High saturation for testing
}

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

-- 🖼️ Window frame (updated for much darker pumpkin theme)
config.window_frame = {
  active_titlebar_bg = '#0D0804',
  inactive_titlebar_bg = '#0D0804',
  active_titlebar_fg = '#E8D5C4',
  inactive_titlebar_fg = '#A68B5B',
  active_titlebar_border_bottom = '#FF6B1A',
  inactive_titlebar_border_bottom = '#32200C',
  button_fg = '#A68B5B',
  button_bg = '#0D0804',
  button_hover_fg = '#E8D5C4',
  button_hover_bg = '#FF6B1A',
}

-- ⚡ Performance
config.max_fps = 120
config.animation_fps = 60
config.prefer_egl = true
config.enable_wayland = true

-- ✨ Cursor (updated for pumpkin theme)
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

-- 🎨 Visual effects (95% opacity as requested)
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
