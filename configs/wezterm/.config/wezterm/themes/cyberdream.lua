-- Cyberdream theme ported from Kitty configuration
local cyberdream = {
  -- Base colors from kitty cyberdream.conf
  foreground = '#c0caf5',
  background = '#1a1b26', 
  cursor_bg = '#bb9af7',
  cursor_fg = '#1a1b26',
  cursor_border = '#bb9af7',
  selection_fg = '#c0caf5',
  selection_bg = '#33467c',
  scrollbar_thumb = '#414868',
  split = '#414868',

  -- ANSI colors (0-7)
  ansi = {
    '#15161e', -- black
    '#f7768e', -- red  
    '#9ece6a', -- green
    '#e0af68', -- yellow
    '#7aa2f7', -- blue
    '#bb9af7', -- magenta
    '#7dcfff', -- cyan
    '#a9b1d6', -- white
  },

  -- Bright ANSI colors (8-15)
  brights = {
    '#414868', -- bright black
    '#ff7a93', -- bright red
    '#b9f27c', -- bright green  
    '#ff9e64', -- bright yellow
    '#7da6ff', -- bright blue
    '#bb9af7', -- bright magenta
    '#2ac3de', -- bright cyan
    '#c0caf5', -- bright white
  },

  -- Tab bar colors
  tab_bar = {
    background = '#1a1b26',
    active_tab = {
      bg_color = '#7aa2f7',
      fg_color = '#1a1b26',
      intensity = 'Bold',
    },
    inactive_tab = {
      bg_color = '#414868',
      fg_color = '#a9b1d6',
    },
    inactive_tab_hover = {
      bg_color = '#565f89',
      fg_color = '#c0caf5',
    },
    new_tab = {
      bg_color = '#1a1b26',
      fg_color = '#a9b1d6',
    },
    new_tab_hover = {
      bg_color = '#414868',
      fg_color = '#7aa2f7',
    },
  },
}

return cyberdream