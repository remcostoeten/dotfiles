# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Repository Overview

This is a sophisticated **personal dotfiles management system** designed for **ZSH-first** cross-shell compatibility with advanced features like symlink management, environment variable persistence, modular plugin architecture, and comprehensive logging.

## Core Architecture

### Entry Point
- **`cfg`** - Main entry point that bootstraps the entire system
- Gets symlinked to `~/.zshrc` (primary) or `~/.bashrc` (fallback)
- Executes core boot sequence: `_env` → `_colors` → `_safety` → `_bootstrap`
- Includes secrets/tokens integration and personal dashboard hooks

### Core Boot Sequence
The system follows a strict initialization order through private core files:

```
cfg (Main Entry)
├── core/_env        # Environment variables, paths, shell detection
├── core/_colors     # Global color functions and themes
├── core/_safety     # Safe sourcing, linking, error handling
└── core/_bootstrap  # Module loading, shell config, prompt setup
    ├── alias-loader     # Loads all .aliases files
    ├── plugin-loader    # Loads and configures plugins
    ├── script-loader    # Links scripts to PATH
    └── modules/enabled/ # Active modules and features
```

### Core System Components
**Private Core Files (underscore-prefixed):**
```
core/
├── _env         # Environment setup, shell detection, XDG paths
├── _colors      # Color definitions and echo.* helper functions
├── _safety      # safe_source, safe_link, error logging
├── _bootstrap   # Main initialization, shell options, module loading
└── _constants   # Version info, paths, constants
```

**Public Core Files (legacy compatibility):**
```
core/
├── bootstrap    # Public wrapper for _bootstrap
├── colors       # Public wrapper for _colors  
├── constants    # Public wrapper for _constants
├── env          # Public wrapper for _env
├── init         # Legacy initialization script
└── safety       # Public wrapper for _safety
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

### Environment Variables & Secrets Manager
```bash
# List all stored environment variables and secrets
dotfiles-env list
# Shorthand alias:
envs list

# Set persistent environment variable
dotfiles-env set MY_VAR "value"
# Set encrypted secret with type and description
dotfiles-env set API_KEY "secret-value" api --desc "My API Key"

# Get variable value (automatically copies to clipboard)
dotfiles-env get MY_VAR
# Interactive selection with fzf (if available)
dotfiles-env get

# Remove variable or secret
dotfiles-env remove MY_VAR      # Direct removal
dotfiles-env remove             # Interactive picker (requires fzf)

# Generate random secrets
dotfiles-env generate RANDOM_SECRET 32 password

# Generate OAuth key pairs
dotfiles-env generate-oauth GITHUB_OAUTH rsa 4096 "GitHub OAuth App"

# Search variables and secrets
dotfiles-env search "api"

# Export/import from files
dotfiles-env export ~/.env.backup
dotfiles-env import ~/.env

# Backup and restore
dotfiles-env backup
dotfiles-env restore backup_file.json
```

## Global Helper Functions

The system provides a comprehensive set of globally available helper functions:

### Echo/Color Functions
| Function | Purpose |
|----------|----------|
| `echo.error` | Red error messages with ✗ icon |
| `echo.success` | Green success messages with ✓ icon |
| `echo.warning` | Yellow warning messages with ⚠ icon |
| `echo.info` | Cyan info messages with ℹ icon |
| `echo.debug` | Purple debug messages (if `DOTFILES_DEBUG=1`) |
| `echo.verbose` | Purple verbose messages (if `DOTFILES_VERBOSE=1`) |
| `echo.header` | Blue bordered headers for sections |
| `echo.cyan` | Cyan colored text |
| `echo.purple` | Purple colored text |
| `echo.dotfiles_banner` | ASCII art banner for dotfiles |

### Safety Functions  
| Function | Purpose |
|----------|----------|
| `safe_source <file> [description]` | Source file with error handling and logging |
| `safe_source_dir <dir> [pattern] [description]` | Source all files in directory safely |
| `safe_eval <command> [description]` | Execute command with error trapping |
| `safe_link <source> <target>` | Create symlink with backup and validation |
| `safe_rm <file>` | Move file to XDG trash instead of deletion |
| `safe_command <cmd> <args...>` | Execute command only if it exists |

### Utility Functions
| Function | Purpose |
|----------|----------|
| `require <file>` | Source file or exit on failure |
| `optional <file>` | Source file silently if exists |
| `ensure_command <cmd> [package]` | Check command exists or show install hint |
| `ensure_dir <path>` | Create directory if it doesn't exist |
| `ensure_file <path> [content]` | Create file with default content if missing |

### Convenience Aliases
- **Color shortcuts**: `e.red`, `e.success`, `e.warning`, `e.info`, etc.
- **Banner shortcut**: `e.banner` for ASCII art display

## ZSH-Centric Runtime

The system is designed with **ZSH as the primary shell**, with bash as fallback support:

### Shell Detection & Configuration
```bash
$ echo $DOTFILES_SHELL
zsh
```

**ZSH-Specific Optimizations:**
- Auto-completion with menu selection and case-insensitive matching
- Advanced history management (dedup, sharing, verification)
- Extended globbing and smart directory navigation
- Integration with modern tools (starship, zoxide, direnv)

**ZSH Options Automatically Enabled:**
- `AUTO_CD`, `AUTO_PUSHD` - Smart directory navigation
- `CORRECT`, `CORRECT_ALL` - Command correction
- `EXTENDED_GLOB`, `NO_CASE_GLOB` - Advanced pattern matching
- `HIST_IGNORE_ALL_DUPS`, `SHARE_HISTORY` - Intelligent history
- `COMPLETE_IN_WORD`, `AUTO_MENU` - Enhanced completion

### Modern Tool Integration
The system automatically configures these tools when available:

**Starship Prompt**: Beautiful cross-shell prompt with git integration
```bash
eval "$(starship init zsh)"
```

**Zoxide**: Smart directory jumping (z/zi commands)
```bash
eval "$(zoxide init zsh)"
```

**Direnv**: Automatic environment loading
```bash
eval "$(direnv hook zsh)"
```

**FZF**: Fuzzy finding with ZSH completions
```bash
source "$HOME/.fzf.zsh"
```

## Key Features

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

## Module & Plugin Lifecycle

### Module Creation Workflow
1. **Scaffold**: `dotfiles-new module <name>` creates template in `modules/enabled/`
2. **Structure**: Each module includes `init()`, `help()`, and main functionality
3. **Auto-loading**: Modules in `modules/enabled/` are sourced automatically
4. **Disabling**: Move to `modules/disabled/` or add `.disabled` suffix

**Module Template Structure:**
```bash
$ dotfiles-new module git-extras
# Creates modules/enabled/git-extras with:
function git_extras_init() {
    echo.debug "Initializing git-extras"
}

function git_extras_help() {
    echo.header "Git Extras Help"
    echo "Available commands:"
    echo "  git-extras <command>    Main command"
}

alias ge='git-extras'
git_extras_init
```

### Plugin Management
1. **Scaffold**: `dotfiles-new plugin <name>` creates wrapper in `modules/plugins/`
2. **Functions**: Each plugin includes `install_<name>()`, `configure_<name>()`, `load_<name>()`
3. **Lazy Loading**: Plugins check for installation before loading
4. **Integration**: Plugin loader handles modern tools (fzf, zoxide, starship)

**Plugin Template Structure:**
```bash
$ dotfiles-new plugin neovim-config
# Creates modules/plugins/neovim-config with:
function install_neovim_config() {
    echo.info "Installing neovim-config..."
    # Installation logic here
}

function configure_neovim_config() {
    # Configuration logic here
}

function load_neovim_config() {
    if [[ -d "$HOME/.config/nvim" ]]; then
        # Load plugin
        echo.debug "Loaded neovim-config"
    fi
}
```

### Alias Collections
1. **Scaffold**: `dotfiles-new alias <name>` creates `modules/aliases/<name>.aliases`
2. **Convention**: Use `.aliases` extension for auto-discovery
3. **Documentation**: Use `# @alias` and `# @desc` comments for help system
4. **Loading**: Alias loader sources all `.aliases` files automatically

## Logging & Persistence

### Logging System
All operations are logged to dedicated files with timestamps:

```bash
logs/
├── dotfiles.log     # General operations and info
└── error.log        # Errors and failures
```

**Log Functions:**
- `safe_source` logs all file sourcing attempts
- `safe_link` logs symlink operations  
- `safe_rm` logs file removals to trash
- Error handling automatically logs failures

### JSON Registries
The system maintains persistent state in JSON files:

```bash
utils/
├── links.json       # Symlink registry
├── env.json         # Custom environment variables
└── state.json       # System state and version
```

**Registry Benefits:**
- **Symlinks**: Track all managed symlinks for health checks
- **Environment**: Persist custom variables across sessions
- **State**: Version tracking and update detection
- **Portability**: JSON format enables easy backup/restore

### Data Management Commands
```bash
# View registries
dotfiles-link list              # Show all tracked symlinks
dotfiles-env list               # Show custom environment variables
cat utils/state.json            # View system state

# Backup/restore
dotfiles-env export backup.env  # Export environment variables
dotfiles-env import backup.env  # Import from file
jq '.' utils/links.json         # Pretty-print symlink registry
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
This setup includes a full aesthetic ricer terminal configuration via the `aesthetic` module in `modules/enabled/aesthetic`:

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
