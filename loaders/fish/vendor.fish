#!/usr/bin/env fish

function __dotfiles_vendor_init --argument tool shell
    echo ~/.config/dotfiles/packages/_vendor/$tool/init.$shell
end

# Source all Fish-native vendor runtime snippets.
if test -d ~/.config/dotfiles/packages/_vendor
    for vendor_dir in ~/.config/dotfiles/packages/_vendor/*
        if test -d $vendor_dir
            set -l vendor_file $vendor_dir/init.fish
            if test -f $vendor_file
                source $vendor_file
            end
        end
    end
end
