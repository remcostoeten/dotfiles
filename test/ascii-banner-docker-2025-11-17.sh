#!/usr/bin/env fish

# Pastel colors matching cfg/docker scripts
set -l PASTEL_PINK (set_color faa2c1)
set -l PASTEL_MAGENTA (set_color d4bbf8)
set -l PASTEL_PURPLE (set_color a5d8ff)
set -l PASTEL_BLUE (set_color b2f2bb)
set -l PASTEL_CYAN (set_color ffec99)
set -l PASTEL_GREEN (set_color ffd8a8)
set -l PASTEL_YELLOW (set_color ffd43b)
set -l PASTEL_ORANGE (set_color ff8787)
set -l normal (set_color normal)

function get_version
    set version_file (dirname (status --current-filename))/../VERSION
    if test -f $version_file
        cat $version_file | tr -d '\n'
    else
        echo "unknown"
    end
end

# Default tagline
set -g defaultTagline "Welcome to the dotfiles experience!"

function show_banner
    set script_version (get_version)
    set tagline "$tagline"
    if test -z "$tagline"
        set tagline "$defaultTagline"
    end

    # ASCII art with gradient colors
    echo $PASTEL_PINK'    ██████╗  ██████╗  ██████╗██╗  ██╗███████╗██████╗'$normal
    echo $PASTEL_MAGENTA'    ██╔══██╗██╔═══██╗██╔════╝██║ ██╔╝██╔════╝██╔══██╗'$normal
    echo $PASTEL_PURPLE'    ██║  ██║██║   ██║██║     █████╔╝ █████╗  ██████╔╝'$normal
    echo $PASTEL_BLUE'    ██║  ██║██║   ██║██║     ██╔═██╗ ██╔══╝  ██╔══██╗'$normal
    echo $PASTEL_CYAN'    ██████╔╝╚██████╔╝╚██████╗██║  ██╗███████╗██║  ██║'$normal
    echo $PASTEL_GREEN'    ╚═════╝  ╚═════╝  ╚═════╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝'$normal

    # Show footer info
    echo -n "  "
    echo -n "$PASTEL_YELLOW" "updated "
    echo -n "$PASTEL_ORANGE" "(just now)"
    echo -n "$PASTEL_PINK" " · $script_version"
    echo -n "$PASTEL_CYAN" "  │  "
    echo -n "$PASTEL_BLUE" "$tagline"
    echo "$normal"
end

# Usage: show_banner
show_banner
