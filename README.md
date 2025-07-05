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

### Installation

To use these dotfiles with Fish shell:

1. **Symlink the Fish configuration:**
   ```bash
   # Backup existing config if it exists
   [ -d ~/.config/fish ] && mv ~/.config/fish ~/.config/fish_backup_$(date +%Y%m%d_%H%M%S)
   
   # Create symlink to dotfiles config
   ln -s "$(pwd)/configs/config.fish" ~/.config/fish/config.fish
   ```

2. **Restart your shell or source the config:**
   ```fish
   exec fish
   ```

Everything should then be ready to go!
