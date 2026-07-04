#!/usr/bin/env sh

export DOTNET_ROOT="${DOTNET_ROOT:-$HOME/.dotnet}"
dotfiles_add_to_path "$DOTNET_ROOT" "$DOTNET_ROOT/tools"
