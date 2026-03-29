#!/usr/bin/env fish

# Source all top-level alias modules.
if test -d ~/.config/dotfiles/aliases
    for alias_file in ~/.config/dotfiles/aliases/*.fish
        if test -f $alias_file
            source $alias_file
        end
    end
end
