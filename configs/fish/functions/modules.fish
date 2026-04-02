#!/usr/bin/env fish

# DOCSTRING: Module management for shell runtime categories
function modules --description "Show and manage shell runtime categories"
    switch "$argv[1]"
        case --help -h help
            _show_modules_help
            return 0
        case --list -l list
            _list_all_modules
            return 0
        case --search -s search
            if test (count $argv) -lt 2
                echo "Error: search requires a search term"
                return 1
            end
            _search_modules $argv[2]
            return 0
        case --category -c category
            if test (count $argv) -lt 2
                echo "Available categories: dotfiles, navigation, shell-utils, system, dev, git, fzf, drizzle, apps, gnome"
                return 1
            end
            help $argv[2]
            return 0
        case dotfiles navigation shell-utils system dev git fzf drizzle apps gnome
            help $argv[1]
            return 0
    end

    if test (count $argv) -eq 0
        _show_modules_quick_help
    else
        for arg in $argv
            type $arg 2>/dev/null || echo "$arg: not found"
        end
    end
end

function _show_modules_help
    c "╔══════════════════════════════════════════════════════════════════════════════╗"
    c "║                    MODULES SYSTEM FOR SHELL WORKFLOWS                      ║"
    c "╚══════════════════════════════════════════════════════════════════════════════╝"
    echo ""
    y "Usage: modules [OPTION] [ARGS]"
    echo ""

    g "Options (supports multiple formats):"
    printf "  %-20s %s\n" "help, --help, -h" "Show this help message"
    printf "  %-20s %s\n" "list, --list, -l" "List all runtime categories"
    printf "  %-20s %s\n" "search, --search, -s" "Search category files containing TERM"
    printf "  %-20s %s\n" "category, --category, -c" "Show a specific category"
    echo ""

    bl "Direct Category Access:"
    printf "  %-20s %s\n" "dotfiles" "Show dotfiles command helpers"
    printf "  %-20s %s\n" "navigation" "Show navigation and file browsing helpers"
    printf "  %-20s %s\n" "shell-utils" "Show general shell shortcuts and overrides"
    printf "  %-20s %s\n" "system" "Show privileged machine control helpers"
    printf "  %-20s %s\n" "dev" "Show development and build helpers"
    printf "  %-20s %s\n" "git" "Show git workflow helpers"
    printf "  %-20s %s\n" "fzf" "Show fuzzy finder helpers"
    printf "  %-20s %s\n" "drizzle" "Show database ORM helpers"
    printf "  %-20s %s\n" "apps" "Show desktop app launchers"
    printf "  %-20s %s\n" "gnome" "Show GNOME workflow helpers"
    echo ""

    c "Examples:"
    echo "  modules list            # Show all categories"
    echo "  modules search npm      # Find runtime commands containing 'npm'"
    echo "  modules dotfiles        # Show dotfiles command helpers"
    echo "  modules dev             # Show only development helpers"
    echo "  modules apps            # Show app launchers"
    echo ""
    echo "  modules --list          # Traditional format also supported"
    echo "  modules -s npm          # Short flags also supported"
    echo ""
    echo "Related commands:"
    echo "  help --all              # Show comprehensive help for all helpers"
    echo "  dotfiles --help         # Show dotfiles management help"
    echo ""
    echo "Runtime categories now live in tools/*.fish."
end

function _show_modules_quick_help
    echo "Quick Module Overview:"
    echo ""
    echo "Most used runtime helpers:"
    echo "  df, dotfiles, reload (dotfiles)"
    echo "  c, x, q (shell-utils)"
    echo "  ., .., l, tree (navigation)"
    echo "  r, rr, i, pi, v, vi, vim (development)"
    echo "  whatsapp, spotify, code (apps)"
    echo ""
    echo "For detailed help:"
    echo "  modules --help   # Full module help system"
    echo "  help --all       # Complete dotfiles help"
    echo "  modules --list   # List all categories"
end

function _list_all_modules
    c "All Runtime Categories:"
    echo ""

    set -l categories dotfiles navigation shell-utils system dev git fzf drizzle apps gnome

    for category in $categories
        set -l category_file ~/.config/dotfiles/tools/$category.fish
        if test -f $category_file
            help --$category 2>/dev/null
            echo ""
        end
    end
end

function _search_modules
    set -l search_term $argv[1]
    set -l found_matches false

    y "Searching runtime categories for: '$search_term'"
    echo ""

    set -l categories dotfiles navigation shell-utils system dev git fzf drizzle apps gnome

    for category in $categories
        set -l category_file ~/.config/dotfiles/tools/$category.fish
        if test -f $category_file
            set -l matches (grep -i "$search_term" $category_file | grep -E "(alias |function )")
            if test -n "$matches"
                set found_matches true
                g "Found in $category.fish:"
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

    if test "$found_matches" = "false"
        echo "No runtime helpers found containing '$search_term'"
        echo ""
        echo "Try:"
        echo "  modules --list   # See all available categories"
        echo "  help --all       # See all helpers and functions"
    end
end
