local wezterm = require('wezterm')
local module = {}

-- Powerline separators and icons
local separators = {
  left = '',    -- U+E0B0
  right = '',   -- U+E0B2
  thin_left = '', -- U+E0B1
  thin_right = '', -- U+E0B3
}

-- Process icons (Nerd Font glyphs)
local process_icons = {
  ['bash'] = ' ',          -- Terminal icon
  ['zsh'] = ' ',           -- Terminal icon
  ['fish'] = ' ',          -- Terminal icon
  ['nu'] = ' ',            -- Terminal icon
  ['powershell'] = ' ',    -- PowerShell icon
  ['pwsh'] = ' ',          -- PowerShell icon
  ['cmd'] = ' ',           -- Command prompt
  ['nvim'] = ' ',          -- Neovim icon
  ['vim'] = ' ',           -- Vim icon
  ['git'] = ' ',           -- Git icon
  ['python'] = ' ',        -- Python icon
  ['node'] = ' ',          -- Node.js icon
  ['npm'] = ' ',           -- NPM icon
  ['yarn'] = ' ',          -- Yarn icon
  ['cargo'] = ' ',         -- Rust Cargo
  ['rustc'] = ' ',         -- Rust
  ['go'] = ' ',            -- Go
  ['docker'] = ' ',        -- Docker
  ['kubectl'] = '☸ ',       -- Kubernetes
  ['ssh'] = ' ',           -- SSH
  ['top'] = ' ',           -- Process monitor
  ['htop'] = ' ',          -- Process monitor
  ['btop'] = ' ',          -- Process monitor
  ['nano'] = ' ',          -- Text editor
  ['emacs'] = ' ',         -- Emacs
  ['code'] = ' ',          -- VS Code
  ['make'] = ' ',          -- Build tool
  ['cmake'] = ' ',         -- Build tool
  ['lazygit'] = ' ',       -- Git TUI
  ['tig'] = ' ',           -- Git TUI
}

-- Get process icon
function module.getProcessIcon(process_name)
  if not process_name then
    return ' '  -- Default terminal icon
  end
  
  local basename = string.match(process_name, '([^/\\]+)$') or process_name
  return process_icons[basename] or ' '
end

-- Format tab title with icon and process info
function module.formatTabTitle(tab)
  local title = tab.tab_title
  local pane = tab.active_pane
  local process_name = pane and pane.foreground_process_name or nil
  
  -- Use process name if no custom title
  if not title or title == '' then
    if process_name then
      local basename = string.match(process_name, '([^/\\]+)$') or process_name
      title = basename
    else
      title = 'Terminal'
    end
  end
  
  -- Get process icon
  local icon = module.getProcessIcon(process_name)
  
  -- Format: icon + title (limited length)
  local max_title_length = 16
  if #title > max_title_length then
    title = string.sub(title, 1, max_title_length - 1) .. '…'
  end
  
  return icon .. ' ' .. title
end

-- Custom tab bar formatting
function module.formatTab(tab, tabs, panes, config, hover, max_width)
  local theme = config.colors or {}
  local tab_bar = theme.tab_bar or {}
  
  -- Get colors
  local bg_color, fg_color
  local next_bg_color = tab_bar.background or '#1a1b26'
  
  if tab.is_active then
    bg_color = tab_bar.active_tab and tab_bar.active_tab.bg_color or '#7aa2f7'
    fg_color = tab_bar.active_tab and tab_bar.active_tab.fg_color or '#1a1b26'
  elseif hover then
    bg_color = tab_bar.inactive_tab_hover and tab_bar.inactive_tab_hover.bg_color or '#565f89'
    fg_color = tab_bar.inactive_tab_hover and tab_bar.inactive_tab_hover.fg_color or '#c0caf5'
  else
    bg_color = tab_bar.inactive_tab and tab_bar.inactive_tab.bg_color or '#414868'
    fg_color = tab_bar.inactive_tab and tab_bar.inactive_tab.fg_color or '#a9b1d6'
  end
  
  -- Get next tab color for separator
  local next_tab_index = tab.tab_index + 1
  if next_tab_index < #tabs then
    local next_tab = tabs[next_tab_index + 1] -- tabs is 1-indexed
    if next_tab and next_tab.is_active then
      next_bg_color = tab_bar.active_tab and tab_bar.active_tab.bg_color or '#7aa2f7'
    else
      next_bg_color = tab_bar.inactive_tab and tab_bar.inactive_tab.bg_color or '#414868'
    end
  end
  
  -- Format tab content
  local title = module.formatTabTitle(tab)
  
  -- Build tab with powerline separators
  local elements = {}
  
  -- Left padding
  table.insert(elements, { Background = { Color = bg_color } })
  table.insert(elements, { Foreground = { Color = fg_color } })
  table.insert(elements, { Text = ' ' .. title .. ' ' })
  
  -- Right separator (powerline)
  if not tab.is_active or tab.tab_index < #tabs - 1 then
    table.insert(elements, { Foreground = { Color = bg_color } })
    table.insert(elements, { Background = { Color = next_bg_color } })
    table.insert(elements, { Text = separators.left })
  end
  
  return elements
end

-- Tab bar configuration
function module.getConfig()
  return {
    use_fancy_tab_bar = false,
    tab_bar_at_bottom = false,
    hide_tab_bar_if_only_one_tab = false,
    show_tab_index_in_tab_bar = false,  -- We'll show icons instead
    show_new_tab_button_in_tab_bar = true,
    
    -- Tab styling
    tab_max_width = 32,
    
    -- Custom tab formatting will be set via event handlers
  }
end

-- Register event handlers
function module.setup()
  -- Custom tab formatting
  wezterm.on('format-tab-title', function(tab, tabs, panes, config, hover, max_width)
    return module.formatTab(tab, tabs, panes, config, hover, max_width)
  end)
  
  -- New tab button customization
  wezterm.on('new-tab-button-click', function(window, pane, button, default_action)
    if button == 'Left' then
      return default_action
    elseif button == 'Right' then
      -- Right click shows tab menu or workspace switcher
      return wezterm.action.ShowLauncher
    end
    return default_action
  end)
end

return module