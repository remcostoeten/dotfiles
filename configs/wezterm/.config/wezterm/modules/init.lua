local wezterm = require('wezterm')
local theme_loader = require('modules.theme')
local aesthetics = require('modules.aesthetics')
local fonts = require('modules.fonts')
local background = require('modules.background')
local keys = require('modules.keys')

local module = {}

-- Deep merge function to combine configuration tables
local function merge_config(base, ...)
  local result = {}
  
  -- Copy base configuration
  for k, v in pairs(base) do
    if type(v) == 'table' then
      result[k] = merge_config(v)
    else
      result[k] = v
    end
  end
  
  -- Merge additional configurations
  for _, config in ipairs({...}) do
    for k, v in pairs(config) do
      if type(v) == 'table' and type(result[k]) == 'table' then
        result[k] = merge_config(result[k], v)
      else
        result[k] = v
      end
    end
  end
  
  return result
end

-- Build complete configuration for given theme
function module.buildConfig(theme_name)
  local theme_name_normalized = theme_name or 'cozy-candy'
  
  -- Load theme
  local theme = theme_loader.loadTheme(theme_name_normalized)
  
  -- Get configuration from each module
  local aesthetic_config = aesthetics.getConfig()
  local font_config = fonts.getConfig()
  local background_config = background.getConfig(theme)
  local keys_config = keys.getConfig()
  
  -- Base configuration
  local base_config = {
    -- Performance and behavior
    scrollback_lines = 10000,
    enable_wayland = true,
    
    -- Window behavior
    window_close_confirmation = 'NeverPrompt',
    
    -- Color scheme from theme
    colors = theme.colors,
    
    -- Multiplexing
    unix_domains = {
      {
        name = 'unix',
      },
    },
    
    -- Default domain
    default_domain = 'unix',
    
    -- Status update frequency
    status_update_interval = 1000,
    
    -- Logging
    log_unknown_escape_sequences = false,
    
    -- Bell
    audible_bell = 'Disabled',
    
    -- Hyperlink rules
    hyperlink_rules = {
      -- URL detection
      {
        regex = '\\b\\w+://[\\w.-]+\\.[a-z]{2,15}\\S*\\b',
        format = '$0',
      },
      -- Email detection
      {
        regex = '\\b\\w+@[\\w.-]+\\.\\w+\\b',
        format = 'mailto:$0',
      },
      -- File paths
      {
        regex = '["/~]([\\w/.-]+)',
        format = 'file://$0',
      },
    },
  }
  
  -- Merge all configurations
  local final_config = merge_config(
    base_config,
    aesthetic_config,
    font_config,
    background_config,
    keys_config
  )
  
  -- Add theme metadata to config for debugging
  final_config._theme_name = theme_name_normalized
  final_config._theme_description = theme.description
  
  return final_config
end

-- Event handlers
function module.setupEvents()
  wezterm.on('toggle-background', function(window, pane, state)
    -- This would need shell integration to persist the environment variable
    wezterm.log_info('Background toggle requested: ' .. tostring(state))
  end)
  
  wezterm.on('switch-theme', function(window, pane, new_theme)
    -- This would need to reload the configuration
    wezterm.log_info('Theme switch requested: ' .. tostring(new_theme))
  end)
  
  -- Status line (if tab bar is enabled)
  wezterm.on('update-right-status', function(window, pane)
    local theme_name = os.getenv('WEZTHEME') or 'cozy-candy'
    window:set_right_status(wezterm.format {
      { Foreground = { AnsiColor = 'Blue' } },
      { Text = theme_name },
    })
  end)
end

-- Initialize event handlers
module.setupEvents()

return module