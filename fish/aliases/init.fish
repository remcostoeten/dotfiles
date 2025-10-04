#!/usr/bin/env fish

# Aliases initialization
# Sources all alias files

set alias_dir (dirname (status --current-filename))

# Source all alias files
for alias_file in $alias_dir/*.fish
    if test (basename $alias_file) != "init.fish"
        source $alias_file
    end
end