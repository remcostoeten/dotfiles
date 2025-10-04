#!/usr/bin/env fish

# DOCSTRING: Show help for dotfiles configuration and aliases
function help --description "Show comprehensive help for dotfiles and aliases"
    # Parse arguments
    set -l show_category ""
    set -l show_all false
    
    # Parse command line arguments
    for arg in $argv
        switch $arg
            case --all -a
                set show_all true
            case --system -s
                set show_category "system"
            case --dev -d
                set show_category "dev"
            case --git -g
                set show_category "git"
            case --fzf -f
                set show_category "fzf"
            case --drizzle -z
                set show_category "drizzle"
            case --help -h
                _show_help_usage
                return 0
            case '*'
                echo "Unknown option: $arg"
                _show_help_usage
                return 1
        end
    end
    
    # Show header
    _show_help_header
    
    # Show specific category or all
    if test -n "$show_category"
        _show_category_help $show_category
    else if test "$show_all" = "true"
        _show_all_categories
    else
        _show_general_help
    end
end

function _show_help_header
    set_color cyan
    echo "╔══════════════════════════════════════════════════════════════════════════════╗"
    echo "║                            DOTFILES HELP SYSTEM                             ║"
    echo "╚══════════════════════════════════════════════════════════════════════════════╝"
    set_color normal
    echo
end

function _show_help_usage
    echo "Usage: help [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -a, --all        Show all aliases and functions"
    echo "  -s, --system     Show system aliases"
    echo "  -d, --dev        Show development aliases"
    echo "  -g, --git        Show git aliases"
    echo "  -f, --fzf        Show fzf aliases"
    echo "  -z, --drizzle    Show drizzle aliases"
    echo "  -h, --help       Show this help message"
    echo ""
    echo "Examples:"
    echo "  help --all       # Show all available aliases"
    echo "  help --dev       # Show only development aliases"
    echo "  help --system    # Show only system aliases"
end

function _show_general_help
    echo "Quick Help - Most Used Commands:"
    echo ""
    
    set_color green
    echo "System & Navigation:"
    set_color normal
    echo "  c          - Clear terminal"
    echo "  x          - Exit terminal"
    echo "  .          - Open current directory in file manager"
    echo "  reload     - Reload fish configuration"
    echo "  dotfiles   - Go to dotfiles directory"
    echo ""
    
    set_color blue
    echo "Development:"
    set_color normal
    echo "  v/vi/vim   - Open with Neovim"
    echo "  r          - Run development server (bun)"
    echo "  rr         - Run development server (pnpm)"
    echo "  i          - Install dependencies (bun)"
    echo "  pi         - Install dependencies (pnpm)"
    echo ""
    
    set_color yellow
    echo "For more detailed help:"
    set_color normal
    echo "  help --all     - Show all available commands"
    echo "  help --system  - Show system commands"
    echo "  help --dev     - Show development commands"
    echo "  alias --help   - Show alias-specific help"
    echo ""
end

function _show_all_categories
    set -l categories system dev git fzf drizzle
    
    for category in $categories
        _show_category_help $category
        echo ""
    end
end

function _show_category_help
    set -l category $argv[1]
    set -l alias_file ~/.config/dotfiles/fish/aliases/$category.fish
    
    if not test -f $alias_file
        echo "Category '$category' not found."
        return 1
    end
    
    # Set category color and title
    switch $category
        case system
            set_color red
            echo "🖥️  SYSTEM ALIASES"
        case dev
            set_color blue
            echo "⚡ DEVELOPMENT ALIASES"
        case git
            set_color green
            echo "📝 GIT ALIASES"
        case fzf
            set_color purple
            echo "🔍 FZF ALIASES"
        case drizzle
            set_color yellow
            echo "💧 DRIZZLE ALIASES"
    end
    set_color normal
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    # Parse the file for aliases and functions
    _parse_aliases_from_file $alias_file
end

function _parse_aliases_from_file
    set -l file $argv[1]
    
    if not test -f $file
        echo "File not found: $file"
        return 1
    end
    
    set -l current_docstring ""
    set -l in_function false
    set -l function_name ""
    
    while read -l line
        # Check for DOCSTRING comments
        if string match -q "# DOCSTRING:*" $line
            set current_docstring (string replace "# DOCSTRING: " "" $line)
        else if string match -q "alias *" $line
            # Parse alias
            set -l alias_def (string replace "alias " "" $line)
            set -l alias_name (string split " " $alias_def)[1]
            set -l alias_command (string split " " $alias_def)[2..-1] | string join " "
            set alias_command (string replace -a "'" "" $alias_command)
            set alias_command (string replace -a "\"" "" $alias_command)
            
            printf "  %-12s - %s\n" $alias_name $current_docstring
            set current_docstring ""
        else if string match -q "function *" $line
            # Parse function start
            set in_function true
            set function_name (string split " " $line)[2]
        else if string match -q "end" $line; and test "$in_function" = "true"
            # Function end
            if test -n "$current_docstring"
                printf "  %-12s - %s\n" $function_name $current_docstring
            end
            set in_function false
            set function_name ""
            set current_docstring ""
        end
    end < $file
end