#!/usr/bin/env fish

# DOCSTRING: Alias management and help system (using 'aliases' to avoid conflicts with fish built-in)
function aliases --description "Show and manage aliases with comprehensive help"
    # Parse first argument to determine action
    switch "$argv[1]"
        case --help -h help
            _show_aliases_help
            return 0
        case --list -l list
            _list_all_aliases
            return 0
        case --search -s search
            if test (count $argv) -lt 2
                echo "Error: search requires a search term"
                return 1
            end
            _search_aliases $argv[2]
            return 0
        case --category -c category
            if test (count $argv) -lt 2
                echo "Available categories: system, dev, git, fzf, drizzle"
                return 1
            end
            help $argv[2]
            return 0
        case system dev git fzf drizzle
            # Direct category access
            help $argv[1]
            return 0
    end
    
    # If no special flags, show quick help
    if test (count $argv) -eq 0
        _show_aliases_quick_help
    else
        # Show information about the given command(s)
        for arg in $argv
            type $arg 2>/dev/null || echo "$arg: not found"
        end
    end
end

function _show_aliases_help
    set_color cyan
    echo "╔══════════════════════════════════════════════════════════════════════════════╗"
    echo "║                         ALIASES MANAGEMENT SYSTEM                           ║"
    echo "╚══════════════════════════════════════════════════════════════════════════════╝"
    set_color normal
    echo ""
    set_color yellow
    echo "Usage: aliases [OPTION] [ARGS]"
    set_color normal
    echo ""
    
    set_color green
    echo "Options (supports multiple formats):"
    set_color normal
    printf "  %-20s %s\n" "help, --help, -h" "Show this help message"
    printf "  %-20s %s\n" "list, --list, -l" "List all custom aliases by category"
    printf "  %-20s %s\n" "search, --search, -s" "Search for aliases containing TERM"
    printf "  %-20s %s\n" "category, --category, -c" "Show aliases for specific category"
    echo ""
    
    set_color blue
    echo "Direct Category Access:"
    set_color normal
    printf "  %-20s %s\n" "system" "Show system and navigation aliases"
    printf "  %-20s %s\n" "dev" "Show development and build aliases"
    printf "  %-20s %s\n" "git" "Show git workflow aliases"
    printf "  %-20s %s\n" "fzf" "Show fuzzy finder aliases"
    printf "  %-20s %s\n" "drizzle" "Show database ORM aliases"
    echo ""
    
    set_color cyan
    echo "Examples:"
    set_color normal
    echo "  aliases list            # Show all aliases organized by category"
    echo "  aliases search npm      # Find all aliases containing 'npm'"
    echo "  aliases dev             # Show only development aliases"
    echo "  aliases system          # Show only system aliases"
    echo "  aliases c               # Show info about the 'c' command"
    echo ""
    echo "  aliases --list          # Traditional format also supported"
    echo "  aliases -s npm          # Short flags also supported"
    echo ""
    echo "Related commands:"
    echo "  help --all              # Show comprehensive help for all commands"
    echo "  dotfiles --help         # Show dotfiles management help"
    echo ""
    echo "Note: Use 'aliases' (plural) to avoid conflicts with fish's built-in 'alias' command."
end

function _show_aliases_quick_help
    echo "Quick Alias Overview:"
    echo ""
    echo "Most used aliases:"
    echo "  c, x, ., reload, dotfiles (system)"
    echo "  r, rr, i, pi, v, vi, vim (development)"
    echo ""
    echo "For detailed help:"
    echo "  aliases --help   # Full aliases help system"
    echo "  help --all       # Complete dotfiles help"
    echo "  aliases --list   # List all aliases by category"
end

function _list_all_aliases
    set_color cyan
    echo "All Custom Aliases by Category:"
    set_color normal
    echo ""
    
    set -l categories system dev git fzf drizzle
    
    for category in $categories
        set -l alias_file ~/.config/dotfiles/fish/aliases/$category.fish
        if test -f $alias_file
            help --$category 2>/dev/null
            echo ""
        end
    end
end

function _search_aliases
    set -l search_term $argv[1]
    set -l found_aliases false
    
    set_color yellow
    echo "Searching for aliases containing: '$search_term'"
    set_color normal
    echo ""
    
    set -l categories system dev git fzf drizzle
    
    for category in $categories
        set -l alias_file ~/.config/dotfiles/fish/aliases/$category.fish
        if test -f $alias_file
            set -l matches (grep -i "$search_term" $alias_file | grep -E "(alias |function )")
            if test -n "$matches"
                set found_aliases true
                set_color green
                echo "Found in $category.fish:"
                set_color normal
                echo "$matches" | while read -l line
                    if string match -q "alias *" $line
                        set -l alias_name (string split " " $line | head -n 2 | tail -n 1)
                        echo "  $alias_name"
                    else if string match -q "function *" $line
                        set -l func_name (string split " " $line | head -n 2 | tail -n 1)
                        echo "  $func_name (function)"
                    end
                end
                echo ""
            end
        end
    end
    
    if test "$found_aliases" = "false"
        echo "No aliases found containing '$search_term'"
        echo ""
        echo "Try:"
        echo "  aliases --list   # See all available aliases"
        echo "  help --all       # See all commands and functions"
    end
end