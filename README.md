# My Dotfiles

This repository contains my personal dotfiles for various applications.

## Quick Start

Launch the interactive dotfiles manager:

```bash
df                # Quick access
dotfiles          # Full command
```

Run `dotfiles --help` or `df --help` for complete usage guide.

## Structure

The repository is structured as follows:

* `bin/`: Executable scripts and tools (globally available)
* `configs/fish/`: Fish shell configuration
  * `aliases/`: Shell aliases organized by category
  * `functions/`: Custom Fish functions
  * `core/`: Core configuration (colors, environment, init)
* `scripts/`: Utility scripts and tools

## Features

* 🚀 **Interactive Menu**: Fast, searchable fzf-based tool launcher
* 📦 **100+ Tools**: Scripts, aliases, and utilities organized by category
* 🎨 **Category Organization**: Development, Database, Git, System, Docker, etc.
* 🔍 **Smart Search**: Find any tool instantly
* ⚙️ **Configurable**: Customize layout, banner, and behavior

## Installation

### Quick Setup (Ubuntu/Debian)

1. Clone this repository:

```bash
git clone <your-repo-url> ~/.config/dotfiles
```

2. Run the setup script:

```bash
cd ~/.config/dotfiles
./setup.sh
```

The setup script will:

* Install all required dependencies (fish, bun, fzf, starship, etc.)
* Create necessary symlinks
* Set up PATH variables
* Configure fish shell

### Manual Installation

If you prefer manual setup:

```bash
# Clone repository
git clone <your-repo-url> ~/.config/dotfiles

# Symlink fish config
ln -s ~/.config/dotfiles/cfg ~/.config/fish/config.fish

# Add to PATH (add to ~/.bashrc or ~/.zshrc)
export PATH="$HOME/.config/dotfiles/bin:$PATH"
export PATH="$HOME/.config/dotfiles/scripts:$PATH"
```
