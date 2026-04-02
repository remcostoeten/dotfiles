#!/usr/bin/env sh

if [ -n "${__DOTFILES_SH_BOOTSTRAP_LOADED:-}" ]; then
    return 0
fi
__DOTFILES_SH_BOOTSTRAP_LOADED=1
export __DOTFILES_SH_BOOTSTRAP_LOADED

# shellcheck source=/dev/null
. "$HOME/.config/dotfiles/vendor/sh/core.sh"
# shellcheck source=/dev/null
. "$HOME/.config/dotfiles/vendor/sh/runtime.sh"
dotfiles_source_dir "$HOME/.config/dotfiles/tools" sh
