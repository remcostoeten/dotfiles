local module = {}

-- Aesthetic configuration based on Kitty settings
-- Translated from Kitty config values to WezTerm equivalents
function module.getConfig()
  return {
    -- Font and spacing settings (moved to font module)
    -- line_height and cell_width handled in font module
    
    -- Window padding (from Kitty config)
    window_padding = {
      left = 15,    -- From Kitty: window_padding_width 15 (final value)
      right = 15,
      top = 15,
      bottom = 15,
    },
    
    -- UI element visibility (from Kitty config)
    hide_tab_bar_if_only_one_tab = false,      -- Kitty shows tabs with min_tabs = 2
    show_tab_index_in_tab_bar = true,
    show_tabs_in_tab_bar = true,
    use_fancy_tab_bar = false,                 -- Simpler powerline style like Kitty
    enable_tab_bar = true,                     -- From Kitty: tab_bar_edge top
    tab_bar_at_bottom = false,                 -- From Kitty: tab_bar_edge top
    
    -- Window decorations (from Kitty config)
    window_decorations = 'NONE',              -- From Kitty: hide_window_decorations yes
    
    -- Scrollbar
    enable_scroll_bar = false,
    scrollback_lines = 2000,                   -- From Kitty: scrollback_lines 2000
    
    -- Window behavior (from Kitty config)
    window_background_opacity = 0.92,          -- From Kitty: background_opacity 0.92
    text_background_opacity = 1.0,
    
    -- Cursor (from Kitty config)
    default_cursor_style = 'BlinkingBar',      -- From Kitty: cursor_shape beam + blink
    cursor_blink_rate = 1000,                  -- From Kitty: cursor_blink_interval 1
    cursor_thickness = '1.5px',               -- From Kitty: cursor_beam_thickness 1.5
    
    -- Audio/Visual bell (from Kitty config)
    audible_bell = 'Disabled',                 -- From Kitty: enable_audio_bell no
    visual_bell = {
      fade_in_function = 'EaseIn',
      fade_in_duration_ms = 0,                 -- From Kitty: visual_bell_duration 0.0
      fade_out_function = 'EaseOut',
      fade_out_duration_ms = 0,
    },
    
    -- Performance
    max_fps = 144,
    enable_kitty_graphics = true,
    
    -- Window startup (from Kitty config - converted from pixels)
    initial_cols = 80,                         -- ~1280px width at 16pt font
    initial_rows = 24,                         -- ~800px height at 16pt font
    
    -- Window management (from Kitty config)
    window_close_confirmation = 'NeverPrompt', -- From Kitty: confirm_os_window_close 0
    
    -- Animation
    animation_fps = 60,
    
    -- Allow for better font rendering
    freetype_load_target = 'HorizontalLcd',
    freetype_render_target = 'HorizontalLcd',
  }
end

return module