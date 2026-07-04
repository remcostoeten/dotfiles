# Fish configuration - sourced from dotfiles cfg
# This file serves as the main entry point for fish configuration
# All actual configuration is maintained in ~/.config/dotfiles/cfg

source ~/.config/dotfiles/cfg
# Added by tunnel installer
fish_add_path /home/remcostoeten/.local/bin
# Self-managed Deno (canary) — prepended so it shadows the pacman build
fish_add_path --prepend /home/remcostoeten/.deno/bin