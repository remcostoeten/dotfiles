#!/usr/bin/env fish

if set -q __DOTFILES_FISH_BOOTSTRAP_LOADED
    return 0
end
set -g __DOTFILES_FISH_BOOTSTRAP_LOADED 1

source ~/.config/dotfiles/vendor/fish/core.fish
source ~/.config/dotfiles/vendor/fish/runtime.fish

dedupe_path
