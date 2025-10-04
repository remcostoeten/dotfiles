-- Pumpkin Spice Theme - Enhanced autumn-inspired theme with richer oranges and spice tones
local theme = {}

theme.colors = {
  -- Main terminal colors with deeper, richer tones
  foreground = '#F4E4BC',        -- Creamy vanilla
  background = '#1F0E08',        -- Deep dark chocolate brown
  cursor_bg = '#FF7518',         -- Vibrant pumpkin orange
  cursor_fg = '#1F0E08',         -- Dark background for contrast
  cursor_border = '#FF7518',     -- Matching cursor
  selection_fg = '#F4E4BC',      -- Cream foreground
  selection_bg = '#B8860B',      -- Dark goldenrod
  
  -- UI elements
  scrollbar_thumb = '#A0522D',   -- Sienna brown
  split = '#8B4513',             -- Saddle brown for pane splits
  
  -- Tab bar colors with spice theme
  tab_bar = {
    background = '#0F0704',      -- Very dark coffee brown
    active_tab = {
      bg_color = '#FF7518',      -- Bright pumpkin
      fg_color = '#1F0E08',      -- Dark text
      intensity = 'Bold',
    },
    inactive_tab = {
      bg_color = '#654321',      -- Dark brown
      fg_color = '#D2B48C',      -- Tan
    },
    inactive_tab_hover = {
      bg_color = '#8B4513',      -- Saddle brown
      fg_color = '#FF7518',      -- Pumpkin highlight
    },
    new_tab = {
      bg_color = '#2F1B14',      -- Darker brown
      fg_color = '#CD853F',      -- Peru
    },
    new_tab_hover = {
      bg_color = '#4A2F1F',      -- Medium brown
      fg_color = '#FF7518',      -- Pumpkin highlight
    },
  },

  -- ANSI color palette - autumn spice inspired
  ansi = {
    '#2F1B14',  -- black (dark brown)
    '#CC5500',  -- red (burnt orange)
    '#8B6914',  -- green (dark goldenrod - like dried leaves)
    '#FF8C00',  -- yellow (dark orange)
    '#8B4513',  -- blue (saddle brown - unconventional but thematic)
    '#A0522D',  -- magenta (sienna)
    '#B8860B',  -- cyan (dark goldenrod)
    '#F4E4BC',  -- white (vanilla cream)
  },

  -- Bright ANSI colors - enhanced autumn palette
  brights = {
    '#654321',  -- bright black (dark brown)
    '#FF6347',  -- bright red (tomato)
    '#DAA520',  -- bright green (goldenrod)
    '#FF7518',  -- bright yellow (pumpkin orange)
    '#CD853F',  -- bright blue (peru)
    '#D2691E',  -- bright magenta (chocolate)
    '#F4A460',  -- bright cyan (sandy brown)
    '#FFF8DC',  -- bright white (cornsilk)
  },

  -- Extended colors for 256-color support
  indexed = {
    [16] = '#8B4513',  -- saddle brown
    [17] = '#A0522D',  -- sienna
    [18] = '#D2691E',  -- chocolate
    [19] = '#CD853F',  -- peru
    [20] = '#DEB887',  -- burlywood
    [21] = '#F4A460',  -- sandy brown
  },
}

-- Theme-specific background image (optional)
theme.background_image = 'assets/pumpkin-spice-bg.png'

-- Theme metadata
theme.name = 'Pumpkin Spice'
theme.description = 'Rich autumn spice theme with deep oranges, browns, and cream accents'
theme.author = 'Custom'
theme.season = 'autumn'

return theme