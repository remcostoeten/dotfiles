#!/usr/bin/env fish

# DOCSTRING: Show help for dotfiles configuration and aliases
function help --description "Show comprehensive help for dotfiles and aliases"
    # Parse arguments
    set -l show_category ""
    set -l show_all false
    
    # Parse command line arguments (support both --flag and flag formats)
    for arg in $argv
        switch $arg
            case --all -a all
                set show_all true
            case --system -s system
                set show_category "system"
            case --dev -d dev
                set show_category "dev"
            case --git -g git
                set show_category "git"
            case --fzf -f fzf
                set show_category "fzf"
            case --drizzle -z drizzle
                set show_category "drizzle"
            case --scripts -t scripts
                _show_scripts_help
                return 0
            case --overview -o overview
                _show_dotfiles_overview
                return 0
            case --help -h help
                _show_help_usage
                return 0
            case '*'
                set_color red
                echo "Unknown option: $arg"
                set_color normal
                echo ""
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
    set_color cyan
    echo "╭─────────────────────────────────────────────────────────────────────╮"
    echo "│                          HELP USAGE                                │"
    echo "╰─────────────────────────────────────────────────────────────────────╯"
    set_color normal
    echo ""
    
    set_color yellow
    echo "Usage: help [OPTION]"
    set_color normal
    echo ""
    
    set_color green
    echo "Options (supports both formats):"
    set_color normal
    printf "  %-20s %s\n" "all, --all, -a" "Show all aliases and functions"
    printf "  %-20s %s\n" "system, --system, -s" "Show system aliases"
    printf "  %-20s %s\n" "dev, --dev, -d" "Show development aliases"
    printf "  %-20s %s\n" "git, --git, -g" "Show git aliases"
    printf "  %-20s %s\n" "fzf, --fzf, -f" "Show fzf aliases"
    printf "  %-20s %s\n" "drizzle, --drizzle, -z" "Show drizzle aliases"
    printf "  %-20s %s\n" "scripts, --scripts, -t" "Show available scripts and tools"
    printf "  %-20s %s\n" "overview, --overview, -o" "Show dotfiles structure and overview"
    printf "  %-20s %s\n" "help, --help, -h" "Show this help message"
    echo ""
    
    set_color blue
    echo "Examples:"
    set_color normal
    echo "  help all         # Show all available aliases"
    echo "  help dev         # Show only development aliases"
    echo "  help system      # Show only system aliases"
    echo "  help scripts     # Show available scripts and tools"
    echo "  help overview    # Show dotfiles structure and setup"
    echo ""
    echo "  help --all       # Traditional format also supported"
    echo "  help -d          # Short flags also supported"
end

function _show_general_help
    set_color yellow --bold
    echo "🚀 Quick Help - Most Used Commands"
    set_color normal
    echo ""
    
    # System & Navigation section
    set_color green --bold
    echo "🖥️  System & Navigation:"
    set_color normal
    printf "  %-12s %s\n" "c" "$(set_color brblack)Clear terminal$(set_color normal)"
    printf "  %-12s %s\n" "x" "$(set_color brblack)Exit terminal$(set_color normal)"
    printf "  %-12s %s\n" "." "$(set_color brblack)Open current directory in file manager$(set_color normal)"
    printf "  %-12s %s\n" "reload" "$(set_color brblack)Reload fish configuration$(set_color normal)"
    printf "  %-12s %s\n" "dotfiles" "$(set_color brblack)Go to dotfiles directory$(set_color normal)"
    echo ""
    
    # Development section
    set_color blue --bold
    echo "⚡ Development:"
    set_color normal
    printf "  %-12s %s\n" "v/vi/vim" "$(set_color brblack)Open with Neovim$(set_color normal)"
    printf "  %-12s %s\n" "r" "$(set_color brblack)Run development server (bun)$(set_color normal)"
    printf "  %-12s %s\n" "rr" "$(set_color brblack)Run development server (pnpm)$(set_color normal)"
    printf "  %-12s %s\n" "i" "$(set_color brblack)Install dependencies (bun)$(set_color normal)"
    printf "  %-12s %s\n" "pi" "$(set_color brblack)Install dependencies (pnpm)$(set_color normal)"
    printf "  %-12s %s\n" "deploy" "$(set_color brblack)Deploy to Vercel$(set_color normal)"
    printf "  %-12s %s\n" "prod" "$(set_color brblack)Deploy to Vercel production$(set_color normal)"
    echo ""
    
    # Scripts & Tools section
    set_color magenta --bold
    echo "🔧 Featured Scripts & Tools:"
    set_color normal
    printf "  %-12s %s\n" "postgres" "$(set_color brblack)Interactive PostgreSQL database manager$(set_color normal)"
    printf "  %-12s %s\n" "ui" "$(set_color brblack)Smart React component migration tool$(set_color normal)"
    printf "  %-12s %s\n" "unused" "$(set_color brblack)Find & remove unused TypeScript/JavaScript files$(set_color normal)"
    printf "  %-12s %s\n" "copy" "$(set_color brblack)Interactive development workflow utility$(set_color normal)"
    echo ""
    
    # Help options section
    set_color cyan --bold
    echo "📚 Explore More:"
    set_color normal
    
    # Create a nice grid layout for help options
    set_color yellow
    printf "  %-15s %-15s %s\n" "help all" "help system" "help dev"
    printf "  %-15s %-15s %s\n" "help scripts" "help overview" "aliases --help"
    set_color normal
    echo ""
    
    # Quick tip
    set_color brblack
    echo "💡 Tip: All commands support both formats: 'help dev' and 'help --dev'"
    set_color normal
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

function _show_scripts_help
    set_color cyan
    echo "🔧 AVAILABLE SCRIPTS & TOOLS"
    set_color normal
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    set_color green
    echo "Development & Code Tools:"
    set_color normal
    echo "  unused         - Find & remove unused TypeScript/JavaScript files"
    echo "                   Advanced code analysis with backup/restore functionality"
    echo "  ui             - Smart React Component Migration Tool v2.0"
    echo "                   Migrates and transforms UI components"
    echo "  copy           - Interactive display utility for development workflows"
    echo "                   Works with files, directories, git remotes, and more"
    echo "  cat            - Enhanced cat with syntax highlighting (bat wrapper)"
    echo "                   Provides better code viewing experience"
    echo ""
    
    set_color blue  
    echo "Database & Analytics:"
    set_color normal
    echo "  postgres       - PostgreSQL Database Manager CLI v1.0"
    echo "                   Full-featured interactive database management"
    echo "  pgtable        - PostgreSQL table analyzer with AI recommendations"
    echo "                   Analyzes performance and suggests optimizations"
    echo "  db_analyzer.py - Database analysis script with Gemini AI integration"
    echo "                   Comprehensive database performance analysis"
    echo ""
    
    set_color magenta
    echo "Docker & Container Tools:"
    set_color normal
    echo "  docker-manager - Interactive Docker container management"
    echo "                   Complete Docker workflow management"
    echo "  scripts/docker/- Advanced TypeScript Docker utilities"
    echo "                   Docker utilities, system utils, terminal manager"
    echo ""
    
    set_color red
    echo "System & Process Management:"
    set_color normal
    echo "  kill-ports     - Kill processes running on specific ports"
    echo "                   Smart port management with process detection"
    echo "  click          - Click automation utility"
    echo "                   Automated clicking with configurable rate/duration"
    echo ""
    
    set_color cyan
    echo "CLI & Interactive Tools:"
    set_color normal
    echo "  dotfiles       - Interactive dotfiles menu (TypeScript/React)"
    echo "                   Main dotfiles management interface"
    echo "  simple-menu.ts - TypeScript CLI menu system"
    echo "                   Base for interactive command-line tools"
    echo "  .cli/index.tsx - React/Ink based CLI applications"
    echo "                   Advanced terminal user interfaces"
    echo ""
    
    set_color yellow
    echo "Script Categories by Type:"
    set_color normal
    printf "  %-15s %s\n" "📝 Python:" "postgres, ui, db_analyzer.py"
    printf "  %-15s %s\n" "🐙 TypeScript:" "dotfiles, simple-menu.ts, docker utilities"
    printf "  %-15s %s\n" "📜 Bash:" "copy, docker-manager, kill-ports, click, cat"
    printf "  %-15s %s\n" "⚙️ Binary:" "unused (Go/Rust), pgtable"
    echo ""
    
    set_color white
    echo "Quick Access:"
    set_color normal
    echo "  All scripts in bin/ are in PATH and executable anywhere"
    echo "  Most scripts support --help for detailed usage"
    echo "  Interactive tools: postgres, docker-manager, dotfiles, ui"
    echo "  Automation tools: unused, click, kill-ports, pgtable"
    echo ""
    
    set_color brblack
    echo "💡 Pro tip: Try 'dotfiles' for the main interactive interface!"
    set_color normal
    echo ""
end

function _show_dotfiles_overview
    set_color cyan
    echo "📁 DOTFILES STRUCTURE & OVERVIEW"
    set_color normal
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    set_color green
    echo "Directory Structure:"
    set_color normal
    echo "  ~/.config/dotfiles/"
    echo "  ├── fish/                    # Fish shell configuration"
    echo "  │   ├── aliases/             # Organized alias files"
    echo "  │   ├── functions/           # Custom fish functions"
    echo "  │   ├── core/               # Core configuration (colors, env)"
    echo "  │   └── config.fish         # Main fish config"
    echo "  ├── bin/                    # Executable scripts (in PATH)"
    echo "  ├── scripts/                # Python & utility scripts"
    echo "  ├── .cli/                   # TypeScript CLI tools"
    echo "  └── README.md              # Documentation"
    echo ""
    
    set_color blue
    echo "Key Features:"
    set_color normal
    echo "  • Modular Configuration     - Organized by function and purpose"
    echo "  • Automatic Help System     - Self-documenting aliases and functions"
    echo "  • Cross-shell Compatibility - Primarily Fish, with fallbacks"
    echo "  • Developer Tools           - Database, Docker, file management"
    echo "  • Package Manager Support   - Both pnpm and bun workflows"
    echo "  • Git Integration           - Comprehensive git aliases and functions"
    echo ""
    
    set_color yellow
    echo "Configuration Files:"
    set_color normal
    echo "  • Main Config: ~/.config/dotfiles/fish/config.fish"
    echo "  • Colors:      ~/.config/dotfiles/fish/core/colors.fish"
    echo "  • Environment: ~/.config/dotfiles/fish/core/env.fish"
    echo "  • Aliases:     ~/.config/dotfiles/fish/aliases/*.fish"
    echo ""
    
    set_color magenta
    echo "Package Managers:"
    set_color normal
    echo "  Primary:   bun     (preferred for speed)"
    echo "  Fallback:  pnpm    (when bun is unavailable)"
    echo "  Forbidden: npm, yarn (consistent environment)"
    echo ""
    
    set_color cyan
    echo "Editor & Tools:"
    set_color normal
    echo "  Editor:    Neovim  (v, vi, vim aliases)"
    echo "  Terminal:  Fish    (with custom functions)"
    echo "  File Mgr:  exa     (enhanced ls replacement)"
    echo "  Finder:    fzf     (fuzzy finding everywhere)"
    echo ""
    
    set_color white
    echo "Getting Started:"
    set_color normal
    echo "  1. help --all        # See all available commands"
    echo "  2. aliases --list    # Browse all aliases by category"
    echo "  3. help --scripts    # Explore available tools"
    echo "  4. dotfiles          # Navigate to dotfiles directory"
    echo "  5. reload            # Apply configuration changes"
    echo ""
    
    set_color green
    echo "Customization:"
    set_color normal
    echo "  • Add aliases to appropriate files in fish/aliases/"
    echo "  • Use DOCSTRING comments for automatic help integration"
    echo "  • New scripts go in bin/ (executable) or scripts/ (utility)"
    echo "  • Run 'reload' after making changes"
    echo ""
    
    set_color yellow
    echo "Documentation:"
    set_color normal
    echo "  • README.md          - Basic setup and structure"
    echo "  • HELP.md            - Comprehensive help documentation"
    echo "  • .cli/README.md     - TypeScript CLI tools info"
    echo "  • help --help        - This help system usage"
    echo ""
end
