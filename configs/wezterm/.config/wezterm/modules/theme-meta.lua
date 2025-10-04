local module = {}

-- Modern Gradient theme metadata
module.modern_gradient = {
  -- Background variants
  backgrounds = {
    {
      name = 'Purple Haze',
      type = 'gradient',
      colors = {
        { color = '#0F0D15', stop = 0.0 },
        { color = '#2A1F3D', stop = 0.3 },
        { color = '#4C3A6B', stop = 0.7 },
        { color = '#1E1B2E', stop = 1.0 },
      },
    },
    {
      name = 'Neon Dreams',
      type = 'gradient',
      colors = {
        { color = '#0A0812', stop = 0.0 },
        { color = '#1E0F2E', stop = 0.2 },
        { color = '#2D1B4E', stop = 0.5 },
        { color = '#1A0F2A', stop = 0.8 },
        { color = '#0F0D15', stop = 1.0 },
      },
    },
    {
      name = 'Midnight Glow',
      type = 'solid',
      color = '#0F0D15',
      accent = '#FF6B9D',
    },
  },
  
  -- Effect settings (only valid WezTerm config options)
  effects = {
    window_background_opacity = 0.88,
    text_background_opacity = 0.9,
  },
  
  -- Background image effects (for window_background_image_hsb)
  image_effects = {
    brightness = 0.4,
    hue = 1.0, 
    saturation = 0.8,
  },
}

-- Cyberdream theme metadata
module.cyberdream = {
  effects = {
    window_background_opacity = 0.92,
    text_background_opacity = 1.0,
  },
  -- Background image effects (for window_background_image_hsb)
  image_effects = {
    brightness = 0.8,
    hue = 1.0, 
    saturation = 0.5,
  },
}

-- Get metadata for a theme
function module.getMeta(theme_name)
  return module[theme_name] or {}
end

return module