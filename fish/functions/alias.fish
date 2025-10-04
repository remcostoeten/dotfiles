#!/usr/bin/env fish

# DOCSTRING: Alias management and help system
function alias --description "Show and manage aliases with comprehensive help"
    # Check for help flag first
    if test "$argv[1]" = "--help" -o "$argv[1]" = "-h"
        _show_alias_help
        return 0
    end
    
    # Check for list flag
    if test "$argv[1]" = "--list" -o "$argv[1]" = "-l"
        _list_all_aliases
        return 0
    end
    
    # Check for search flag
    if test "$argv[1]" = "--search" -o "$argv[1]" = "-s"
        if test (count $argv) -lt 2
            echo "Error: --search requires a search term"
            return 1
        end
        _search_aliases $argv[2]
        return 0
    end
    
    # Check for category flag
    if test "$argv[1]" = "--category" -o "$argv[1]" = "-c"
        if test (count $argv) -lt 2
            echo "Available categories: system, dev, git, fzf, drizzle"
            return 1
        end
        help --$argv[2]
        return 0
    end
    
    # If no special flags, fall back to fish's built-in alias command
    if test (count $argv) -eq 0
        _show_alias_quick_help
    else
        builtin alias $argv
    end
end

function _show_alias_help
    set_color cyan
    echo "╔══════════════════════════════════════════════════════════════════════════════╗"
    echo "║                            ALIAS HELP SYSTEM                                ║"
    echo "╚══════════════════════════════════════════════════════════════════════════════╝"
    set_color normal
    echo ""
    echo "Usage: alias [OPTIONS] [ALIAS_DEFINITION]"
    echo ""
    echo "Options:"
    echo "  -h, --help              Show this help message"
    echo "  -l, --list              List all custom aliases by category"
    echo "  -s, --search TERM       Search for aliases containing TERM"
    echo "  -c, --category CAT      Show aliases for specific category"
    echo ""
    echo "Categories:"
    echo "  system                  System and navigation aliases"
    echo "  dev                     Development and build aliases"
    echo "  git                     Git workflow aliases"
    echo "  fzf                     Fuzzy finder aliases"
    echo "  drizzle                 Database ORM aliases"
    echo ""
    echo "Examples:"
    echo "  alias --list            # Show all aliases organized by category"
    echo "  alias --search npm      # Find all aliases containing 'npm'"
    echo "  alias --category dev    # Show only development aliases"
    echo "  alias myalias='command' # Create a new alias"
    echo ""
    echo "Related commands:"
    echo "  help --all              # Show comprehensive help for all commands"
    echo "  dotfiles --help         # Show dotfiles management help"
end

function _show_alias_quick_help
    echo "Quick Alias Overview:"
    echo ""
    echo "Most used aliases:"
    echo "  c, x, ., reload, dotfiles (system)"
    echo "  r, rr, i, pi, v, vi, vim (development)"
    echo ""
    echo "For detailed help:"
    echo "  alias --help     # Full alias help system"
    echo "  help --all       # Complete dotfiles help"
    echo "  alias --list     # List all aliases by category"
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
        echo "  alias --list     # See all available aliases"
        echo "  help --all       # See all commands and functions"
    end
end