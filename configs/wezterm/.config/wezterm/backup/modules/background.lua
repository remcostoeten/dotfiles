local wezterm = require('wezterm')
local module = {}

-- Get the config directory path
local config_dir = wezterm.config_dir or (os.getenv('HOME') .. '/.config/wezterm')

-- Background configuration
function module.getConfig(theme)
  local config = {}
  
  -- Check if background image is enabled (can be controlled by env var)
  local bg_enabled = os.getenv('WEZTERM_BG_ENABLED')
  if bg_enabled == 'false' or bg_enabled == '0' then
    return config
  end
  
  -- Get background image from theme
  local bg_image = nil
  if theme and theme.background_image then
    bg_image = config_dir .. '/' .. theme.background_image
    
    -- Check if file exists
    local f = io.open(bg_image, 'r')
    if f then
      f:close()
      config.window_background_image = bg_image
    else
      wezterm.log_warn('Background image not found: ' .. bg_image)
    end
  end
  
  -- Background image settings if image is set
  if config.window_background_image then
    config.window_background_image_hsb = {
      brightness = 0.05,  -- Very dim so text is readable
      hue = 1.0,
      saturation = 1.0,
    }
    
    -- Additional background settings
    config.window_background_opacity = 0.95
    config.text_background_opacity = 0.9
  else
    -- Fallback to solid background
    config.window_background_opacity = 0.95
    config.text_background_opacity = 1.0
  end
  
  return config
end

-- List available background images
function module.listBackgrounds()
  local images_dir = config_dir .. '/images'
  local backgrounds = {}
  
  -- Scan for image files
  local dirs_to_scan = { images_dir, images_dir .. '/kitty' }
  
  for _, dir in ipairs(dirs_to_scan) do
    local handle = io.popen('find "' .. dir .. '" -name "*.png" -o -name "*.jpg" -o -name "*.jpeg" 2>/dev/null')
    if handle then
      for file in handle:lines() do
        -- Make path relative to config directory
        local relative_path = file:gsub(config_dir .. '/', '')
        table.insert(backgrounds, relative_path)
      end
      handle:close()
    end
  end
  
  return backgrounds
end

-- Toggle background on/off
function module.toggleBackground()
  local current_state = os.getenv('WEZTERM_BG_ENABLED') or 'true'
  local new_state = (current_state == 'true') and 'false' or 'true'
  
  -- This would need to be implemented with a shell script
  -- that sets the environment variable and restarts wezterm
  return wezterm.action.EmitEvent('toggle-background', new_state)
end

return module