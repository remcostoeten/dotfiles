# Symlink Management

This dotfiles repository uses symlinks to connect configuration files from the repository to their expected locations on your system.

## Quick Start

### On a new machine
```bash
# Clone the dotfiles repository
git clone https://github.com/remcostoeten/dotfiles.git ~/.config/dotfiles

# Run the bootstrap script
fish ~/.config/dotfiles/bootstrap.fish
```

### Manual symlink management
```bash
# Check current symlink status
symlink-manager status

# Create/update all symlinks
symlink-manager setup

# Verify all symlinks are valid
symlink-manager verify

# Remove all symlinks (careful!)
symlink-manager clean
```

## Configured Symlinks

The following symlinks are automatically managed:

### Core Symlinks
These are always created by `symlink-manager.fish`:

| Source | Target | Description |
|--------|--------|-------------|
| `~/.config/dotfiles/config/kitty/` | `~/.config/kitty/` | Kitty terminal configuration |
| `~/.config/dotfiles/config/warp-themes/` | `~/.config/warp-terminal/themes/` | Warp terminal themes |


### Platform-Specific Symlinks
These are created conditionally by `setup-symlinks.fish` based on platform and installed tools:

#### Linux
| Source | Target | Condition | Description |
|--------|--------|-----------|-------------|
| `~/.config/dotfiles/config/alacritty/alacritty.yml` | `~/.config/alacritty/alacritty.yml` | If Alacritty is installed | Alacritty terminal config |
| `~/.config/dotfiles/config/nvim/` | `~/.config/nvim/` | If Neovim is installed | Neovim configuration |

#### macOS
| Source | Target | Condition | Description |
|--------|--------|-----------|-------------|
| `~/.config/dotfiles/config/iterm2/` | `~/.config/iterm2/` | If directory exists | iTerm2 configuration |

### Development Tools Symlinks
These are created if the corresponding configuration files exist:

| Source | Target | Description |
|--------|--------|-------------|
| `~/.config/dotfiles/config/git/gitconfig` | `~/.gitconfig` | Git global configuration |
| `~/.config/dotfiles/config/ssh/config` | `~/.ssh/config` | SSH client configuration |
| `~/.config/dotfiles/config/tmux/tmux.conf` | `~/.tmux.conf` | Tmux configuration |

## How It Works

1. **Symlink Manager** (`bin/symlink-manager.fish`)
   - Central script for managing all symlinks
   - Handles creation, verification, and removal
   - Backs up existing files/directories before creating symlinks
   - Provides colored status output
   - Integrated with dependency detection system

2. **Bootstrap Process** (`bootstrap.fish`)
   - Main entry point for new machine setup
   - Runs all setup scripts in order
   - Sets up Fish configuration
   - Creates all necessary symlinks
   - Optionally installs missing dependencies

3. **Automatic Setup** (`internal/bootstrap/setup-symlinks.fish`)
   - Called during bootstrap process
   - Ensures all symlinks are created on new machines
   - Platform-specific symlinks can be added here

4. **Dependency Integration** (`internal/deps/`)
   - Automatically detects missing dependencies for symlinked tools
   - Provides installation suggestions
   - Ensures tools work after symlinks are created

## Adding New Symlinks

To add a new symlink, edit `bin/symlink-manager.fish`:

```fish
# Add to the SYMLINKS array
set -l SYMLINKS \
    "$DOTFILES_DIR/kitty:$HOME/.config/kitty" \
    "$DOTFILES_DIR/warp-themes:$HOME/.config/warp-terminal/themes" \
    "$DOTFILES_DIR/YOUR_APP:$HOME/.config/YOUR_APP"  # New symlink
```

## Features

- **Automatic Backup**: Existing files/directories are backed up with timestamp
- **Smart Updates**: Only recreates symlinks if they're pointing to wrong location
- **Safety First**: Won't overwrite non-symlink files without backing up
- **Status Monitoring**: Visual indicators for symlink status
- **Platform Support**: Works on Linux, macOS, and WSL

## Troubleshooting

### Symlink not working
```bash
# Check if source exists
ls -la ~/.config/dotfiles/kitty/

# Check symlink status
symlink-manager status

# Force recreate symlinks
symlink-manager clean && symlink-manager setup
```

### Permission issues
```bash
# Ensure scripts are executable
chmod +x ~/.config/dotfiles/bin/symlink-manager.fish
chmod +x ~/.config/dotfiles/bootstrap.fish
```

### Manual symlink creation
```bash
# If automated process fails, create manually
ln -s ~/.config/dotfiles/kitty ~/.config/kitty
```

## Dependency Management Integration

The symlink system is integrated with the dependency management system to ensure that symlinked configurations and tools work properly.

### Automatic Dependency Detection
After symlinks are created, the system can detect missing dependencies:

```bash
# Check dependencies for all tools
detect-deps

# Check dependencies for specific tool
detect-deps git-commit
```

### Automatic Dependency Installation
Install missing dependencies for symlinked tools:

```bash
# Interactive installation
dotfiles-install-deps

# Non-interactive installation
dotfiles-install-deps --yes

# Preview what would be installed
dotfiles-install-deps --dry-run
```

### Dependencies Configuration
Tool dependencies are defined in `internal/deps/deps.yaml`. When you add new symlinks for tools, consider adding their dependencies:

```yaml
tools:
  - tool: your-new-tool.fish
    requires: [curl, jq]
    optional: [fzf]
    notes: "Description of what this tool does"
```

### Complete Setup Workflow
For a new machine with full setup:

```bash
# 1. Clone repository
git clone https://github.com/remcostoeten/dotfiles.git ~/.config/dotfiles

# 2. Run bootstrap (includes symlinks)
fish ~/.config/dotfiles/bootstrap.fish

# 3. Install dependencies
dotfiles-install-deps

# 4. Verify everything works
symlink-manager status
detect-deps
```
