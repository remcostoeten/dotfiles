#!/usr/bin/env sh

dotfiles_add_to_path "$HOME/.local/share/fnm"

if dotfiles_shell_is_interactive && command -v fnm >/dev/null 2>&1; then
    eval "$(fnm env --use-on-cd --shell "$(dotfiles_shell_name)")"
fi
