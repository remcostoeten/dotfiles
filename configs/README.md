# Fish Shell Configuration

This directory contains the Fish shell configuration source of truth for the dotfiles system.

## Setup

The Fish configuration is managed through symlinks:

- **Source of Truth**: `~/.config/dotfiles/configs/fish/config.fish`
- **Symlinked to**: `~/.config/fish/config.fish`

### Automatic Setup

Run the bootstrap script to create the symlink:

```fish
~/.config/dotfiles/internal/bootstrap/setup-fish-config.fish
```

### Manual Setup

If you need to set up the symlink manually:

```fish
# Backup existing config (if any)
cp ~/.config/fish/config.fish ~/.config/fish/config.fish.backup

# Remove existing config
rm ~/.config/fish/config.fish

# Create symlink
ln -sf ~/.config/dotfiles/configs/fish/config.fish ~/.config/fish/config.fish
```

## Configuration Features

The Fish config includes:

- **Prompt**: Starship integration
- **Environment Variables**: Editor, paths, development tools
- **Dotfiles Integration**: Automatic loading of modules and aliases
- **SSH Agent**: Automatic SSH key management
- **External Tools**: Zoxide integration
- **Performance**: Optimized settings for faster startup
- **Development**: Node.js optimizations and quick aliases
- **Local Overrides**: Support for machine-specific settings

## Local Customization

For machine-specific settings, create a local config file:

```fish
# ~/.config/fish/config.local.fish
set -gx MY_LOCAL_VAR "value"
alias myalias="some command"
```

This file will be automatically sourced if it exists and won't be tracked by the dotfiles system.

## Quick Development Aliases

Built-in aliases for common development tasks:

- `g` → `git`
- `clone` → `git clone`
- `i` → `bun install`
- `r` → `bun run dev`

## Troubleshooting

If Fish doesn't load properly:

1. Check the symlink exists: `ls -la ~/.config/fish/config.fish`
2. Test the config: `fish -c "source ~/.config/fish/config.fish"`
3. Check for syntax errors in the source file
4. Restore from backup if needed: `cp ~/.config/fish/config.fish.backup ~/.config/fish/config.fish`

## Architecture

The configuration loads in this order:

1. Prompt initialization (Starship)
2. Environment variables
3. Dotfiles integration (modules, aliases)
4. SSH agent setup
5. External tools (Zoxide)
6. Fish shell settings
7. Local overrides

This ensures proper dependency order and allows for local customization without conflicts.
