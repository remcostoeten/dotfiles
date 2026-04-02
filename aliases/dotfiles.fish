#!/usr/bin/env fish

# DOCSTRING: Quick access to the interactive dotfiles menu
function df
    if test (count $argv) -eq 0
        dotfiles interactive
    else
        dotfiles $argv
    end
end

# DOCSTRING: Change to the dotfiles repository
alias dot 'cd ~/.config/dotfiles'

# DOCSTRING: Todo/task manager shortcut
alias todo '$HOME/.config/dotfiles/bin/todo'

# DOCSTRING: Scripts selector shortcut
alias scripts '$HOME/.config/dotfiles/bin/scripts'

# DOCSTRING: Dotfiles command line interface
function dotfiles
    if test (count $argv) -eq 0
        if test -t 1; and status --is-interactive
            command bun ~/.config/dotfiles/scripts/dotfiles.ts interactive
        else
            command bun ~/.config/dotfiles/scripts/dotfiles.ts --help
        end
    else if contains -- --i $argv[1]; or contains -- -i $argv[1]; or contains -- i $argv[1]; or contains -- interactive $argv[1]
        if test -t 1; and status --is-interactive
            command bun ~/.config/dotfiles/scripts/dotfiles.ts interactive
            if test $status -ne 0
                command bun ~/.config/dotfiles/scripts/dotfiles.ts --help
            end
        else
            command bun ~/.config/dotfiles/scripts/dotfiles.ts --help
        end
    else
        command bun ~/.config/dotfiles/scripts/dotfiles.ts $argv
    end
end

# DOCSTRING: Reload fish configuration
function reload
    if test "$argv[1]" = "--help" -o "$argv[1]" = "-h"
        echo "Reload fish configuration"
        echo ""
        echo "Usage: reload [OPTIONS]"
        echo ""
        echo "Options:"
        echo "  -h, --help    Show this help message"
        echo ""
        echo "Description:"
        echo "  Reloads the current fish shell configuration by starting"
        echo "  a new fish session. This applies all changes made to"
        echo "  configuration files without needing to restart the terminal."
        echo ""
        echo "Examples:"
        echo "  reload        # Reload fish configuration"
        echo "  reload -h     # Show this help"
        return 0
    end

    echo "Reloading fish configuration..."
    exec fish
end

function _show_dotfiles_help
    c "Dotfiles Management System"
    echo ""
    echo "Usage: dotfiles [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -h, --help    Show this help message"
    echo ""
    echo "Examples:"
    echo "  dotfiles list        # Show indexed tools"
    echo "  dotfiles interactive # Launch the interactive menu"
    echo "  df                   # Fast interactive shortcut"
    echo "  dotfiles -h          # Show this help"
    echo ""
    echo "Related commands:"
    echo "  help --all           # Show all available tool helpers and functions"
    echo "  dot                  # Jump to the dotfiles repository"
    echo "  reload               # Reload fish configuration"
    echo "  modules --help       # Show shell module help"
end
