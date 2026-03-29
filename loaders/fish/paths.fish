#!/usr/bin/env fish

# Ensure top-level runtime directories are on PATH and executable.
if test -d ~/.config/dotfiles/bin
    add_to_path ~/.config/dotfiles/bin

    for file in ~/.config/dotfiles/bin/*
        if test -f $file
            chmod +x $file
        end
    end
end

if test -d ~/.config/dotfiles/scripts
    add_to_path ~/.config/dotfiles/scripts

    for file in ~/.config/dotfiles/scripts/*
        if test -f $file
            chmod +x $file
        end
    end
end

if test -d $HOME/.local/bin
    add_to_path $HOME/.local/bin
end

if test -d $HOME/bin
    add_to_path $HOME/bin
end
