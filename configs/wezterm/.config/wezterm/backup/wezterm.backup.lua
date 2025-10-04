local wezterm = require 'wezterm'
local config = wezterm.config_builder()

-- Comprehensive WezTerm configuration migrated from Kitty

-- Font configuration (from Kitty config)
config.font = wezterm.font_with_fallback {
  {
    family = 'JetBrains Mono Nerd Font',  -- Primary from Kitty config
    harfbuzz_features = { 'calt', 'liga' },
  },
  {
    family = 'Hack',  -- Secondary from Kitty config
    harfbuzz_features = { 'calt', 'liga' },
  },
  { family = 'Symbols Nerd Font Mono' },  -- Icon fallback
}
config.font_size = 16.0             -- From Kitty: font_size 16 (final value)
config.line_height = 1.18           -- From Kitty: adjust_line_height 118%
config.cell_width = 1.2             -- From Kitty: letter_spacing 1.2

-- Import and apply Cyberdream theme
local cyberdream = require 'themes.cyberdream'
config.colors = cyberdream

-- Window appearance (from Kitty config)
config.window_decorations = 'NONE'                    -- From Kitty: hide_window_decorations yes
config.window_background_opacity = 0.92               -- From Kitty: background_opacity 0.92
config.text_background_opacity = 1.0

-- Window padding (from Kitty config)
config.window_padding = {
  left = 15,    -- From Kitty: window_padding_width 15 (final value)
  right = 15,
  top = 15,
  bottom = 15,
}

-- Tab bar (from Kitty config)
config.hide_tab_bar_if_only_one_tab = false           -- Kitty shows tabs with min_tabs = 2
config.show_tab_index_in_tab_bar = true
config.tab_bar_at_bottom = false                      -- From Kitty: tab_bar_edge top
config.use_fancy_tab_bar = false                      -- Simpler powerline style like Kitty
config.enable_tab_bar = true

-- Cursor (from Kitty config)
config.default_cursor_style = 'BlinkingBar'           -- From Kitty: cursor_shape beam + blink
config.cursor_blink_rate = 1000                       -- From Kitty: cursor_blink_interval 1
config.cursor_thickness = '1.5px'                     -- From Kitty: cursor_beam_thickness 1.5

-- Scrollback and behavior (from Kitty config)
config.enable_scroll_bar = false
config.scrollback_lines = 2000                        -- From Kitty: scrollback_lines 2000
config.audible_bell = 'Disabled'                      -- From Kitty: enable_audio_bell no
config.window_close_confirmation = 'NeverPrompt'      -- From Kitty: confirm_os_window_close 0

-- Window size (converted from Kitty pixel values)
config.initial_cols = 80     -- Roughly equivalent to Kitty's 1280px width
config.initial_rows = 24     -- Roughly equivalent to Kitty's 800px height

-- Background image (from Kitty cyberdream.conf)
config.window_background_image = wezterm.config_dir .. '/assets/bg-blurred.png'
config.window_background_image_hsb = {
  brightness = 0.8,          -- From Kitty: background_image_brightness 1 * opacity 0.8
  hue = 1.0,
  saturation = 0.5,          -- From Kitty: background_image_saturation 0.5
}

-- Import key bindings
local keys_module = require 'modules.keys'
config.keys = keys_module.keys

-- Register theme cycling event
local themes = require 'modules.themes'
wezterm.on('cycle-theme', themes._theme_utils.cycle_theme)

-- Performance settings
config.max_fps = 120
config.prefer_egl = true
config.enable_wayland = true

-- macOS specific settings
config.macos_window_background_blur = 40

-- Terminal behavior
config.exit_behavior = 'Close'
config.automatically_reload_config = true
config.check_for_updates = false

return config
