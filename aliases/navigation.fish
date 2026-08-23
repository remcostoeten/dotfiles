#!/usr/bin/env fish

# DOCSTRING: Open current directory in file manager
function .
    xdg-open .
end

# DOCSTRING: Go back one directory
alias ..='cd ..'

# DOCSTRING: Go back two directories
alias ...='cd ../..'

# DOCSTRING: Go back three directories
alias ....='cd ../../..'

# DOCSTRING: Replace ls with exa
alias ls='eza --icons'

# DOCSTRING: Better find replacement
if type -q fd
    alias find='fd'
else
    alias find='find'
end

# DOCSTRING: Custom list command showing size and name with ricer styling
function l
    if set -q argv[1]; and string match -q -- -h --help $argv[1]
        set_color cyan
        echo "╔══════════════════════════════════════════════════════════════════════════════╗"
        echo "║                         L - DIRECTORY LISTER                                 ║"
        echo "╚══════════════════════════════════════════════════════════════════════════════╝"
        set_color normal
        echo ""
        set_color yellow
        echo "Usage: l [OPTIONS] [PATH]"
        echo ""
        set_color green
        echo "Options:"
        printf "  %-20s %s\n" (set_color -o magenta)"-h, --help"(set_color green) (set_color normal)"Show this help message"
        printf "  %-20s %s\n" (set_color -o magenta)"-a, --all"(set_color green) (set_color normal)"Show hidden files"
        echo ""
        set_color blue
        echo "Description:"
        echo "  🎨 Directory listing with colors and icons"
        echo "  🎯 Minimal output, maximum aesthetics"
        echo ""
        set_color purple
        echo "Examples:"
        echo "  l              # List current directory"
        echo "  l -a           # Include hidden files"
        echo "  l /path/to/dir # List specific directory"
        set_color normal
        return 0
    end

    set -l exa_args
    set -l path_arg
    for arg in $argv
        switch $arg
            case -a --all
                set -a exa_args --all
            case '-*'
                echo "Unknown option: $arg" >&2
                return 1
            case '*'
                set path_arg $arg
        end
    end

    if not set -q path_arg
        set path_arg .
    end

    exa -l --icons --color=always --group-directories-first $exa_args $path_arg
end
