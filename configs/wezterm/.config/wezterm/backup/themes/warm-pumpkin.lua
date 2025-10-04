-- Warm Pumpkin Theme - Autumn-inspired warm oranges and browns
local theme = {}

theme.colors = {
  foreground = '#fdf6e3',
  background = '#2d1b0e',
  cursor_bg = '#ff8c42',
  cursor_fg = '#2d1b0e',
  cursor_border = '#ff8c42',
  selection_fg = '#fdf6e3',
  selection_bg = '#8b4513',
  
  -- Scrollbar
  scrollbar_thumb = '#8b4513',
  
  -- Tab bar colors
  tab_bar = {
    background = '#1a0f08',
    active_tab = {
      bg_color = '#ff8c42',
      fg_color = '#2d1b0e',
      intensity = 'Bold',
    },
    inactive_tab = {
      bg_color = '#8b4513',
      fg_color = '#fdf6e3',
    },
    inactive_tab_hover = {
      bg_color = '#cd853f',
      fg_color = '#2d1b0e',
    },
  },

  -- ANSI color palette
  ansi = {
    '#1a0f08', -- black
    '#d2691e', -- red/orange-red
    '#8fbc8f', -- green
    '#daa520', -- yellow/goldenrod
    '#4682b4', -- blue
    '#da70d6', -- magenta/orchid
    '#20b2aa', -- cyan
    '#fdf6e3', -- white
  },

  -- Bright ANSI colors
  brights = {
    '#8b4513', -- bright black
    '#ff6347', -- bright red/tomato
    '#98fb98', -- bright green
    '#ffff00', -- bright yellow
    '#87ceeb', -- bright blue
    '#dda0dd', -- bright magenta/plum
    '#afeeee', -- bright cyan
    '#fffaf0', -- bright white
  },
}

-- Theme-specific background image
theme.background_image = 'images/pumpkin-gradient.png'

-- Theme metadata
theme.name = 'Warm Pumpkin'
theme.description = 'Autumn-inspired warm theme with pumpkin and harvest colors'

return theme