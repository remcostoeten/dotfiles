#!/usr/bin/env sh

export PREFERRED_HOME_DIR="${PREFERRED_HOME_DIR:-$HOME}"
export EDITOR="${EDITOR:-nvim}"
export SUDO_EDITOR="${SUDO_EDITOR:-$EDITOR}"

dotfiles_add_to_path "$HOME/.config/dotfiles/bin"
dotfiles_add_to_path "$HOME/.config/dotfiles/scripts"
dotfiles_add_to_path "$HOME/.local/bin"
dotfiles_add_to_path "$HOME/bin"

if dotfiles_shell_is_interactive; then
    if [ -f "$HOME/.secrets" ]; then
        # shellcheck source=/dev/null
        . "$HOME/.secrets"
    fi

    if [ -f "$HOME/.config/dotfiles/scripts/todo.js" ]; then
        if command -v bun >/dev/null 2>&1; then
            bun "$HOME/.config/dotfiles/scripts/todo.js" shell-display 2>/dev/null
        elif command -v node >/dev/null 2>&1; then
            node "$HOME/.config/dotfiles/scripts/todo.js" shell-display 2>/dev/null
        fi
    fi
fi
