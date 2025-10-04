-- Pumpkin Gradient Theme - Enhanced autumn theme with gradient background
local wezterm = require 'wezterm'

local theme = {}

-- Define the much darker pumpkin gradient background
theme.window_background_gradient = {
  orientation = 'Vertical',
  colors = {
    '#0D0804',  -- Almost black with hint of brown (top)
    '#1A0E08',  -- Very dark chocolate brown
    '#221308',  -- Dark brown with subtle warmth
    '#2A180A',  -- Slightly warmer dark brown
    '#32200C',  -- Darkest pumpkin undertone (bottom)
  },
  interpolation = 'CatmullRom',
  blend = 'Rgb',
}

theme.colors = {
  -- Main terminal colors with warm pumpkin tones (much darker)
  foreground = '#E8D5C4',        -- Softer warm cream
  background = '#0D0804',        -- Almost black (matches gradient top)
  cursor_bg = '#FF6B1A',         -- Vibrant pumpkin orange
  cursor_fg = '#0D0804',         -- Dark background for contrast
  cursor_border = '#FF6B1A',     -- Matching cursor
  selection_fg = '#E8D5C4',      -- Softer warm cream
  selection_bg = '#4A2E1A',      -- Very dark goldenrod
  
  -- UI elements
  scrollbar_thumb = '#A0522D',   -- Sienna brown
  split = '#8B4513',             -- Saddle brown for pane splits
  
  -- Tab bar colors with gradient-aware styling (much darker)
  tab_bar = {
    background = '#050302',      -- Almost black to complement gradient
    active_tab = {
      bg_color = '#FF6B1A',      -- Vibrant pumpkin
      fg_color = '#0D0804',      -- Almost black text
      intensity = 'Bold',
    },
    inactive_tab = {
      bg_color = '#32200C',      -- Dark warm brown (matches gradient bottom)
      fg_color = '#A68B5B',      -- Muted tan
    },
    inactive_tab_hover = {
      bg_color = '#4A2E1A',      -- Darker brown
      fg_color = '#FF6B1A',      -- Pumpkin highlight
    },
    new_tab = {
      bg_color = '#1A0E08',      -- Very dark brown (matches gradient)
      fg_color = '#8B6914',      -- Dark goldenrod
    },
    new_tab_hover = {
      bg_color = '#2A180A',      -- Slightly warmer dark brown
      fg_color = '#FF6B1A',      -- Pumpkin highlight
    },
  },

  -- ANSI color palette - autumn spice inspired (darker)
  ansi = {
    '#0D0804',  -- black (almost black with brown hint)
    '#B8440A',  -- red (darker burnt orange)
    '#6B4F0F',  -- green (darker goldenrod - like dried leaves)
    '#CC6600',  -- yellow (darker orange)
    '#5A2F0A',  -- blue (very dark brown - thematic)
    '#7A3A1F',  -- magenta (darker sienna)
    '#8B6914',  -- cyan (dark goldenrod)
    '#E8D5C4',  -- white (softer warm cream)
  },

  -- Bright ANSI colors - enhanced autumn palette
  brights = {
    '#32200C',  -- bright black (dark warm brown)
    '#FF4500',  -- bright red (orange red)
    '#B8A520',  -- bright green (muted goldenrod)
    '#FF6B1A',  -- bright yellow (vibrant pumpkin)
    '#A0522D',  -- bright blue (sienna)
    '#CC6600',  -- bright magenta (dark orange)
    '#DAA520',  -- bright cyan (goldenrod)
    '#F5E6D3',  -- bright white (warm cream)
  },

  -- Extended colors for 256-color support
  indexed = {
    [16] = '#8B4513',  -- saddle brown
    [17] = '#A0522D',  -- sienna
    [18] = '#D2691E',  -- chocolate
    [19] = '#CD853F',  -- peru
    [20] = '#DEB887',  -- burlywood
    [21] = '#F4A460',  -- sandy brown
    [22] = '#FF7D42',  -- main pumpkin
    [23] = '#5D3A28',  -- warm gradient brown
  },
}

-- Background image configuration - using your custom bg.webp
theme.window_background_image = wezterm.config_dir .. '/backgrounds/bg.webp'
theme.window_background_image_hsb = {
  brightness = 0.02,  -- Extremely dim for subtle effect
  hue = 1.0,
  saturation = 0.3,   -- Desaturated for subtlety
}

-- Theme metadata
theme.name = 'Dark Pumpkin Gradient'
theme.description = 'Very dark pumpkin theme with gradient background and subtle autumn image'
theme.author = 'Custom'
theme.season = 'autumn'

return theme
