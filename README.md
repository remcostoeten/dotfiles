# Dotfiles

A collection of personal dotfiles crafted by [Remco Stoeten](https://github.com/remcostoeten).

## Overview

These dotfiles provide a highly modular and opinionated approach to my development environment. They are designed to streamline workflows and boost productivity, offering a rich set of customizations for various tools and applications.

What you'll find here:

*   **Modular Configuration:** Organized for easy management and selective application of settings.
*   **Productivity Tooling:** A treasure trove of custom scripts, command-line interface (CLI) tools, and extensions tailored to enhance efficiency.
*   **Workflow Enhancements:** Configurations for various applications to create a cohesive and powerful development experience.
*   **Cross-Platform (where applicable):** Efforts made to ensure compatibility across different operating systems where possible.

Feel free to explore, adapt, and use anything that might be useful for your own setup!

## Getting Started

**TODO: Docs (Roughly)**

As these dotfiles are built in a modular way, you are free to pull any part out and include it in your own dotfiles setup. All scripts and CLI tools should be standalone and non-dependent on other files within this repository, making them easy to integrate individually.

If you want to try out the full (opinionated) experience of everything working together homogeneously, you'll need to initialize the dotfiles in your shell. This can be done by simply running:

```bash
./initialize-shell.sh
```

The initializer script is designed with safety guards and backup mechanisms for your existing shell configuration files (e.g., `.zshrc`, `.bashrc`, `fish-config`). To safely test the waters without making permanent changes, you can also run a dry-run:

```bash
./initialize-shell --dry
```

This will show you what the script *would* do without actually executing any modifications.

### Manual Installation

If you prefer a manual installation or want to integrate specific parts without using the full initializer script, you can set up individual components.

For example, to symlink the `fish-config` directory:

**🚨 IMPORTANT: You are responsible for backing up your existing `~/.config/fish` directory or file if it contains configurations you wish to preserve! This command will attempt to back up an existing *directory*, but direct file replacement is destructive.**

```bash
# Backup existing 'fish' directory if it exists
[ -d ~/.config/fish ] && mv ~/.config/fish ~/.config/fish_backup_$(date +%Y%m%d_%H%M%S);

# Remove existing 'fish' file if it exists (less common for fish config, but for robustness)
[ -f ~/.config/fish ] && rm ~/.config/fish;

# Create the symbolic link
ln -s "$(pwd)/fish-config" ~/.config/fish
```

**Note on `ln -s "$(pwd)/fish-config" ~/.config/fish`:**
This command assumes you are running it from the root of your dotfiles repository. `$(pwd)` resolves to the current working directory, ensuring the correct absolute path to `fish-config` is used for the symlink.

After initialization or manual setup, simply restart your shell or explicitly source your shell's configuration file for changes to take effect:

```bash
source ~/.config/fish/config.fish
```

Everything should then be ready to go!
