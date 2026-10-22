#!/usr/bin/env zsh

export EDITOR="${EDITOR:-nvim}"
export SUDO_EDITOR="${SUDO_EDITOR:-$EDITOR}"
export TERMINAL="${TERMINAL:-ghostty}"
export TERM_PROGRAM="${TERM_PROGRAM:-ghostty}"

dotfiles_add_path "$DOTFILES_DIR/bin" "$DOTFILES_DIR/scripts" "$HOME/.local/bin" "$HOME/bin"

autoload -Uz compinit
compinit

dotfiles_source_dir "$DOTFILES_DIR/aliases" zsh
dotfiles_source_dir "$DOTFILES_DIR/tools/zsh" zsh

if [[ -f "$HOME/.secrets" ]]; then
    source "$HOME/.secrets"
fi

if [[ -f "$HOME/.antidote/antidote.zsh" ]]; then
    source "$HOME/.antidote/antidote.zsh"
    antidote load
fi
