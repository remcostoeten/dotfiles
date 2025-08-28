# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Repository Overview

This is a sophisticated **personal dotfiles management system** designed for cross-shell compatibility (bash/zsh) with advanced features like symlink management, environment variable persistence, and a modular plugin architecture.

## Core Architecture

### Entry Point
- **`cfg`** - Main entry point that bootstraps the entire system
- Gets symlinked to `~/.bashrc` or `~/.zshrc` depending on shell
- Sources core modules in proper order: env → colors → safety → bootstrap

### Core System Components
```
core/
├── env          # Environment variables and path definitions  
├── colors       # Color functions (echo.red, echo.success, etc)
├── safety       # Safe sourcing, linking, and error handling
├── bootstrap    # Main initialization and module loading
└── constants    # Core constants and version info
```

### Module System
```
modules/
├── enabled/     # Active modules loaded on shell startup
├── disabled/    # Inactive modules
├── plugins/     # Plugin wrappers (zsh-enhancements, etc)
├── scripts/     # Standalone scripts
└── aliases/     # Alias collections
```

### Management Tools
```
bin/
├── dotfiles     # Main CLI tool (doctor, modules, etc)
├── dotfiles-env # Environment variable CRUD with JSON persistence
├── dotfiles-link# Symlink manager with registry
└── dotfiles-new # Scaffolder for modules/plugins/scripts
```

## Essential Commands

### Development Workflow
```bash
# System health check and diagnostics
dotfiles doctor

# Reload dotfiles after changes
reload
# or
dotfiles reload

# Version and status info
dotfiles version
```

### Module Management
```bash
# List all modules
dotfiles modules list

# Enable/disable modules
dotfiles modules enable <module-name>
dotfiles modules disable <module-name>

# Create new module/plugin/script
dotfiles-new module <name>
dotfiles-new plugin <name>
dotfiles-new script <name>
```

### Symlink Management
```bash
# List all registered symlinks
dotfiles-link list

# Create new symlink with registry tracking
dotfiles-link add <source> <target>

# Remove symlink and registry entry
dotfiles-link remove <target>

# Fix broken symlinks
dotfiles-link fix

# Auto-sync common config files
dotfiles-link sync
```

### Environment Variables
```bash
# List custom environment variables
dotfiles-env list

# Set persistent environment variable
dotfiles-env set MY_VAR "value"

# Get variable value
dotfiles-env get MY_VAR

# Remove variable
dotfiles-env unset MY_VAR

# Export/import from files
dotfiles-env export ~/.env.backup
dotfiles-env import ~/.env
```

## Key Features

### Color System
- Global color functions available everywhere: `echo.red`, `echo.success`, `echo.warning`, etc.
- Aliases: `e.red`, `e.success`, etc.
- Special functions: `echo.header`, `echo.box`, `echo.progress`, `echo.rainbow`

### Safe Operations  
- `safe_source` - Error-handled file sourcing with logging
- `safe_link` - Intelligent symlink creation with backup
- `safe_rm` - Moves files to trash instead of deleting
- All operations log to `logs/dotfiles.log` and `logs/error.log`

### Persistent Data
- **Symlink Registry**: `utils/links.json` tracks all managed symlinks
- **Environment Variables**: `utils/env.json` stores custom env vars
- **State Tracking**: `utils/state.json` maintains system state

### Shell Enhancement
- ZSH plugin: Fish-like autosuggestions, syntax highlighting, better completions
- Automatically installs and configures zsh-users plugins
- Cross-shell compatibility (bash/zsh)

## File Structure Conventions

### Naming
- All executables are extensionless with proper shebangs
- Use `function` declarations, not arrow functions
- Prefix types with `T` (TypeScript rule applied to any type definitions)

### Module Structure
- Each module has init, help, and main functions
- Plugins have install/configure/load functions
- Scripts follow standard CLI pattern with usage/main functions

### Safety Patterns
- All file operations use safe_ prefixed functions
- Error logging to dedicated log files
- Graceful degradation when dependencies missing
- Health checks via `dotfiles doctor`

## Installation & Setup

The system auto-installs on first run, but manual setup:

```bash
# Install (creates shell RC symlink)
dotfiles install

# Switch shells (if using zsh)
chsh -s $(which zsh)

# Install ZSH enhancements (auto-installs on first zsh run)
source modules/plugins/zsh-enhancements
```

## Extension Points

### Creating New Modules
```bash
dotfiles-new module my-feature
# Edit modules/enabled/my-feature
# Add init/help functions as needed
```

### Adding Plugins
```bash  
dotfiles-new plugin my-tool
# Edit modules/plugins/my-tool
# Add install/configure/load functions
```

The system automatically sources all modules in `modules/enabled/` on shell startup, making extensions seamless.

## Aesthetic Ricer Terminal Setup

### ✨ Completed Features
This setup includes a full aesthetic ricer terminal configuration:

**🎨 Visual Enhancements:**
- **Starship Prompt**: Beautiful, modern prompt with git integration and language icons
- **ZSH with Fish-like Features**: Auto-suggestions, syntax highlighting, enhanced completions
- **Colorful Syntax Highlighting**: Commands, aliases, functions highlighted in different colors
- **Icons and Colors**: File listings with beautiful icons via `eza`

**⚡ Modern CLI Tools:**
- `eza` - Enhanced ls with icons and colors
- `bat` - Syntax-highlighted cat with git integration
- `fzf` - Fuzzy finder with beautiful color scheme
- `zoxide` - Smart directory jumping (replaces cd)
- `ripgrep` - Ultra-fast search
- `fd` - Modern find alternative
- `neofetch` - System information display

**🚀 Quick Commands:**
```bash
# System info
sys                    # Beautiful system information

# Enhanced file operations
ls                     # Icons and colors
ll                     # Long listing with details
tree                   # Directory tree view
cat file.txt           # Syntax highlighted viewing

# Smart navigation
z project              # Jump to project directory
zi                     # Interactive directory selection

# Git shortcuts
g status               # Git status
gl                     # Beautiful git log
ga .                   # Add all files
gcm "message"          # Quick commit

# Network and system
myip                   # Show public IP
ports                  # Show open ports
```

### 🔄 Starting Fresh Session
To activate all aesthetic features:
1. Close current terminal
2. Open new terminal (ZSH will auto-load)
3. Enjoy the beautiful ricer terminal!

### 📋 Health Check
```bash
dotfiles doctor        # Comprehensive system check
dotfiles version       # Show system status
dotfiles-link list     # Show all symlinks
complete-setup         # Re-run setup completion
```
