# Dotfiles

This is a work in progress. Containing my  personal dotfiles varying from custom CLI tooling, scripts, helpers, short hands and other optimalizations. Currently runs in Fish.

## Getting Started

**TODO: Docs (Roughly)**

As these dotfiles are built in a modular way, you are free to pull any part out and include it in your own dotfiles setup. All scripts and CLI tools should be standalone and non-dependent on other files within this repository, making them easy to integrate individually.

### Installation

To use these dotfiles with Fish shell:

1. Clone this repo into `~/.config/dotfiles`

2. **Symlink the Fish configuration:**
  
  
```bash
   # Backup existing config if it exists
   [ -d ~/.config/fish ] && mv ~/.config/fish ~/.config/fish_backup_$(date +%Y%m%d_%H%M%S)
   
   # Create symlink to dotfiles config
   ln -s "$(pwd/config.fish" ~/.config/fish/config.fish
   ```

2. **Restart your shell or source the config:**
   ```fish
   exec fish
   ```

Type any of these to view all the power you now ----------
```
dotfiles help
dotfiles -h
dotfiles --h
dotfiles -help
dotfiles --help
`
```
:;q
