local wezterm = require('wezterm')
local theme_meta = require('modules.theme-meta')
local module = {}

-- Get the config directory path
local config_dir = wezterm.config_dir or (os.getenv('HOME') .. '/.config/wezterm')

-- Background state management
local background_state = {
  current_index = 1,
  opacity_levels = { 1.0, 0.88, 0.75, 0.65 },
  current_opacity_index = 2, -- Start with 0.88
}

-- Available background types
local background_types = {
  {
    name = 'Solid with Blur',
    type = 'solid',
    opacity = 0.88,
    blur = true,
    effects = {
      brightness = 1.0,
      hue = 1.0,
      saturation = 1.0,
    },
  },
  {
    name = 'Gradient Purple',
    type = 'gradient',
    opacity = 0.85,
    gradient_colors = {
      '#0F0D15', -- Deep purple-black
      '#2A1F3D', -- Dark purple
      '#1E1B2E', -- Medium purple
    },
    effects = {
      brightness = 0.9,
      hue = 1.0,
      saturation = 1.1,
    },
  },
  {
    name = 'Image with Overlay',
    type = 'image',
    image_path = 'assets/bg-blurred.png',
    opacity = 0.92,
    effects = {
      brightness = 0.4,
      hue = 1.0,
      saturation = 0.8,
    },
  },
  {
    name = 'Transparent Glass',
    type = 'glass',
    opacity = 0.65,
    blur = true,
    effects = {
      brightness = 1.2,
      hue = 1.0,
      saturation = 0.9,
    },
  },
}

-- Background configuration
function module.getConfig(theme, theme_name)
  local config = {}
  
  -- Check if background is enabled
  local bg_enabled = os.getenv('WEZTERM_BG_ENABLED')
  if bg_enabled == 'false' or bg_enabled == '0' then
    return { window_background_opacity = 1.0 }
  end
  
  -- Get current background type
  local current_bg = background_types[background_state.current_index]
  local current_opacity = background_state.opacity_levels[background_state.current_opacity_index]
  
  -- Apply opacity
  config.window_background_opacity = current_opacity
  config.text_background_opacity = math.min(current_opacity + 0.1, 1.0)
  
  -- Handle different background types
  if current_bg.type == 'image' then
    local bg_image = config_dir .. '/' .. current_bg.image_path
    local f = io.open(bg_image, 'r')
    if f then
      f:close()
      config.window_background_image = bg_image
      config.window_background_image_hsb = current_bg.effects
    else
      wezterm.log_warn('Background image not found: ' .. bg_image)
      -- Fallback to solid
      current_bg = background_types[1]
    end
  end
  
  -- Apply blur effects for supported systems  
  if current_bg.blur then
    config.macos_window_background_blur = 25
  end
  
  -- Apply theme-specific effects if available
  local meta = theme_meta.getMeta(theme_name or 'modern_gradient')
  if meta and meta.effects then
    -- Only apply valid WezTerm configuration options
    local valid_options = {
      'window_background_opacity',
      'text_background_opacity',
    }
    
    for _, key in ipairs(valid_options) do
      if meta.effects[key] then
        local value = meta.effects[key]
        if key == 'window_background_opacity' then
          config[key] = math.min(value, current_opacity)
        else
          config[key] = value
        end
      end
    end
  end
  
  -- Apply image effects if background image is set
  if config.window_background_image and meta and meta.image_effects then
    config.window_background_image_hsb = meta.image_effects
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

-- Cycle through background types
function module.cycleBackground(window, pane)
  background_state.current_index = (background_state.current_index % #background_types) + 1
  local current_bg = background_types[background_state.current_index]
  
  -- Apply new background immediately
  local overrides = window:get_config_overrides() or {}
  local theme = require('themes.modern-gradient') -- Default to modern gradient
  local bg_config = module.getConfig(theme)
  
  -- Apply background config to overrides
  for key, value in pairs(bg_config) do
    overrides[key] = value
  end
  
  window:set_config_overrides(overrides)
  window:toast_notification('WezTerm', 'Background: ' .. current_bg.name, nil, 2000)
end

-- Cycle through opacity levels
function module.cycleOpacity(window, pane)
  background_state.current_opacity_index = (background_state.current_opacity_index % #background_state.opacity_levels) + 1
  local new_opacity = background_state.opacity_levels[background_state.current_opacity_index]
  
  local overrides = window:get_config_overrides() or {}
  overrides.window_background_opacity = new_opacity
  overrides.text_background_opacity = math.min(new_opacity + 0.1, 1.0)
  
  window:set_config_overrides(overrides)
  window:toast_notification('WezTerm', string.format('Opacity: %.0f%%', new_opacity * 100), nil, 1500)
end

-- Toggle background on/off
function module.toggleBackground(window, pane)
  local overrides = window:get_config_overrides() or {}
  local current_opacity = overrides.window_background_opacity or 0.92
  
  if current_opacity < 1.0 then
    -- Turn off transparency
    overrides.window_background_opacity = 1.0
    overrides.text_background_opacity = 1.0
    overrides.window_background_image = nil
    overrides.macos_window_background_blur = nil
    window:toast_notification('WezTerm', 'Background: Disabled', nil, 1500)
  else
    -- Restore previous transparency
    local theme = require('themes.modern-gradient')
    local bg_config = module.getConfig(theme)
    for key, value in pairs(bg_config) do
      overrides[key] = value
    end
    window:toast_notification('WezTerm', 'Background: Enabled', nil, 1500)
  end
  
  window:set_config_overrides(overrides)
end

-- Get current background info
function module.getCurrentBackground()
  return {
    type = background_types[background_state.current_index],
    opacity = background_state.opacity_levels[background_state.current_opacity_index],
    index = background_state.current_index,
    opacity_index = background_state.current_opacity_index,
  }
end

return module
