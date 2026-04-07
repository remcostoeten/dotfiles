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
cd ~/.config/dotfiles
./setup/setup.sh --dry-run
./setup/setup.sh --category curl-tools
```

### Command Line Arguments

The setup script supports various command-line arguments for fine-grained control:

| Argument | Description |
|----------|-------------|
| `--dry-run` | Preview installations without making changes |
| `--verbose` | Show detailed installer output |
| `--category <NAME>` | Install one category such as `essential`, `tools`, or `curl-tools` |
| `--package <NAME>` | Install one package such as `fnm` or `starship` |
| `-h`, `--help` | Show usage help |

**Examples:**

```bash
# Preview what would be installed
./setup/setup.sh --dry-run

# Install one category
./setup/setup.sh --category curl-tools

# Install one package with verbose output
./setup/setup.sh --package fnm --verbose
```

> **Note**: Generate the demo GIF by running `./scripts/generate-demo-gif.sh` (requires `terminalizer` or `asciinema` + `agg`)

## Structure

The repository is structured as follows:

* `bin/`: User-facing entrypoints on `PATH`
* `configs/fish/`: Fish shell configuration
  * `functions/`: Fish-native runtime functions
* `vendor/`: Bootstrapping framework code and shell helpers
* `tools/`: Tool-specific runtime modules (`fnm`, `bun`, `rust`, `starship`, `docker`, `gnome`, etc.)
* `scripts/`: Tool implementations, intended to stay isolated from framework internals
* `setup/`: Bootstrap and installation logic
* `env-private/`: Private environment variables (see [Private Files Guide](docs/PRIVATE-FILES.md))

### Architecture Boundary

This repo uses a strict separation between framework internals and runtime tools:

* `setup/setup.sh` installs tools and creates symlinks, but shell startup now loads from `tools/`
* `vendor/fish/bootstrap.fish` and `vendor/sh/bootstrap.sh` are the only startup entrypoints
* `vendor/` holds bootstrap helpers, shared defaults, PATH setup, and session-only startup behavior
* `tools/<name>.fish` and `tools/<name>.sh` define shell integration, aliases, and workflows by tool or domain
* `cfg` stays logic-free and only sources a loader entrypoint
* `bin/` exposes stable user-facing commands
* `scripts/` contains tool implementations behind those commands
* `configs/fish/functions/` contains Fish runtime behavior only

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

### Fresh Machine Setup

For a completely fresh machine, clone the repository and run the shell installer.

**Prerequisites (Required Before Running):**

1. ✅ **Internet connection** - To download repositories and tools
2. ✅ **GitHub authentication** - For the private `env-private` repository:
   - **Recommended:** Install GitHub CLI and authenticate:
     ```bash
     # Install gh (Ubuntu/Debian)
     curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
     echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
     sudo apt update && sudo apt install gh -y
     gh auth login
     ```
   - **Alternative:** Use a Personal Access Token (you'll be prompted during clone)
     - Create one at: https://github.com/settings/tokens
     - Use it as the password when prompted (username is your GitHub username)

**Note:** The main dotfiles repository is **public** and requires no authentication. Only `env-private` needs authentication.

```bash
git clone https://github.com/remcostoeten/dotfiles ~/.config/dotfiles
```

Then run setup:

```bash
cd ~/.config/dotfiles
./setup/setup.sh
```

The installer can also be scoped:

```bash
./setup/setup.sh --dry-run
./setup/setup.sh --category curl-tools
./setup/setup.sh --package fnm
```

### Shell Entrypoints

- Fish: symlink `~/.config/fish/config.fish` to [`configs/fish/config.fish`](/home/remco/.config/dotfiles/configs/fish/config.fish)
- Bash: source or symlink [`configs/bash/.bashrc`](/home/remco/.config/dotfiles/configs/bash/.bashrc)
- Zsh / Oh My Zsh: source [`configs/zsh/.zshrc`](/home/remco/.config/dotfiles/configs/zsh/.zshrc) from your `.zshrc` or `custom/*.zsh`

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
