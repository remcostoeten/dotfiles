# Setup Directory Structure

This directory contains the modular components of the dotfiles setup system.

## Directory Structure

```
setup/
├── core/              # Core utilities and configuration
│   ├── colors.sh      # Terminal color definitions
│   ├── config.sh      # Configuration variables and flags
│   ├── helpers.sh     # Helper functions (print_*, command_exists, etc.)
│   └── progress.sh    # Progress tracking and data directory management
│
├── packages/          # Package definitions by category
│   ├── essential.sh   # Essential system packages (git, curl, build-essential)
│   ├── languages.sh   # Programming languages (Python, Node.js)
│   ├── editors.sh     # Code editors (Neovim, VS Code, Cursor)
│   ├── git-tools.sh   # Git tools (gh, lazygit, lazydocker)
│   ├── cli-utils.sh   # Modern CLI utilities (ripgrep, fzf, bat, eza)
│   ├── browsers.sh    # Web browsers
│   ├── communication.sh # Communication apps
│   ├── media.sh       # Media & graphics apps
│   ├── devops.sh      # DevOps tools (Docker, kubectl)
│   ├── system.sh      # System utilities
│   ├── hardware.sh    # Hardware tools
│   ├── automation.sh  # Automation tools
│   ├── gnome.sh       # GNOME tools
│   ├── snap.sh        # Snap packages
│   ├── curl-tools.sh  # Tools installed via curl
│   ├── npm-tools.sh   # NPM CLI tools
│   ├── android.sh     # Android development tools
│   └── config-apps.sh # Config-based applications
│
├── installers/        # Installation logic by method
│   └── common.sh      # Common installer functions (apt, snap, curl, npm, github, cargo)
│
└── modules/           # Feature modules (to be implemented)
    ├── fish.sh        # Fish shell setup
    ├── fonts.sh       # Nerd Fonts installation
    ├── gnome.sh       # GNOME aesthetics
    └── menu.sh        # TUI menu system

```

## Usage

The main `setup.sh` in the root directory sources these modules automatically.

### Adding New Packages

1. Add package definition to appropriate file in `setup/packages/`
2. Use format: `"package_name|install_method|extra_data|display_name"`
3. Supported methods: apt, snap, curl, npm, cargo, github

### Adding New Categories

1. Create new file in `setup/packages/`
2. Define array with package specifications
3. Source the file in main `setup.sh`

### Extending Functionality

- **Core utilities**: Add to `setup/core/helpers.sh`
- **New install methods**: Add to `setup/installers/common.sh`
- **Feature modules**: Create new file in `setup/modules/`

## Benefits of Modular Structure

- ✅ **Easier to understand** - Each file has single responsibility
- ✅ **Easier to debug** - Isolate issues to specific modules
- ✅ **Easier to extend** - Add packages without touching core logic
- ✅ **Better collaboration** - Multiple people can work on different modules
- ✅ **Testable** - Can test individual modules in isolation
- ✅ **Reusable** - Share modules across different setup scripts
