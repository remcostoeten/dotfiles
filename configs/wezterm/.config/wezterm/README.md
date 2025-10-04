# WezTerm Modular Configuration

This configuration uses a modular architecture to keep WezTerm settings organized and maintainable.

## Structure

```
~/.config/wezterm/
├── wezterm.lua          # Main entry point
├── modules/             # Configuration modules
│   ├── font.lua        # Font settings & typography
│   ├── layout.lua      # Window appearance & layout
│   ├── keys.lua        # Keybindings & shortcuts
│   └── themes.lua      # Color schemes & theme toggling
├── commands/           # Custom commands (legacy)
└── README.md          # This file
```

## Module Overview

### `font.lua`
- Primary font configuration (JetBrains Mono)
- Font size, line height, letter spacing
- Font fallbacks and ligature settings
- Bold/italic font rules

### `layout.lua` 
- Window decorations and padding
- Transparency and opacity
- Tab bar configuration
- Cursor and scrollback settings
- Performance options

### `keys.lua`
- All keybindings and shortcuts
- Extensively commented examples
- Pane management (split, navigate, resize)
- Tab management (create, close, navigate)
- Copy/paste, search, font size controls

### `themes.lua`
- Color scheme definitions
- Built-in Catppuccin Mocha theme
- Custom "Pumpkin Spice" theme (autumn/orange palette)
- Live theme toggling with F12
- Toast notifications for theme changes

## Key Features

### Theme Toggling
Press **F12** to toggle between Catppuccin Mocha and Pumpkin Spice themes.
A notification will appear showing the current theme.

### Essential Keybindings
- `Ctrl+Shift+R` - Reload configuration
- `Ctrl+Shift+C/V` - Copy/Paste
- `Ctrl+Shift+T` - New tab
- `Ctrl+Shift+D` - Split pane horizontally
- `Ctrl+Alt+D` - Split pane vertically
- `Ctrl+Shift+Arrow` - Navigate panes
- `Ctrl+Alt+Arrow` - Resize panes
- `F11` - Toggle fullscreen
- `F12` - Toggle theme

### Customization

Each module can be modified independently:

1. **Change fonts**: Edit `modules/font.lua`
2. **Adjust appearance**: Edit `modules/layout.lua` 
3. **Add keybindings**: Edit `modules/keys.lua`
4. **Create themes**: Edit `modules/themes.lua`

The main `wezterm.lua` automatically loads all modules, so changes take effect on configuration reload.

### Adding New Themes

To add a new theme to `themes.lua`:

1. Define the color scheme in the `color_schemes` table
2. Update the `toggle_theme` function to cycle through your themes
3. Optionally add keybindings for direct theme activation

### Legacy Support

The configuration maintains compatibility with existing `commands/` directory for custom command palette entries.

## Reload Configuration

Use `Ctrl+Shift+R` or restart WezTerm to apply changes after editing any module.