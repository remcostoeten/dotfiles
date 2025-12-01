# My Dotfiles

This repository contains my personal dotfiles for various applications.

## Demo

![Dotfiles Setup Demo](docs/dotfiles-demo.gif)

*Interactive setup demonstration showing the TUI-based installation process*

## Quick Start

Launch the interactive dotfiles manager:

```bash
df                # Quick access
dotfiles          # Full command
```

Run `dotfiles --help` or `df --help` for complete usage guide.

### Interactive Setup

```bash
cd ~/.config/dotfiles/opentui-setup
bun run setup     # Full interactive TUI
bun run interactive  # Same as above
bun run cli       # Non-interactive (headless) mode
```

### Command Line Arguments

The setup script supports various command-line arguments for fine-grained control:

| Argument | Description |
|----------|-------------|
| `--dry-run` | Preview all installations without making changes |
| `--dry-run-section <NAME>` | Preview a specific section only |
| `--dry-run-interactive` | Interactive dry-run mode (alias: `--dry-run-i`) |
| `--skip-system-update` | Skip apt update/upgrade step |
| `--skip-fonts` | Skip Nerd Fonts installation |
| `--verbose`, `-v` | Show detailed installation output |
| `--quiet`, `-q` | Minimal output, errors only |
| `--install <NAME>` | Install a specific section non-interactively |
| `--install-interactive` | Select sections to install interactively (alias: `--install-i`) |
| `--skip <NAME>` | Skip a specific section during installation |
| `--skip-interactive` | Select sections to skip interactively (alias: `--skip-i`) |
| `--list` | List all available packages by category |
| `--all`, `--yes`, `-y` | Non-interactive mode. Installs all categories without prompts |

**Examples:**

```bash
# Preview what would be installed
bun run setup --dry-run

# Install everything without prompts
bun run setup --all --skip-fonts

# Install only essential packages
bun run setup --install essential --verbose

# Preview specific category
bun run setup --dry-run-section cli-utils
```

> **Note**: Generate the demo GIF by running `./scripts/generate-demo-gif.sh` (requires `terminalizer` or `asciinema` + `agg`)

## Structure

The repository is structured as follows:

* `bin/`: Executable scripts and tools (globally available)
* `configs/fish/`: Fish shell configuration
  * `aliases/`: Shell aliases organized by category
  * `functions/`: Custom Fish functions
  * `core/`: Core configuration (colors, environment, init)
* `scripts/`: Utility scripts and tools
* `env-private/`: Private environment variables (see [Private Files Guide](docs/PRIVATE-FILES.md))

## Private Files & Secrets

This repository is open source, but some files contain sensitive information and are kept private:

* Private environment variables are stored in `env-private/` (gitignored or as git submodule)
* User-specific data is stored in `$HOME/.dotfiles/` (outside the repository)
* Secrets and API keys are never committed to the repository

See **[docs/PRIVATE-FILES.md](docs/PRIVATE-FILES.md)** for a complete guide on:
- How to handle private files and secrets
- Best practices for open source dotfiles
- Setting up private configuration
- Security checklist

## Installation

### Quick Setup

1. Clone this repository:

```bash
git clone https://github.com/remcostoeten/dotfiles ~/.config/dotfiles
```

2. Run the setup script:

```bash
cd ~/.config/dotfiles/opentui-setup;
bun install;
bun run interactive
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
