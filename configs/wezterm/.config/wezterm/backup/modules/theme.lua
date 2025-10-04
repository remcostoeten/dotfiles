local wezterm = require('wezterm')
local module = {}

-- Available themes
local available_themes = {
  'cozy-candy',
  'warm-pumpkin',
}

-- Load theme by name
function module.loadTheme(theme_name)
  local theme_name_normalized = theme_name or 'cozy-candy'
  
  -- Check if theme exists
  local theme_exists = false
  for _, available in ipairs(available_themes) do
    if available == theme_name_normalized then
      theme_exists = true
      break
    end
  end
  
  -- Fallback to default theme if not found
  if not theme_exists then
    wezterm.log_warn('Theme "' .. theme_name_normalized .. '" not found, falling back to cozy-candy')
    theme_name_normalized = 'cozy-candy'
  end
  
  -- Load the theme file
  local theme_path = 'themes.' .. theme_name_normalized
  local ok, theme = pcall(require, theme_path)
  
  if not ok then
    wezterm.log_error('Failed to load theme: ' .. theme_name_normalized .. ', error: ' .. tostring(theme))
    -- Fallback theme
    return require('themes.cozy-candy')
  end
  
  return theme
end

-- Get list of available themes
function module.getAvailableThemes()
  return available_themes
end

-- Create theme switch command
function module.createThemeSwitchAction(new_theme)
  return wezterm.action.EmitEvent('switch-theme', new_theme)
end

return module