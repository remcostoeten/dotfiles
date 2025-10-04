-- Layout configuration that doesn't conflict with aesthetics module
-- This module focuses on layout-specific settings that aren't covered by aesthetics

return {
  -- Performance and rendering
  max_fps = 120,
  prefer_egl = true,
  
  -- Enable Wayland on Linux
  enable_wayland = true,
  
  -- macOS specific (ignored on Linux but harmless)
  macos_window_background_blur = 40,
  
  -- Terminal behavior
  exit_behavior = 'Close',
  
  -- Background image rendering
  window_background_image_hsb = {
    brightness = 0.8,
    hue = 1.0,
    saturation = 0.5,
  },
  
  -- Note: Other layout settings (window_decorations, padding, cursor, etc.)
  -- are handled by the aesthetics module to match Kitty configuration
}
