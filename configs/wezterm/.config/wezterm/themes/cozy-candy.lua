-- Cozy Candy Theme - Warm, comfortable colors with candy-like accents
local theme = {}

theme.colors = {
  foreground = '#f8f8f2',
  background = '#282a36',
  cursor_bg = '#ff79c6',
  cursor_fg = '#282a36',
  cursor_border = '#ff79c6',
  selection_fg = '#f8f8f2',
  selection_bg = '#44475a',
  
  -- Scrollbar
  scrollbar_thumb = '#44475a',
  
  -- Tab bar colors
  tab_bar = {
    background = '#21222c',
    active_tab = {
      bg_color = '#bd93f9',
      fg_color = '#282a36',
      intensity = 'Bold',
    },
    inactive_tab = {
      bg_color = '#44475a',
      fg_color = '#f8f8f2',
    },
    inactive_tab_hover = {
      bg_color = '#6272a4',
      fg_color = '#f8f8f2',
    },
  },

  -- ANSI color palette
  ansi = {
    '#21222c', -- black
    '#ff5555', -- red
    '#50fa7b', -- green
    '#f1fa8c', -- yellow
    '#bd93f9', -- blue
    '#ff79c6', -- magenta/pink
    '#8be9fd', -- cyan
    '#f8f8f2', -- white
  },

  -- Bright ANSI colors
  brights = {
    '#6272a4', -- bright black
    '#ff6e6e', -- bright red
    '#69ff94', -- bright green
    '#ffffa5', -- bright yellow
    '#d6acff', -- bright blue
    '#ff92df', -- bright magenta
    '#a4ffff', -- bright cyan
    '#ffffff', -- bright white
  },
}

-- Theme-specific background image
theme.background_image = 'images/kitty/bg-blurred.png'

-- Theme metadata
theme.name = 'Cozy Candy'
theme.description = 'A warm, comfortable theme with candy-like accent colors'

return theme