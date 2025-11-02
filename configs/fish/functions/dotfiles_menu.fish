#!/usr/bin/env fish

# DOCSTRING: Simple wrapper that calls the TypeScript dotfiles CLI
function dotfiles_menu -d "Interactive dotfiles management system"
    # Just call the TypeScript CLI - it's much better
    ~/.config/dotfiles/bin/dotfiles $argv
end
## tauri 2.0 mutation test