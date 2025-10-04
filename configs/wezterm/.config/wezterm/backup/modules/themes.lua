local wezterm = require 'wezterm'

-- Import custom themes
local cyberdream = require 'themes.cyberdream'
local pumpkin_spice_theme = require 'themes.pumpkin-spice'

-- Current theme state (can be overridden by user)
local current_theme = 'cyberdream'

-- Define custom Pumpkin Spice theme
local pumpkin_spice = {
  -- Terminal colors
  foreground = '#E8D5B7',
  background = '#2D1B0E',
  cursor_bg = '#FF8C42',
  cursor_fg = '#2D1B0E',
  cursor_border = '#FF8C42',
  selection_fg = '#2D1B0E',
  selection_bg = '#D2691E',
  scrollbar_thumb = '#A0522D',
  split = '#8B4513',

  -- ANSI colors
  ansi = {
    '#3C2415',  -- black
    '#D2691E',  -- red (burnt orange)
    '#228B22',  -- green (forest green)
    '#FF8C42',  -- yellow (pumpkin)
    '#CD853F',  -- blue (peru)
    '#A0522D',  -- magenta (sienna)
    '#8FBC8F',  -- cyan (dark sea green)
    '#F5DEB3',  -- white (wheat)
  },

  -- Bright ANSI colors
  brights = {
    '#5D4037',  -- bright black (brown)
    '#FF6347',  -- bright red (tomato)
    '#32CD32',  -- bright green (lime green)
    '#FFA500',  -- bright yellow (orange)
    '#DEB887',  -- bright blue (burlywood)
    '#D2691E',  -- bright magenta (chocolate)
    '#98FB98',  -- bright cyan (pale green)
    '#FFFAF0',  -- bright white (floral white)
  },

  -- Indexed colors for 256-color support
  indexed = {
    [16] = '#8B4513',  -- saddle brown
    [17] = '#A0522D',  -- sienna
  },

  -- Tab bar colors
  tab_bar = {
    background = '#1A0F08',
    active_tab = {
      bg_color = '#FF8C42',
      fg_color = '#2D1B0E',
      intensity = 'Bold',
    },
    inactive_tab = {
      bg_color = '#3C2415',
      fg_color = '#D2691E',
    },
    inactive_tab_hover = {
      bg_color = '#5D4037',
      fg_color = '#FF8C42',
    },
    new_tab = {
      bg_color = '#2D1B0E',
      fg_color = '#D2691E',
    },
    new_tab_hover = {
      bg_color = '#3C2415',
      fg_color = '#FF8C42',
    },
  },
}

-- Available themes
local themes = {
  cyberdream = { name = 'Cyberdream', colors = cyberdream, icon = '🌃' },
  catppuccin = { name = 'Catppuccin Mocha', colors = nil, icon = '🌙' },
  pumpkin = { name = 'Pumpkin Spice', colors = pumpkin_spice, icon = '🎃' },
  pumpkin_spice = { name = 'Pumpkin Spice Enhanced', colors = pumpkin_spice_theme.colors, icon = '🍂' },
}

local theme_order = { 'cyberdream', 'catppuccin', 'pumpkin', 'pumpkin_spice' }
local current_theme_index = 1

-- Theme cycle function
local function cycle_theme(window, pane)
  local overrides = window:get_config_overrides() or {}
  
  -- Get next theme
  current_theme_index = (current_theme_index % #theme_order) + 1
  local theme_key = theme_order[current_theme_index]
  local theme = themes[theme_key]
  
  current_theme = theme_key
  
  if theme.colors then
    -- Custom color scheme
    overrides.colors = theme.colors
    overrides.color_scheme = nil
  else
    -- Built-in color scheme
    overrides.color_scheme = theme.name
    overrides.colors = nil
  end
  
  window:set_config_overrides(overrides)
  window:toast_notification('WezTerm', 'Switched to ' .. theme.name .. ' theme ' .. theme.icon, nil, 2000)
end

-- Register the theme cycle event
wezterm.on('cycle-theme', cycle_theme)

-- Backward compatibility
wezterm.on('toggle-theme', cycle_theme)

-- Export theme configuration
return {
  -- Default theme (using Cyberdream from Kitty config)
  colors = cyberdream,
  
  -- Register custom color schemes for command palette
  color_schemes = {
    ['Pumpkin Spice'] = pumpkin_spice,
    ['Pumpkin Spice Enhanced'] = pumpkin_spice_theme.colors,
    ['Cyberdream'] = cyberdream,
  },
  
  -- Theme utilities (not directly used by WezTerm config but available for reference)
  _theme_utils = {
    current_theme = function() return current_theme end,
    cycle_theme = cycle_theme,
    themes = themes,
    theme_order = theme_order,
  }
}
