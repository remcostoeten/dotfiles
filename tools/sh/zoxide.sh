#!/usr/bin/env sh

if dotfiles_shell_is_interactive && command -v zoxide >/dev/null 2>&1; then
    eval "$(zoxide init "$(dotfiles_shell_name)")"
fi
