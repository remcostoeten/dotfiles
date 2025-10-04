local wezterm = require 'wezterm'

-- Font configuration based on Kitty settings
-- Kitty config used: JetBrains Mono Nerd Font (size 11.0) and Hack (size 16)
-- Final effective settings: font_size 16, adjust_line_height 118%, letter_spacing 1.2

return {
  -- Primary font configuration (matching Kitty)
  font = wezterm.font_with_fallback {
    {
      family = 'JetBrains Mono Nerd Font', -- Primary from Kitty config
      harfbuzz_features = {
        'calt', -- Contextual alternates
        'liga', -- Standard ligatures
      },
    },
    {
      family = 'Hack', -- Secondary font from Kitty config
      harfbuzz_features = {
        'calt',
        'liga',
      },
    },
    { family = 'Symbols Nerd Font Mono' }, -- Fallback for icons
  },
  
  -- Font size and spacing (from Kitty config)
  font_size = 16,                    -- From Kitty: font_size 16 (final value)
  line_height = 1.18,               -- From Kitty: adjust_line_height 118%
  cell_width = 1.2,                 -- From Kitty: letter_spacing 1.2
  
  -- Font rules for bold and italic (matching Kitty's auto behavior)
  font_rules = {
    {
      intensity = 'Bold',
      font = wezterm.font('JetBrains Mono Nerd Font', {
        weight = 'Bold',
      }),
    },
    {
      italic = true,
      font = wezterm.font('JetBrains Mono Nerd Font', {
        style = 'Italic',
      }),
    },
    {
      intensity = 'Bold',
      italic = true,
      font = wezterm.font('JetBrains Mono Nerd Font', {
        weight = 'Bold',
        style = 'Italic',
      }),
    },
    -- Fallback to Hack for bold/italic if JetBrains Mono Nerd Font not available
    {
      intensity = 'Bold',
      font = wezterm.font('Hack', {
        weight = 'Bold',
      }),
    },
    {
      italic = true,
      font = wezterm.font('Hack', {
        style = 'Italic',
      }),
    },
  },
}