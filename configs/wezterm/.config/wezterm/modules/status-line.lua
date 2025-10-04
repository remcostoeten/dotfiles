local wezterm = require('wezterm')
local module = {}

-- Status line icons
local icons = {
  git_branch = ' ',         -- Git branch
  workspace = ' ',          -- Workspace/folder
  battery_full = ' ',       -- Full battery
  battery_three = ' ',      -- 75% battery
  battery_half = ' ',       -- 50% battery
  battery_quarter = ' ',    -- 25% battery
  battery_empty = ' ',      -- Empty battery
  battery_charging = ' ',   -- Charging
  cpu = ' ',                -- CPU usage
  memory = ' ',             -- Memory usage
  clock = ' ',              -- Clock
  separator = '│',          -- Separator
  arrow_right = '',        -- Arrow right
  arrow_left = '',         -- Arrow left
}

-- Color scheme for status line
local colors = {
  background = '#0F0D15',     -- Dark background
  foreground = '#E8E3F3',     -- Light text
  accent = '#FF6B9D',         -- Pink accent
  secondary = '#7DFF8A',      -- Green accent
  tertiary = '#6BCFFF',       -- Blue accent
  muted = '#B39BC8',          -- Muted text
  separator = '#4C3A6B',      -- Separator color
}

-- Animation state
local animation_state = {
  clock_separator_visible = true,
  last_update = 0,
  blink_interval = 1000, -- 1 second
}

-- Get git branch for current directory
function module.getGitBranch(cwd)
  if not cwd then
    return nil
  end
  
  -- Try to read .git/HEAD
  local git_head = cwd .. '/.git/HEAD'
  local file = io.open(git_head, 'r')
  if not file then
    return nil
  end
  
  local head_content = file:read('*all')
  file:close()
  
  if not head_content then
    return nil
  end
  
  -- Parse branch name from HEAD
  local branch = head_content:match('ref: refs/heads/([^\n\r]+)')
  if branch then
    return branch:gsub('%s+', '') -- Trim whitespace
  end
  
  -- If it's a detached HEAD, show first 7 chars of hash
  local hash = head_content:match('^([a-f0-9]+)')
  if hash then
    return hash:sub(1, 7)
  end
  
  return nil
end

-- Get battery information (Linux/macOS)
function module.getBatteryInfo()
  local battery_info = {}
  
  -- Try Linux first
  local battery_path = '/sys/class/power_supply/BAT0'
  local capacity_file = io.open(battery_path .. '/capacity', 'r')
  local status_file = io.open(battery_path .. '/status', 'r')
  
  if capacity_file and status_file then
    local capacity = tonumber(capacity_file:read('*all'))
    local status = status_file:read('*all'):gsub('%s+', '')
    
    capacity_file:close()
    status_file:close()
    
    battery_info.percentage = capacity
    battery_info.charging = status == 'Charging'
    
    return battery_info
  end
  
  -- Try macOS
  local handle = io.popen('pmset -g batt 2>/dev/null')
  if handle then
    local output = handle:read('*all')
    handle:close()
    
    local percentage = output:match('(%d+)%%')
    local charging = output:match('AC Power') ~= nil
    
    if percentage then
      battery_info.percentage = tonumber(percentage)
      battery_info.charging = charging
      return battery_info
    end
  end
  
  return nil
end

-- Get battery icon based on percentage and charging status
function module.getBatteryIcon(battery_info)
  if not battery_info then
    return nil
  end
  
  if battery_info.charging then
    return icons.battery_charging
  end
  
  local percentage = battery_info.percentage or 0
  if percentage >= 75 then
    return icons.battery_full
  elseif percentage >= 50 then
    return icons.battery_three
  elseif percentage >= 25 then
    return icons.battery_half
  elseif percentage >= 10 then
    return icons.battery_quarter
  else
    return icons.battery_empty
  end
end

-- Get system load (simplified)
function module.getSystemLoad()
  local handle = io.popen('uptime 2>/dev/null')
  if not handle then
    return nil
  end
  
  local output = handle:read('*all')
  handle:close()
  
  -- Parse load average (first number)
  local load = output:match('load average[s]*: ([%d%.]+)')
  if load then
    return tonumber(load)
  end
  
  return nil
end

-- Format clock with blinking separator
function module.getFormattedTime()
  local current_time = os.time()
  local time_str = os.date('%H:%M', current_time)
  
  -- Blink separator every second
  if current_time - animation_state.last_update >= animation_state.blink_interval / 1000 then
    animation_state.clock_separator_visible = not animation_state.clock_separator_visible
    animation_state.last_update = current_time
  end
  
  -- Replace colon with blinking separator
  if animation_state.clock_separator_visible then
    return time_str
  else
    return time_str:gsub(':', ' ')
  end
end

-- Build status line elements
function module.buildStatusElements(window, pane)
  local elements = {}
  local cwd = pane:get_current_working_dir()
  local cwd_path = cwd and cwd.file_path or nil
  
  -- Workspace/directory name
  if cwd_path then
    local workspace_name = string.match(cwd_path, '([^/]+)/?$')
    if workspace_name then
      table.insert(elements, {
        { Foreground = { Color = colors.tertiary } },
        { Text = icons.workspace .. ' ' .. workspace_name },
      })
    end
  end
  
  -- Git branch
  local git_branch = module.getGitBranch(cwd_path)
  if git_branch then
    if #elements > 0 then
      table.insert(elements, {
        { Foreground = { Color = colors.separator } },
        { Text = ' ' .. icons.separator .. ' ' },
      })
    end
    
    table.insert(elements, {
      { Foreground = { Color = colors.secondary } },
      { Text = icons.git_branch .. ' ' .. git_branch },
    })
  end
  
  -- System load
  local load = module.getSystemLoad()
  if load then
    if #elements > 0 then
      table.insert(elements, {
        { Foreground = { Color = colors.separator } },
        { Text = ' ' .. icons.separator .. ' ' },
      })
    end
    
    -- Color code load (green < 1.0, yellow < 2.0, red >= 2.0)
    local load_color = colors.secondary
    if load >= 2.0 then
      load_color = colors.accent -- Red for high load
    elseif load >= 1.0 then
      load_color = '#FFE066' -- Yellow for medium load
    end
    
    table.insert(elements, {
      { Foreground = { Color = load_color } },
      { Text = icons.cpu .. ' ' .. string.format('%.1f', load) },
    })
  end
  
  -- Battery
  local battery_info = module.getBatteryInfo()
  local battery_icon = module.getBatteryIcon(battery_info)
  if battery_icon and battery_info then
    if #elements > 0 then
      table.insert(elements, {
        { Foreground = { Color = colors.separator } },
        { Text = ' ' .. icons.separator .. ' ' },
      })
    end
    
    -- Color code battery (green > 50%, yellow > 20%, red <= 20%)
    local battery_color = colors.secondary
    if battery_info.percentage <= 20 then
      battery_color = colors.accent -- Red for low battery
    elseif battery_info.percentage <= 50 then
      battery_color = '#FFE066' -- Yellow for medium battery
    end
    
    if battery_info.charging then
      battery_color = colors.tertiary -- Blue when charging
    end
    
    table.insert(elements, {
      { Foreground = { Color = battery_color } },
      { Text = battery_icon .. ' ' .. battery_info.percentage .. '%' },
    })
  end
  
  -- Clock (always present)
  if #elements > 0 then
    table.insert(elements, {
      { Foreground = { Color = colors.separator } },
      { Text = ' ' .. icons.separator .. ' ' },
    })
  end
  
  table.insert(elements, {
    { Foreground = { Color = colors.accent } },
    { Text = icons.clock .. ' ' .. module.getFormattedTime() },
  })
  
  return elements
end

-- Setup status line events
function module.setup()
  wezterm.on('update-right-status', function(window, pane)
    local elements = module.buildStatusElements(window, pane)
    
    -- Flatten elements for display
    local status_elements = {}
    for _, element_group in ipairs(elements) do
      for _, element in ipairs(element_group) do
        table.insert(status_elements, element)
      end
    end
    
    -- Add padding
    table.insert(status_elements, 1, { Text = ' ' })
    table.insert(status_elements, { Text = ' ' })
    
    window:set_right_status(wezterm.format(status_elements))
  end)
  
  -- Update status every second for clock animation
  wezterm.time.call_after(1, function()
    wezterm.emit('update-right-status')
    -- Recursively call to keep updating
    wezterm.time.call_after(1, function()
      wezterm.emit('update-right-status')
    end)
  end)
end

return module