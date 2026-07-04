#!/usr/bin/env sh

if dotfiles_shell_is_interactive && command -v starship >/dev/null 2>&1; then
    eval "$(starship init "$(dotfiles_shell_name)")"
fi
