local wezterm = require('wezterm')
local module = {}

-- Font configuration with fallbacks
local font_families = {
  'JetBrainsMono Nerd Font',
  'FiraCode Nerd Font', 
  'Iosevka Term',
  'Cascadia Code',
  'SF Mono',
  'Monaco',
  'Consolas',
  'Ubuntu Mono',
  'DejaVu Sans Mono',
  'Liberation Mono',
}

-- Get font size from environment or use default
function module.getFontSize()
  local size_env = os.getenv('WEZFONT_SIZE')
  if size_env then
    local size = tonumber(size_env)
    if size and size > 0 then
      return size
    end
  end
  return 13.0 -- default size
end

-- Get font configuration
function module.getFont(size)
  size = size or module.getFontSize()
  
  return wezterm.font_with_fallback(font_families, {
    weight = 'Regular',
    stretch = 'Normal',
    style = 'Normal',
  })
end

-- Get bold font
function module.getBoldFont(size)
  size = size or module.getFontSize()
  
  return wezterm.font_with_fallback(font_families, {
    weight = 'Bold',
    stretch = 'Normal', 
    style = 'Normal',
  })
end

-- Get italic font
function module.getItalicFont(size)
  size = size or module.getFontSize()
  
  return wezterm.font_with_fallback(font_families, {
    weight = 'Regular',
    stretch = 'Normal',
    style = 'Italic',
  })
end

-- Get font configuration for config table
function module.getConfig()
  local font_size = module.getFontSize()
  
  return {
    font = module.getFont(font_size),
    font_size = font_size,
    
    -- Font rules for different styles
    font_rules = {
      {
        intensity = 'Bold',
        font = module.getBoldFont(font_size),
      },
      {
        italic = true,
        font = module.getItalicFont(font_size),
      },
      {
        intensity = 'Bold',
        italic = true,
        font = wezterm.font_with_fallback(font_families, {
          weight = 'Bold',
          stretch = 'Normal',
          style = 'Italic',
        }),
      },
    },
    
    -- Additional font settings
    adjust_window_size_when_changing_font_size = false,
    font_antialias = 'Subpixel',
    font_hinting = 'Full',
    
    -- Character width adjustment for better spacing
    cell_width = 1.0,
    
    -- Underline settings
    underline_thickness = 1,
    underline_position = -2,
  }
end

return module