-- Modern Gradient Theme for WezTerm
-- Features pastel-neon colors with dynamic gradient backgrounds

local modern_gradient = {
  -- Base colors with enhanced contrast and vibrancy
  foreground = '#F0E6FF',        -- Brighter lavender white
  background = '#0A0612',        -- Even deeper purple-black
  cursor_bg = '#FF6B9D',         -- Bright pink cursor
  cursor_fg = '#0A0612',         -- Dark cursor text
  cursor_border = '#FF6B9D',     -- Matching cursor border
  selection_fg = '#F0E6FF',      -- Bright selection text
  selection_bg = '#5D4A7A',      -- More vibrant purple selection
  scrollbar_thumb = '#4C3A6B',   -- Visible scrollbar
  split = '#7DFF8A',             -- Bright mint pane split

  -- ANSI colors - Modern pastel-neon palette
  ansi = {
    '#1E1B2E',  -- black (deep purple)
    '#FF6B9D',  -- red (bright pink)
    '#7DFF8A',  -- green (bright mint)
    '#FFE066',  -- yellow (golden yellow)
    '#6BCFFF',  -- blue (sky blue)
    '#D082FF',  -- magenta (soft purple)
    '#66F5F5',  -- cyan (bright cyan)
    '#E8E3F3',  -- white (soft lavender)
  },

  -- Bright ANSI colors - Enhanced versions
  brights = {
    '#3D2A5C',  -- bright black (medium purple)
    '#FF8FB8',  -- bright red (softer pink)
    '#9EFFA8',  -- bright green (lighter mint)
    '#FFF081',  -- bright yellow (lighter gold)
    '#8ADDFF',  -- bright blue (lighter sky)
    '#E6A3FF',  -- bright magenta (lighter purple)
    '#85FFFF',  -- bright cyan (lighter cyan)
    '#FFFFFF',  -- bright white (pure white)
  },

  -- Indexed colors for extended palette
  indexed = {
    [16] = '#2A1F3D',  -- Dark purple
    [17] = '#5D4A7A',  -- Medium purple
    [18] = '#FF9AC1',  -- Light pink
    [19] = '#B3E5D1',  -- Mint cream
    [20] = '#FFE5B3',  -- Cream yellow
    [21] = '#B3D9FF',  -- Light blue
  },

  -- Tab bar with enhanced gradient-inspired colors
  tab_bar = {
    background = '#050308',      -- Very dark background for contrast
    active_tab = {
      bg_color = '#FF6B9D',      -- Bright pink active tab
      fg_color = '#0A0612',      -- Very dark text on bright background
      intensity = 'Bold',
    },
    inactive_tab = {
      bg_color = '#2A1F3D',      -- Dark purple inactive
      fg_color = '#C7B8E8',      -- Brighter lavender text
    },
    inactive_tab_hover = {
      bg_color = '#4C3A6B',      -- More vibrant purple on hover
      fg_color = '#F0E6FF',      -- Very bright text on hover
    },
    new_tab = {
      bg_color = '#1E1B2E',      -- Dark new tab button
      fg_color = '#7DFF8A',      -- Mint green plus sign
    },
    new_tab_hover = {
      bg_color = '#3D2A5C',      -- Purple hover
      fg_color = '#9EFFA8',      -- Brighter mint on hover
    },
  },

  -- Note: window_frame is configured separately in the main config
  -- as it's not part of the colors palette in recent WezTerm versions
}

return modern_gradient
