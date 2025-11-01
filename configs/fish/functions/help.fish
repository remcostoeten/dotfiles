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
                print_error "Unknown option: $arg"
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
    c "╔══════════════════════════════════════════════════════════════════════════════╗"
    c "║                            DOTFILES HELP SYSTEM                             ║"
    c "╚══════════════════════════════════════════════════════════════════════════════╝"
    echo
end

function _show_help_usage
    c "╭─────────────────────────────────────────────────────────────────────╮"
    c "│                          HELP USAGE                                │"
    c "╰─────────────────────────────────────────────────────────────────────╯"
    echo ""
    
    y "Usage: help [OPTION]"
    echo ""
    
    g "Options (supports both formats):"
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
    
    bl "Examples:"
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
    printf "%s%s\n" "$fish_color_yellow$fish_color_bold" "🚀 Quick Help - Most Used Commands"
    echo ""
    
    # System & Navigation section
    printf "%s%s\n" "$fish_color_green$fish_color_bold" "🖥️  System & Navigation:"
    printf "  %-12s %s\n" "c" "$fish_color_bright_blackClear terminal$fish_color_reset"
    printf "  %-12s %s\n" "x" "$fish_color_bright_blackExit terminal$fish_color_reset"
    printf "  %-12s %s\n" "." "$fish_color_bright_blackOpen current directory in file manager$fish_color_reset"
    printf "  %-12s %s\n" "reload" "$fish_color_bright_blackReload fish configuration$fish_color_reset"
    printf "  %-12s %s\n" "dotfiles" "$fish_color_bright_blackGo to dotfiles directory$fish_color_reset"
    echo ""
    
    # Development section
    printf "%s%s\n" "$fish_color_blue$fish_color_bold" "⚡ Development:"
    printf "  %-12s %s\n" "v/vi/vim" "$fish_color_bright_blackOpen with Neovim$fish_color_reset"
    printf "  %-12s %s\n" "r" "$fish_color_bright_blackRun development server (bun)$fish_color_reset"
    printf "  %-12s %s\n" "rr" "$fish_color_bright_blackRun development server (pnpm)$fish_color_reset"
    printf "  %-12s %s\n" "i" "$fish_color_bright_blackInstall dependencies (bun)$fish_color_reset"
    printf "  %-12s %s\n" "pi" "$fish_color_bright_blackInstall dependencies (pnpm)$fish_color_reset"
    printf "  %-12s %s\n" "deploy" "$fish_color_bright_blackDeploy to Vercel$fish_color_reset"
    printf "  %-12s %s\n" "prod" "$fish_color_bright_blackDeploy to Vercel production$fish_color_reset"
    echo ""
    
    # Scripts & Tools section
    printf "%s%s\n" "$fish_color_magenta$fish_color_bold" "🔧 Featured Scripts & Tools:"
    printf "  %-12s %s\n" "postgres" "$fish_color_bright_blackInteractive PostgreSQL database manager$fish_color_reset"
    printf "  %-12s %s\n" "ui" "$fish_color_bright_black🎨 Component Migration + 🔍 Code Analyzer v3.0$fish_color_reset"
    printf "  %-12s %s\n" "unused" "$fish_color_bright_blackFind & remove unused files (legacy, use 'ui --analyze')$fish_color_reset"
    printf "  %-12s %s\n" "copy" "$fish_color_bright_blackInteractive development workflow utility$fish_color_reset"
    echo ""
    
    # Help options section
    printf "%s%s\n" "$fish_color_cyan$fish_color_bold" "📚 Explore More:"
    
    # Create a nice grid layout for help options
    printf "%s  %-15s %-15s %s%s\n" "$fish_color_yellow" "help all" "help system" "help dev" "$fish_color_reset"
    printf "%s  %-15s %-15s %s%s\n" "$fish_color_yellow" "help scripts" "help overview" "aliases --help" "$fish_color_reset"
    echo ""
    
    # Quick tip
    printf "%s%s%s\n" "$fish_color_bright_black" "💡 Tip: All commands support both formats: 'help dev' and 'help --dev'" "$fish_color_reset"
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
    set -l alias_file ~/.config/dotfiles/configs/fish/aliases/$category.fish
    
    if not test -f $alias_file
        echo "Category '$category' not found."
        return 1
    end
    
    # Set category color and title with enhanced styling
    switch $category
        case system
            printf "%s%s\n" "$fish_color_red$fish_color_bold" "╭───────────────────────────────────────────────────────────╮"
            printf "%s│  🖥️  %-52s │%s\n" "$fish_color_red$fish_color_bold" "SYSTEM ALIASES" "$fish_color_reset"
            printf "%s%s\n" "$fish_color_red$fish_color_bold" "╰───────────────────────────────────────────────────────────╯"
        case dev
            printf "%s%s\n" "$fish_color_blue$fish_color_bold" "╭───────────────────────────────────────────────────────────╮"
            printf "%s│  ⚡ %-52s │%s\n" "$fish_color_blue$fish_color_bold" "DEVELOPMENT ALIASES" "$fish_color_reset"
            printf "%s%s\n" "$fish_color_blue$fish_color_bold" "╰───────────────────────────────────────────────────────────╯"
        case git
            printf "%s%s\n" "$fish_color_green$fish_color_bold" "╭───────────────────────────────────────────────────────────╮"
            printf "%s│  📝 %-52s │%s\n" "$fish_color_green$fish_color_bold" "GIT ALIASES" "$fish_color_reset"
            printf "%s%s\n" "$fish_color_green$fish_color_bold" "╰───────────────────────────────────────────────────────────╯"
        case fzf
            printf "%s%s\n" "$fish_color_magenta$fish_color_bold" "╭───────────────────────────────────────────────────────────╮"
            printf "%s│  🔍 %-52s │%s\n" "$fish_color_magenta$fish_color_bold" "FZF ALIASES" "$fish_color_reset"
            printf "%s%s\n" "$fish_color_magenta$fish_color_bold" "╰───────────────────────────────────────────────────────────╯"
        case drizzle
            printf "%s%s\n" "$fish_color_yellow$fish_color_bold" "╭───────────────────────────────────────────────────────────╮"
            printf "%s│  💧 %-52s │%s\n" "$fish_color_yellow$fish_color_bold" "DRIZZLE ALIASES" "$fish_color_reset"
            printf "%s%s\n" "$fish_color_yellow$fish_color_bold" "╰───────────────────────────────────────────────────────────╯"
    end
    echo ""
    
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
    
    # Arrays to store grouped aliases: docstring -> list of aliases
    set -l grouped_docstrings
    set -l grouped_aliases
    
    while read -l line
        # Check for NO DOCSTRING comments (exclude from help)
        if string match -q "# NO DOCSTRING:*" $line
            set current_docstring ""
        # Check for DOCSTRING comments
        else if string match -q "# DOCSTRING:*" $line
            set current_docstring (string replace "# DOCSTRING: " "" $line)
        else if string match -q "alias *" $line
            # Parse alias
            set -l alias_def (string replace "alias " "" $line)
            # Handle both 'alias name value' and 'alias name=value' formats
            set -l alias_name (string split -m 1 " " $alias_def)[1]
            set alias_name (string split -m 1 "=" $alias_name)[1]
            
            # Only process if there's a docstring (skip NO DOCSTRING entries)
            if test -n "$current_docstring"
                # Check if this docstring already exists
                set -l found_index 0
                set -l idx 1
                for doc in $grouped_docstrings
                    if test "$doc" = "$current_docstring"
                        set found_index $idx
                        break
                    end
                    set idx (math $idx + 1)
                end
                
                if test $found_index -gt 0
                    # Append to existing group
                    set grouped_aliases[$found_index] "$grouped_aliases[$found_index],$alias_name"
                else
                    # Create new group
                    set -a grouped_docstrings $current_docstring
                    set -a grouped_aliases $alias_name
                end
            end
            set current_docstring ""
        else if string match -q "function *" $line
            # Parse function start
            set in_function true
            set function_name (string split " " $line)[2]
        else if string match -q "end" $line; and test "$in_function" = "true"
            # Function end
            if test -n "$current_docstring"
                # Check if this docstring already exists
                set -l found_index 0
                set -l idx 1
                for doc in $grouped_docstrings
                    if test "$doc" = "$current_docstring"
                        set found_index $idx
                        break
                    end
                    set idx (math $idx + 1)
                end
                
                if test $found_index -gt 0
                    # Append to existing group
                    set grouped_aliases[$found_index] "$grouped_aliases[$found_index],$function_name"
                else
                    # Create new group
                    set -a grouped_docstrings $current_docstring
                    set -a grouped_aliases $function_name
                end
            end
            set in_function false
            set function_name ""
            set current_docstring ""
        end
    end < $file
    
    # Display grouped results with enhanced styling
    set -l idx 1
    for doc in $grouped_docstrings
        set -l aliases_list (string split "," $grouped_aliases[$idx])
        set -l aliases_str (string join "$fish_color_bright_black, $fish_color_cyan$fish_color_bold" $aliases_list)
        
        # Print alias with styled formatting
        printf "  %s%s%-20s%s %s→%s %s%s%s\n" \
            "$fish_color_cyan$fish_color_bold" \
            "$fish_color_cyan$fish_color_bold" \
            $aliases_str \
            "$fish_color_reset" \
            "$fish_color_bright_black" \
            "$fish_color_reset" \
            "$fish_color_white" \
            $doc \
            "$fish_color_reset"
        set idx (math $idx + 1)
    end
    echo ""
end

function _show_scripts_help
    c "🔧 AVAILABLE SCRIPTS & TOOLS"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    g "Development & Code Tools:"
    echo "  ui             - Interactive Developer Toolkit v3.0 (UPDATED!)"
    echo "                   🎨 Component Migration + 🔍 Unused Code Analyzer"
    echo "                   Combined tool with interactive menus for:"
    echo "                   • React/Next.js component migration & import updates"
    echo "                   • Unused files, imports, and exports detection"
    echo "                   • Automatic backups, dry-run modes, and cleanup"
    echo "                   Run: 'ui' (interactive) or 'ui --help' (CLI flags)"
    echo "  unused         - Find & remove unused files (use 'ui --analyze' instead)"
    echo "                   Note: This is an older standalone tool"
    echo "  copy           - Interactive display utility for development workflows"
    echo "                   Works with files, directories, git remotes, and more"
    echo "  cat            - Enhanced cat with syntax highlighting (bat wrapper)"
    echo "                   Provides better code viewing experience"
    echo ""
    
    bl "Database & Analytics:"
    echo "  db             - Unified Database Manager v1.0 (NEW!)"
    echo "                   🗄️ Interactive menu for all database tools:"
    echo "                   • PostgreSQL Manager • Turso Generator • Docker"
    echo "                   Run: 'db' (interactive) or 'db postgres', 'db turso', etc."
    echo "  postgres       - PostgreSQL Database Manager CLI v1.0"
    echo "                   Full-featured interactive database management"
    echo ""
    
    p "Docker & Container Tools:"
    echo "  docker-manager - Interactive Docker container management"
    echo "                   Complete Docker workflow management"
    echo "  scripts/docker/- Advanced TypeScript Docker utilities"
    echo "                   Docker utilities, system utils, terminal manager"
    echo ""
    
    r "System & Process Management:"
    echo "  kill-ports     - Kill processes running on specific ports"
    echo "                   Smart port management with process detection"
    echo "  click          - Click automation utility"
    echo "                   Automated clicking with configurable rate/duration"
    echo ""
    
    c "CLI & Interactive Tools:"
    echo "  dotfiles       - Interactive dotfiles menu (TypeScript/React)"
    echo "                   Main dotfiles management interface"
    echo "  simple-menu.ts - TypeScript CLI menu system"
    echo "                   Base for interactive command-line tools"
    echo "                   Advanced terminal user interfaces"
    echo ""
    
    y "Script Categories by Type:"
    printf "  %-15s %s\n" "📝 Python:" "ui (unified toolkit), db (NEW!), postgres"
    printf "  %-15s %s\n" "🐙 TypeScript:" "dotfiles, simple-menu.ts, docker utilities"
    printf "  %-15s %s\n" "📜 Bash:" "copy, docker-manager, kill-ports, click, cat"
    printf "  %-15s %s\n" "⚙️ Binary:" "unused (legacy)"
    echo ""
    
    w "Quick Access:"
    echo "  All scripts in bin/ are in PATH and executable anywhere"
    echo "  Most scripts support --help for detailed usage"
    echo "  Interactive tools: ui (unified dev), db (unified database), postgres, docker-manager, dotfiles"
    echo "  Automation tools: click, kill-ports"
    echo "  Direct CLI flags: ui --migrate, ui --analyze (skip interactive menu)"
    echo ""
    
    printf "%s%s%s\n" "$fish_color_bright_black" "💡 Pro tip: Try 'dotfiles' for the main interactive interface!" "$fish_color_reset"
    echo ""
end

function _show_dotfiles_overview
    c "📁 DOTFILES STRUCTURE & OVERVIEW"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    g "Directory Structure:"
    echo "  ~/.config/dotfiles/"
    echo "  ├── fish/                    # Fish shell configuration"
    echo "  │   ├── aliases/             # Organized alias files"
    echo "  │   ├── functions/           # Custom fish functions"
    echo "  │   ├── core/               # Core configuration (colors, env)"
    echo "  │   └── config.fish         # Main fish config"
    echo "  ├── bin/                    # Executable scripts (in PATH)"
    echo "  ├── scripts/                # Python & utility scripts"
    echo "  └── README.md              # Documentation"
    echo ""
    
    bl "Key Features:"
    echo "  • Modular Configuration     - Organized by function and purpose"
    echo "  • Automatic Help System     - Self-documenting aliases and functions"
    echo "  • Cross-shell Compatibility - Primarily Fish, with fallbacks"
    echo "  • Developer Tools           - Database, Docker, file management"
    echo "  • Package Manager Support   - Both pnpm and bun workflows"
    echo "  • Git Integration           - Comprehensive git aliases and functions"
    echo ""
    
    y "Configuration Files:"
    echo "  • Main Config: ~/.config/dotfiles/fish/config.fish"
    echo "  • Colors:      ~/.config/dotfiles/fish/core/colors.fish"
    echo "  • Environment: ~/.config/dotfiles/fish/core/env.fish"
    echo "  • Aliases:     ~/.config/dotfiles/fish/aliases/*.fish"
    echo ""
    
    p "Package Managers:"
    echo "  Primary:   bun     (preferred for speed)"
    echo "  Fallback:  pnpm    (when bun is unavailable)"
    echo "  Forbidden: npm, yarn (consistent environment)"
    echo ""
    
    c "Editor & Tools:"
    echo "  Editor:    Neovim  (v, vi, vim aliases)"
    echo "  Terminal:  Fish    (with custom functions)"
    echo "  File Mgr:  exa     (enhanced ls replacement)"
    echo "  Finder:    fzf     (fuzzy finding everywhere)"
    echo ""
    
    w "Getting Started:"
    echo "  1. help --all        # See all available commands"
    echo "  2. aliases --list    # Browse all aliases by category"
    echo "  3. help --scripts    # Explore available tools"
    echo "  4. dotfiles          # Navigate to dotfiles directory"
    echo "  5. reload            # Apply configuration changes"
    echo ""
    
    g "Customization:"
    echo "  • Add aliases to appropriate files in fish/aliases/"
    echo "  • Use DOCSTRING comments for automatic help integration"
    echo "  • New scripts go in bin/ (executable) or scripts/ (utility)"
    echo "  • Run 'reload' after making changes"
    echo ""
    
    y "Documentation:"
    echo "  • README.md          - Basic setup and structure"
    echo "  • HELP.md            - Comprehensive help documentation"
    echo "  • help --help        - This help system usage"
    echo ""
end
