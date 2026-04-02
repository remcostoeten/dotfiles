#!/usr/bin/env sh

# Shared helpers for POSIX-style shell loaders.
dotfiles_add_to_path() {
    for dir in "$@"; do
        if [ -d "$dir" ]; then
            case ":$PATH:" in
                *":$dir:"*) ;;
                *) PATH="$dir:$PATH" ;;
            esac
        fi
    done
    export PATH
}

dotfiles_source_dir() {
    dir="$1"
    ext="${2:-sh}"

    if [ -d "$dir" ]; then
        for file in "$dir"/*."$ext"; do
            if [ -f "$file" ]; then
                # shellcheck source=/dev/null
                . "$file"
            fi
        done
    fi
}

dotfiles_shell_name() {
    if [ -n "${ZSH_VERSION:-}" ]; then
        printf '%s\n' "zsh"
    elif [ -n "${BASH_VERSION:-}" ]; then
        printf '%s\n' "bash"
    else
        printf '%s\n' "sh"
    fi
}

dotfiles_shell_is_interactive() {
    case $- in
        *i*) return 0 ;;
        *) return 1 ;;
    esac
}
