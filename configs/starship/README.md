# Starship Configuration Variants

This directory contains modular starship prompt configurations that can be easily switched between.

## Structure

```
configs/starship/
├── .current              # Current active variant name
├── variants/            # All available starship configurations
│   └── pastel-powerline.toml
├── README.md            # This file
└── starship.toml        # Symlink to current variant
```

## Available Variants

- **pastel-powerline**: Beautiful powerline-style prompt with pastel gruvbox colors

## Usage

The starship configuration is managed through the dotfiles system:

```bash
# Switch starship variants (via starship module)
starship-switch pastel-powerline

# View current variant
cat ~/.config/dotfiles/configs/starship/.current

# Reload starship after changes
reload
```

## Adding New Variants

1. Create a new `.toml` file in the `variants/` directory
2. Use the starship module commands to switch to it
3. The symlink will automatically update

## Integration

- Starship configurations are managed by `modules/enabled/starship`
- Symlinks are handled by the dotfiles link management system
- Current variant state is persisted in `.current` file
