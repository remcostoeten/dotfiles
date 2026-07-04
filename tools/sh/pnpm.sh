#!/usr/bin/env sh

export PNPM_HOME="${PNPM_HOME:-$HOME/.local/share/pnpm}"
dotfiles_add_to_path "$PNPM_HOME"
