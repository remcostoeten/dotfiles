# Dotfiles

A modular, standalone set of personal dotfiles optimized for the Fish shell. Contains custom CLI tooling, scripts, helpers, shortcuts, and system optimizations with automatic dependency management.

## 🚀 Quick Start

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/remcostoeten/dotfiles.git ~/.config/dotfiles
   ```

2. **Run the bootstrap script:**
   ```bash
   fish ~/.config/dotfiles/bootstrap.fish
   ```

3. **Restart your shell:**
   ```fish
   exec fish
   ```

### Manual Installation

If you prefer manual setup:

1. **Clone to dotfiles directory:**
   ```bash
   git clone https://github.com/remcostoeten/dotfiles.git ~/.config/dotfiles
   ```

2. **Backup existing Fish config:**
   ```bash
   [ -d ~/.config/fish ] && mv ~/.config/fish ~/.config/fish_backup_$(date +%Y%m%d_%H%M%S)
   ```

3. **Create symlink to Fish configuration:**
   ```bash
   ln -s ~/.config/dotfiles/config/config.fish ~/.config/fish/config.fish
   ```

4. **Install dependencies (optional):**
   ```bash
   dotfiles-install-deps
   ```

## 📚 Help & Documentation

Once installed, access comprehensive help:

```bash
dotfiles help          # Main help system
dotfiles -h            # Quick help
dotfiles --help        # Full help
symlink-manager help   # Symlink management help
detect-deps help       # Dependency detection help
```

**📖 Complete Documentation:**
- **[docs/DOCS.md](docs/DOCS.md)** - Documentation index and navigation guide
- **[docs/DEPENDENCIES.md](docs/DEPENDENCIES.md)** - Comprehensive dependency management guide
- **[docs/SYMLINKS.md](docs/SYMLINKS.md)** - Symlink management documentation
- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** - System design and architecture

## 🛠 Features

### Core Features
- **Modular Design**: Each script/tool is standalone and independent
- **Automatic Dependency Management**: Detects and installs missing dependencies
- **Cross-Platform Support**: Works on Linux, macOS, and WSL
- **Symlink Management**: Automated configuration file linking
- **Fish Shell Optimized**: Built specifically for Fish shell
- **Easy Integration**: Pull individual scripts into your own setup

### Available Tools

| Tool | Purpose | Dependencies |
|------|---------|-------------|
| `copy.fish` | Clipboard utilities | xclip/xsel (Linux), pbcopy (macOS) |
| `git-commit.fish` | Interactive Git commit helper | git |
| `kill-ports.fish` | Port management utility | node, lsof/ss |
| `node-clean.fish` | Clean Node.js project folders | rm |
| `node-reinstall.fish` | Clean and reinstall dependencies | bun, rm |
| `node-clean-dev.fish` | Development server restart | bun, lsof |
| `file-utils.fish` | Enhanced file operations | mkdir, touch, chmod |
| `webcam-mic.fish` | Media testing utility | ffmpeg |
| `remove-comments` | Remove comments from code files | python3 |
| `symlink-manager.fish` | Dotfile symlink management | fish, standard POSIX tools |

### Dependency Management

**Automatic Detection:**
```bash
detect-deps              # Check all dependencies
detect-deps git-commit   # Check specific tool
```

**Automatic Installation:**
```bash
dotfiles-install-deps           # Interactive installation
dotfiles-install-deps --yes     # Auto-install all missing
dotfiles-install-deps --dry-run  # Show what would be installed
```

**Platform Support:**
- **Linux**: apt, dnf, pacman
- **macOS**: Homebrew
- **Package Mapping**: Automatically maps generic names to platform-specific packages

### Symlink Management

**Core Symlinks (always created):**
- Kitty terminal configuration
- Neovim configuration
- Warp terminal themes
- NPM configuration

**Platform-Specific Symlinks:**
- Alacritty (Linux, if installed)
- iTerm2 (macOS, if directory exists)
- Git, SSH, Tmux configurations

**Commands:**
```bash
symlink-manager status   # Check symlink status
symlink-manager setup    # Create/update all symlinks
symlink-manager verify   # Verify symlinks are valid
symlink-manager clean    # Remove all symlinks (careful!)
```

## 📁 Structure

```
dotfiles/
├── bin/                 # 🟢 Executable scripts and commands
├── config/              # 🟢 Configuration files
├── docs/                # 📚 Documentation files
│   ├── ARCHITECTURE.md  # System design and architecture
│   ├── DEPENDENCIES.md  # Dependency management guide
│   ├── DOCS.md          # Documentation index
│   └── SYMLINKS.md      # Symlink management guide
├── env/                 # 🟢 Environment variables (platform-specific)
├── internal/            # 🔴 System files (don't modify)
│   ├── bootstrap/       # Setup and installation scripts
│   ├── deps/            # Dependency management system
│   ├── helpers/         # Help system
│   └── loaders/         # Module loading logic
├── scripts/             # Additional utility scripts
├── README.md            # This file
└── bootstrap.fish       # Main setup script
```

## 🔧 Extending the System

### Adding New Tools

1. **Create your script in `bin/`:**
   ```bash
   echo 'echo "Hello World"' > ~/.config/dotfiles/bin/my-tool.fish
   chmod +x ~/.config/dotfiles/bin/my-tool.fish
   ```

2. **Add dependencies to `deps.yaml`:**
   ```yaml
   tools:
     - tool: my-tool.fish
       requires: [curl, jq]
       optional: [fzf]
       notes: "My custom tool that uses curl and jq"
   ```

3. **Restart your shell:**
   ```fish
   exec fish
   ```

### Extending `deps.yaml`

The dependency configuration file supports:

```yaml
tools:
  - tool: script-name.fish        # Tool filename
    requires: [cmd1, cmd2]        # Required dependencies
    optional: [opt1, opt2]        # Optional dependencies (not enforced)
    notes: "Description of tool"   # Human-readable description
```

**Guidelines:**
- Use generic command names (node, python3, git)
- The installer automatically maps to platform-specific packages
- Required dependencies are checked and can be auto-installed
- Optional dependencies are noted but not enforced

### Adding New Symlinks

Edit `bin/symlink-manager.fish` and add to the SYMLINKS array:

```fish
set -l SYMLINKS \
    "$DOTFILES_DIR/your-config:$HOME/.config/your-app" \
    # ... other symlinks
```

## 🎯 Design Philosophy

- **Modularity**: Each component works independently
- **Simplicity**: Clear structure, obvious purposes
- **Self-Documentation**: Code and systems explain themselves
- **Graceful Degradation**: Tools work even if optional dependencies are missing
- **Cross-Platform**: Works consistently across different systems
- **Easy Integration**: Pick what you need, leave what you don't

## 🤝 Contributing

As these dotfiles are built in a modular way, you are free to:
- Pull any individual script for your own setup
- Fork and modify for your needs
- Contribute improvements and new tools
- Report issues or suggest enhancements

## 📄 License

Feel free to use, modify, and distribute. See individual script headers for specific licenses if applicable.
