local wezterm = require 'wezterm'
local config = wezterm.config_builder()
local act = wezterm.action

-- 🎨 DARK PUMPKIN THEME with your background image
local pumpkin_theme = require 'themes.pumpkin-gradient'
config.colors = pumpkin_theme.colors
config.window_background_gradient = pumpkin_theme.window_background_gradient

-- 🖼️ Your background image (very subtle)
config.window_background_image =
  '/home/remco-stoeten/.config/wezterm/backgrounds/dark.png'
config.window_background_image_hsb = {
  brightness = 0.3, -- Slightly more subtle
  hue = 1.0,
  saturation = 0.8, -- Slightly desaturated for elegance
}

-- Refined opacity for better aesthetics
config.window_background_opacity = 0.92
config.text_background_opacity = 1.0

-- 🚫 HIDE TAB BAR (while keeping tab functionality)
config.enable_tab_bar = false
config.use_fancy_tab_bar = false
config.hide_tab_bar_if_only_one_tab = true
config.show_tab_index_in_tab_bar = false

-- 🔤 Font configuration
config.font = wezterm.font_with_fallback {
  {
    family = 'JetBrains Mono Nerd Font',
    weight = 'Medium',
    harfbuzz_features = { 'calt=1', 'liga=1', 'ss01=1', 'ss02=1', 'zero=1' },
  },
  { family = 'Symbols Nerd Font Mono' },
}
config.font_size = 16.0
config.line_height = 1.2
config.freetype_load_target = 'Light'
config.freetype_render_target = 'HorizontalLcd'

-- 🪟 Enhanced window appearance
config.window_decorations = 'NONE'
config.window_padding = { left = 16, right = 16, top = 12, bottom = 12 }
config.window_frame = {
  border_left_width = 0,
  border_right_width = 0,
  border_bottom_height = 0,
  border_top_height = 0,
}
config.enable_wayland = true
config.adjust_window_size_when_changing_font_size = false

-- ✨ Cursor configuration
config.default_cursor_style = 'BlinkingBar'
config.cursor_blink_rate = 600
config.cursor_thickness = '2px'

-- ⚡ Performance optimizations
config.max_fps = 144
config.front_end = 'WebGpu'
config.webgpu_power_preference = 'HighPerformance'
config.enable_kitty_graphics = true

-- 🔇 Disable audio bell
config.audible_bell = 'Disabled'

-- 📜 Scrollback configuration
config.scrollback_lines = 10000
config.enable_scroll_bar = false

-- 🎯 Tab and pane management keybindings
config.keys = {
  -- Tab management (hidden but functional)
  { key = 't', mods = 'CTRL|SHIFT', action = act.SpawnTab 'CurrentPaneDomain' },
  { key = 'w', mods = 'CTRL|SHIFT', action = act.CloseCurrentTab { confirm = false } },
  
  -- Tab navigation with Alt + number
  { key = '1', mods = 'ALT', action = act.ActivateTab(0) },
  { key = '2', mods = 'ALT', action = act.ActivateTab(1) },
  { key = '3', mods = 'ALT', action = act.ActivateTab(2) },
  { key = '4', mods = 'ALT', action = act.ActivateTab(3) },
  { key = '5', mods = 'ALT', action = act.ActivateTab(4) },
  { key = '6', mods = 'ALT', action = act.ActivateTab(5) },
  { key = '7', mods = 'ALT', action = act.ActivateTab(6) },
  { key = '8', mods = 'ALT', action = act.ActivateTab(7) },
  { key = '9', mods = 'ALT', action = act.ActivateTab(8) },
  
  -- Tab navigation with Alt + Tab
  { key = 'Tab', mods = 'ALT', action = act.ActivateTabRelative(1) },
  { key = 'Tab', mods = 'ALT|SHIFT', action = act.ActivateTabRelative(-1) },
  
  -- Pane management
  { key = 'd', mods = 'CTRL|SHIFT', action = act.SplitHorizontal { domain = 'CurrentPaneDomain' } },
  { key = 'D', mods = 'CTRL|SHIFT', action = act.SplitVertical { domain = 'CurrentPaneDomain' } },
  { key = 'h', mods = 'CTRL|SHIFT', action = act.ActivatePaneDirection 'Left' },
  { key = 'j', mods = 'CTRL|SHIFT', action = act.ActivatePaneDirection 'Down' },
  { key = 'k', mods = 'CTRL|SHIFT', action = act.ActivatePaneDirection 'Up' },
  { key = 'l', mods = 'CTRL|SHIFT', action = act.ActivatePaneDirection 'Right' },
  
  -- Resize panes
  { key = 'LeftArrow', mods = 'CTRL|SHIFT', action = act.AdjustPaneSize { 'Left', 2 } },
  { key = 'RightArrow', mods = 'CTRL|SHIFT', action = act.AdjustPaneSize { 'Right', 2 } },
  { key = 'UpArrow', mods = 'CTRL|SHIFT', action = act.AdjustPaneSize { 'Up', 2 } },
  { key = 'DownArrow', mods = 'CTRL|SHIFT', action = act.AdjustPaneSize { 'Down', 2 } },
  
  -- Font size adjustment
  { key = '=', mods = 'CTRL', action = act.IncreaseFontSize },
  { key = '-', mods = 'CTRL', action = act.DecreaseFontSize },
  { key = '0', mods = 'CTRL', action = act.ResetFontSize },
  
  -- Copy/paste
  { key = 'c', mods = 'CTRL|SHIFT', action = act.CopyTo 'Clipboard' },
  { key = 'v', mods = 'CTRL|SHIFT', action = act.PasteFrom 'Clipboard' },
  
  -- Search
  { key = 'f', mods = 'CTRL|SHIFT', action = act.Search 'CurrentSelectionOrEmptyString' },
}

-- 🖱️ Mouse bindings
config.mouse_bindings = {
  {
    event = { Up = { streak = 1, button = 'Left' } },
    mods = 'CTRL',
    action = act.OpenLinkAtMouseCursor,
  },
  {
    event = { Down = { streak = 3, button = 'Left' } },
    action = act.SelectTextAtMouseCursor 'Line',
    mods = 'NONE',
  },
}

return config
