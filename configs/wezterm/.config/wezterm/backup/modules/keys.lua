local wezterm = require 'wezterm'
local act = wezterm.action

return {
  keys = {
    -- Theme cycling (F12) - Enhanced from Kitty toggle
    {
      key = 'F12',
      action = wezterm.action.EmitEvent 'cycle-theme',
    },
    
    -- Reload configuration (from Kitty config)
    {
      key = 'r',
      mods = 'SUPER|SHIFT',                        -- From Kitty: cmd+shift+r
      action = act.ReloadConfiguration,            -- From Kitty: load_config_file
    },
    {
      key = 'R',
      mods = 'CTRL|SHIFT',                         -- Fallback for non-Mac
      action = act.ReloadConfiguration,
    },
    
    -- Copy/Paste
    {
      key = 'C',
      mods = 'CTRL|SHIFT',
      action = act.CopyTo 'Clipboard',
    },
    {
      key = 'V',
      mods = 'CTRL|SHIFT',
      action = act.PasteFrom 'Clipboard',
    },
    
    -- Tab management (from Kitty config)
    {
      key = 't',
      mods = 'SUPER',                              -- From Kitty: cmd+t
      action = act.SpawnTab 'CurrentPaneDomain',   -- From Kitty: new_tab_with_cwd
    },
    {
      key = 'w',
      mods = 'SUPER',                              -- From Kitty: cmd+w
      action = act.CloseCurrentTab { confirm = false }, -- From Kitty: close_tab
    },
    -- Fallback for non-Mac systems
    {
      key = 'T',
      mods = 'CTRL|SHIFT',
      action = act.SpawnTab 'CurrentPaneDomain',
    },
    {
      key = 'W',
      mods = 'CTRL|SHIFT', 
      action = act.CloseCurrentTab { confirm = false },
    },
    
    -- Tab navigation (from Kitty config)
    {
      key = ']',
      mods = 'SUPER|SHIFT',                        -- From Kitty: cmd+shift+]
      action = act.ActivateTabRelative(1),         -- From Kitty: next_tab
    },
    {
      key = '[',
      mods = 'SUPER|SHIFT',                        -- From Kitty: cmd+shift+[
      action = act.ActivateTabRelative(-1),        -- From Kitty: previous_tab
    },
    -- Direct tab access (from Kitty config)
    {
      key = '1',
      mods = 'SUPER',                              -- From Kitty: cmd+1
      action = act.ActivateTab(0),                 -- From Kitty: goto_tab 1
    },
    {
      key = '2', 
      mods = 'SUPER',
      action = act.ActivateTab(1),
    },
    {
      key = '3',
      mods = 'SUPER', 
      action = act.ActivateTab(2),
    },
    {
      key = '4',
      mods = 'SUPER',
      action = act.ActivateTab(3),
    },
    {
      key = '5',
      mods = 'SUPER',
      action = act.ActivateTab(4),
    },
    -- Fallback tab navigation for non-Mac
    {
      key = 'Tab',
      mods = 'CTRL',
      action = act.ActivateTabRelative(1),
    },
    {
      key = 'Tab',
      mods = 'CTRL|SHIFT',
      action = act.ActivateTabRelative(-1),
    },
    
    -- Pane splitting
    {
      key = 'Space',
      mods = 'CTRL',
      action = act.SplitHorizontal { domain = 'CurrentPaneDomain' }, -- Split pane (Ctrl+Space)
    },
    {
      key = 'D',
      mods = 'CTRL|SHIFT',
      action = act.SplitHorizontal { domain = 'CurrentPaneDomain' }, -- Split right
    },
    {
      key = 'D',
      mods = 'CTRL|ALT',
      action = act.SplitVertical { domain = 'CurrentPaneDomain' }, -- Split down
    },
    
    -- Pane navigation
    {
      key = '`',
      mods = 'CTRL',
      action = act.ActivatePaneDirection 'Next', -- Cycle through panes (Ctrl+`)
    },
    {
      key = 'LeftArrow',
      mods = 'CTRL|SHIFT',
      action = act.ActivatePaneDirection 'Left',
    },
    {
      key = 'RightArrow',
      mods = 'CTRL|SHIFT',
      action = act.ActivatePaneDirection 'Right',
    },
    {
      key = 'UpArrow',
      mods = 'CTRL|SHIFT',
      action = act.ActivatePaneDirection 'Up',
    },
    {
      key = 'DownArrow',
      mods = 'CTRL|SHIFT',
      action = act.ActivatePaneDirection 'Down',
    },
    
    -- Pane resizing
    {
      key = 'LeftArrow',
      mods = 'CTRL|ALT',
      action = act.AdjustPaneSize { 'Left', 5 },
    },
    {
      key = 'RightArrow',
      mods = 'CTRL|ALT',
      action = act.AdjustPaneSize { 'Right', 5 },
    },
    {
      key = 'UpArrow',
      mods = 'CTRL|ALT',
      action = act.AdjustPaneSize { 'Up', 5 },
    },
    {
      key = 'DownArrow',
      mods = 'CTRL|ALT',
      action = act.AdjustPaneSize { 'Down', 5 },
    },
    
    -- Close pane
    {
      key = 'X',
      mods = 'CTRL|SHIFT',
      action = act.CloseCurrentPane { confirm = true },
    },
    
    -- Font size adjustment (from Kitty config)
    {
      key = '+',
      mods = 'SUPER|SHIFT',                        -- From Kitty: cmd+shift+plus
      action = act.IncreaseFontSize,               -- From Kitty: change_font_size all +2.0
    },
    {
      key = '-',
      mods = 'SUPER|SHIFT',                        -- From Kitty: cmd+shift+minus
      action = act.DecreaseFontSize,               -- From Kitty: change_font_size all -2.0
    },
    {
      key = '0',
      mods = 'SUPER',                              -- From Kitty: cmd+0
      action = act.ResetFontSize,                  -- From Kitty: change_font_size all 0
    },
    -- Fallback for non-Mac systems
    {
      key = '=',
      mods = 'CTRL',
      action = act.IncreaseFontSize,
    },
    {
      key = '-',
      mods = 'CTRL',
      action = act.DecreaseFontSize,
    },
    {
      key = '0',
      mods = 'CTRL',
      action = act.ResetFontSize,
    },
    
    -- Scrollback search
    {
      key = 'F',
      mods = 'CTRL|SHIFT',
      action = act.Search { CaseInSensitiveString = '' },
    },
    
    -- Toggle fullscreen (from Kitty config)
    {
      key = 'Return',
      mods = 'SUPER',                              -- From Kitty: cmd+enter
      action = act.ToggleFullScreen,               -- From Kitty: toggle_fullscreen
    },
    {
      key = 'F11',
      action = act.ToggleFullScreen,
    },
    
    -- Command palette
    {
      key = 'P',
      mods = 'CTRL|SHIFT',
      action = act.ActivateCommandPalette,
    },
    
    -- Examples of other useful keybindings (commented out):
    
    -- -- Quick select mode (for selecting text/URLs)
    -- {
    --   key = 'Space',
    --   mods = 'CTRL|SHIFT',
    --   action = act.QuickSelect,
    -- },
    
    -- -- Zoom pane (toggle maximizing current pane)
    -- {
    --   key = 'Z',
    --   mods = 'CTRL|SHIFT',
    --   action = act.TogglePaneZoomState,
    -- },
    
    -- -- Move tab position
    -- {
    --   key = 'PageUp',
    --   mods = 'CTRL|SHIFT',
    --   action = act.MoveTabRelative(-1),
    -- },
    -- {
    --   key = 'PageDown',
    --   mods = 'CTRL|SHIFT',
    --   action = act.MoveTabRelative(1),
    -- },
    
    -- -- Activate specific tab by number
    -- {
    --   key = '1',
    --   mods = 'ALT',
    --   action = act.ActivateTab(0),
    -- },
    -- {
    --   key = '2',
    --   mods = 'ALT',
    --   action = act.ActivateTab(1),
    -- },
    -- -- ... continue for tabs 3-9
    
    -- -- Send specific keys to terminal
    -- {
    --   key = 'Enter',
    --   mods = 'CTRL',
    --   action = act.SendKey { key = 'Enter', mods = 'CTRL' },
    -- },
  },
}