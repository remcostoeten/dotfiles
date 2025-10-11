#!/usr/bin/env fish

# Main dotfiles management interface
function dotfiles_menu -d "Comprehensive dotfiles management system"
    # Parse arguments
    for arg in $argv
        switch $arg
            case --help -h help
                _show_dotfiles_menu_help
                return 0
            case --dir -d dir
                cd ~/.config/dotfiles
                return 0
            case --edit -e edit
                cd ~/.config/dotfiles && $EDITOR .
                return 0
            case --reload -r reload
                reload
                return 0
            case --aliases aliases
                _show_aliases_menu
                return 0
            case --scripts scripts
                _show_scripts_menu
                return 0
            case --functions functions
                _show_functions_menu
                return 0
            case --config config
                _show_config_menu
                return 0
            case --git git
                _show_git_menu
                return 0
            case '*'
                print_error "Unknown option: $arg"
                echo ""
                _show_dotfiles_menu_help
                return 1
        end
    end
    
    # If no arguments, show main menu
    _show_main_dotfiles_menu
end

function _show_main_dotfiles_menu
    clear
    
    # Header with ASCII art
    printf "%s%s\n" "$fish_color_cyan$fish_color_bold" "╔══════════════════════════════════════════════════════════════════════════════╗"
    printf "%s%s\n" "$fish_color_cyan$fish_color_bold" "║                          🏠 DOTFILES MANAGEMENT HUB                          ║"
    printf "%s%s%s\n" "$fish_color_cyan$fish_color_bold" "╚══════════════════════════════════════════════════════════════════════════════╝" "$fish_color_reset"
    echo ""
    
    # Last update info
    set -l dotfiles_dir "$HOME/.config/dotfiles"
    if test -d "$dotfiles_dir/.git"
        set -l last_commit (git --no-pager -C "$dotfiles_dir" log -1 --format="%ci" 2>/dev/null)
        if test -n "$last_commit"
            set -l formatted_date (date -d "$last_commit" "+%Y-%m-%d %H:%M" 2>/dev/null)
            if test -n "$formatted_date"
                printf "%s%s📅 Last Updated: %s%s\n" "$fish_color_bright_black" "$fish_color_italic" "$formatted_date" "$fish_color_reset"
            end
        end
    end
    printf "%s%s📍 Location: ~/.config/dotfiles%s\n" "$fish_color_bright_black" "$fish_color_italic" "$fish_color_reset"
    echo ""
    
    # Quick Actions
    printf "%s%s⚡ Quick Actions:%s\n" "$fish_color_yellow$fish_color_bold" "" "$fish_color_reset"
    printf "  %s%-15s%s %s\n" "$fish_color_bright_green" "dotfiles dir" "$fish_color_reset" "Navigate to dotfiles directory"
    printf "  %s%-15s%s %s\n" "$fish_color_bright_green" "dotfiles edit" "$fish_color_reset" "Open dotfiles in editor"
    printf "  %s%-15s%s %s\n" "$fish_color_bright_green" "dotfiles reload" "$fish_color_reset" "Reload fish configuration"
    printf "  %s%-15s%s %s\n" "$fish_color_bright_green" "reload" "$fish_color_reset" "Quick reload alias"
    echo ""
    
    # Main Categories
    printf "%s%s📚 Explore & Learn:%s\n" "$fish_color_blue$fish_color_bold" "" "$fish_color_reset"
    printf "  %s%-15s%s %s\n" "$fish_color_cyan" "help --all" "$fish_color_reset" "Complete help system - all commands & aliases"
    printf "  %s%-15s%s %s\n" "$fish_color_cyan" "help --overview" "$fish_color_reset" "Dotfiles structure & getting started guide"
    printf "  %s%-15s%s %s\n" "$fish_color_cyan" "help --scripts" "$fish_color_reset" "Available tools & utilities overview"
    printf "  %s%-15s%s %s\n" "$fish_color_cyan" "aliases --list" "$fish_color_reset" "Browse all aliases by category"
    printf "  %s%-15s%s %s\n" "$fish_color_cyan" "aliases --help" "$fish_color_reset" "Alias management system"
    echo ""
    
    # Category Shortcuts
    printf "%s%s🎯 Category Shortcuts:%s\n" "$fish_color_magenta$fish_color_bold" "" "$fish_color_reset"
    printf "  %s%-15s%s %s\n" "$fish_color_bright_magenta" "dotfiles aliases" "$fish_color_reset" "Alias management & browsing"
    printf "  %s%-15s%s %s\n" "$fish_color_bright_magenta" "dotfiles scripts" "$fish_color_reset" "Scripts & tools overview"
    printf "  %s%-15s%s %s\n" "$fish_color_bright_magenta" "dotfiles functions" "$fish_color_reset" "Custom functions reference"
    printf "  %s%-15s%s %s\n" "$fish_color_bright_magenta" "dotfiles config" "$fish_color_reset" "Configuration management"
    printf "  %s%-15s%s %s\n" "$fish_color_bright_magenta" "dotfiles git" "$fish_color_reset" "Git operations & status"
    echo ""
    
    # Featured Tools
    printf "%s%s🛠️ Featured Development Tools:%s\n" "$fish_color_green$fish_color_bold" "" "$fish_color_reset"
    printf "  %s%-15s%s %s\n" "$fish_color_bright_green" "ui" "$fish_color_reset" "🎨 Component Migration + 🔍 Code Analyzer v3.0"
    printf "  %s%-15s%s %s\n" "$fish_color_bright_green" "postgres" "$fish_color_reset" "Interactive PostgreSQL database manager"
    printf "  %s%-15s%s %s\n" "$fish_color_bright_green" "copy" "$fish_color_reset" "Interactive development workflow utility"
    printf "  %s%-15s%s %s\n" "$fish_color_bright_green" "kill-ports" "$fish_color_reset" "Kill processes on specific ports"
    echo ""
    
    # Help & Documentation
    printf "%s%s📖 Help & Documentation:%s\n" "$fish_color_white$fish_color_bold" "" "$fish_color_reset"
    printf "  %s%-15s%s %s\n" "$fish_color_bright_white" "dotfiles --help" "$fish_color_reset" "This menu system usage"
    printf "  %s%-15s%s %s\n" "$fish_color_bright_white" "help system" "$fish_color_reset" "System & navigation aliases"
    printf "  %s%-15s%s %s\n" "$fish_color_bright_white" "help dev" "$fish_color_reset" "Development & build aliases"  
    printf "  %s%-15s%s %s\n" "$fish_color_bright_white" "help git" "$fish_color_reset" "Git workflow aliases"
    printf "  %s%-15s%s %s\n" "$fish_color_bright_white" "help fzf" "$fish_color_reset" "Fuzzy finder aliases"
    echo ""
    
    # Pro Tips
    printf "%s%s💡 Pro Tips:%s\n" "$fish_color_bright_black$fish_color_italic" "" "$fish_color_reset"
    printf "%s  • Use tab completion for all commands%s\n" "$fish_color_bright_black" "$fish_color_reset"
    printf "%s  • All scripts in bin/ are globally executable%s\n" "$fish_color_bright_black" "$fish_color_reset"
    printf "%s  • Try 'aliases search <term>' to find specific aliases%s\n" "$fish_color_bright_black" "$fish_color_reset"
    printf "%s  • Use 'help --all' for comprehensive command reference%s\n" "$fish_color_bright_black" "$fish_color_reset"
    echo ""
end

function _show_aliases_menu
    clear
    printf "%s%s🔗 ALIASES MANAGEMENT%s\n" "$fish_color_cyan$fish_color_bold" "" "$fish_color_reset"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    printf "%s%s📋 Browse Aliases:%s\n" "$fish_color_blue$fish_color_bold" "" "$fish_color_reset"
    printf "  %s%-20s%s %s\n" "$fish_color_bright_blue" "aliases --list" "$fish_color_reset" "List all aliases by category"
    printf "  %s%-20s%s %s\n" "$fish_color_bright_blue" "aliases search <term>" "$fish_color_reset" "Search for specific aliases"
    printf "  %s%-20s%s %s\n" "$fish_color_bright_blue" "aliases system" "$fish_color_reset" "System & navigation aliases"
    printf "  %s%-20s%s %s\n" "$fish_color_bright_blue" "aliases dev" "$fish_color_reset" "Development & build aliases"
    printf "  %s%-20s%s %s\n" "$fish_color_bright_blue" "aliases git" "$fish_color_reset" "Git workflow aliases"
    echo ""
    
    printf "%s%s⚙️ Management:%s\n" "$fish_color_green$fish_color_bold" "" "$fish_color_reset"
    printf "  %s%-20s%s %s\n" "$fish_color_bright_green" "v ~/.config/dotfiles/configs/fish/aliases/" "$fish_color_reset" "Edit alias files"
    printf "  %s%-20s%s %s\n" "$fish_color_bright_green" "reload" "$fish_color_reset" "Apply changes"
    echo ""
    
    printf "%s%sPress any key to return to main menu...%s" "$fish_color_bright_black" "$fish_color_italic" "$fish_color_reset"
    read -n 1
    dotfiles_menu
end

function _show_scripts_menu  
    clear
    printf "%s%s🔧 SCRIPTS & TOOLS%s\n" "$fish_color_cyan$fish_color_bold" "" "$fish_color_reset"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    printf "%s%s🎨 Development Tools:%s\n" "$fish_color_green$fish_color_bold" "" "$fish_color_reset"
    printf "  %s%-15s%s %s\n" "$fish_color_bright_green" "ui" "$fish_color_reset" "Component Migration + Code Analyzer"
    printf "  %s%-15s%s %s\n" "$fish_color_bright_green" "copy" "$fish_color_reset" "Interactive development workflow utility"
    printf "  %s%-15s%s %s\n" "$fish_color_bright_green" "unused" "$fish_color_reset" "Find & remove unused files (legacy)"
    echo ""
    
    printf "%s%s🗄️ Database & Analytics:%s\n" "$fish_color_blue$fish_color_bold" "" "$fish_color_reset"
    printf "  %s%-15s%s %s\n" "$fish_color_bright_blue" "postgres" "$fish_color_reset" "PostgreSQL Database Manager CLI"
    printf "  %s%-15s%s %s\n" "$fish_color_bright_blue" "db_analyzer.py" "$fish_color_reset" "Database analysis with Gemini AI"
    echo ""
    
    printf "%s%s🐳 System & Process:%s\n" "$fish_color_red$fish_color_bold" "" "$fish_color_reset"  
    printf "  %s%-15s%s %s\n" "$fish_color_bright_red" "kill-ports" "$fish_color_reset" "Kill processes on specific ports"
    printf "  %s%-15s%s %s\n" "$fish_color_bright_red" "click" "$fish_color_reset" "Click automation utility"
    printf "  %s%-15s%s %s\n" "$fish_color_bright_red" "docker-manager" "$fish_color_reset" "Interactive Docker management"
    echo ""
    
    printf "%s%s📁 Management:%s\n" "$fish_color_yellow$fish_color_bold" "" "$fish_color_reset"
    printf "  %s%-15s%s %s\n" "$fish_color_bright_yellow" "ls ~/.config/dotfiles/bin/" "$fish_color_reset" "List all available scripts"
    printf "  %s%-15s%s %s\n" "$fish_color_bright_yellow" "help --scripts" "$fish_color_reset" "Detailed scripts documentation"
    echo ""
    
    printf "%s%sPress any key to return to main menu...%s" "$fish_color_bright_black" "$fish_color_italic" "$fish_color_reset"
    read -n 1
    dotfiles_menu
end

function _show_functions_menu
    clear
    printf "%s%s⚙️ CUSTOM FUNCTIONS%s\n" "$fish_color_cyan$fish_color_bold" "" "$fish_color_reset"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    printf "%s%s🎨 Color Functions:%s\n" "$fish_color_magenta$fish_color_bold" "" "$fish_color_reset"
    printf "  %s%-20s%s %s\n" "$fish_color_bright_magenta" "r 'text'" "$fish_color_reset" "Print text in red"
    printf "  %s%-20s%s %s\n" "$fish_color_bright_magenta" "g 'text'" "$fish_color_reset" "Print text in green"  
    printf "  %s%-20s%s %s\n" "$fish_color_bright_magenta" "bl 'text'" "$fish_color_reset" "Print text in blue"
    printf "  %s%-20s%s %s\n" "$fish_color_bright_magenta" "print_success 'msg'" "$fish_color_reset" "Success message formatting"
    echo ""
    
    printf "%s%s🏠 System Functions:%s\n" "$fish_color_blue$fish_color_bold" "" "$fish_color_reset"
    printf "  %s%-20s%s %s\n" "$fish_color_bright_blue" "reload" "$fish_color_reset" "Reload fish configuration"
    printf "  %s%-20s%s %s\n" "$fish_color_bright_blue" "dotfiles" "$fish_color_reset" "This dotfiles management system"
    printf "  %s%-20s%s %s\n" "$fish_color_bright_blue" "tree" "$fish_color_reset" "Enhanced tree with better colors"
    printf "  %s%-20s%s %s\n" "$fish_color_bright_blue" "etree" "$fish_color_reset" "Tree using exa with better colors"
    echo ""
    
    printf "%s%s📖 Help Functions:%s\n" "$fish_color_green$fish_color_bold" "" "$fish_color_reset"
    printf "  %s%-20s%s %s\n" "$fish_color_bright_green" "help" "$fish_color_reset" "Comprehensive help system"
    printf "  %s%-20s%s %s\n" "$fish_color_bright_green" "aliases" "$fish_color_reset" "Alias management system"
    printf "  %s%-20s%s %s\n" "$fish_color_bright_green" "welcome_banner" "$fish_color_reset" "Show welcome banner"
    echo ""
    
    printf "%s%s📁 Locations:%s\n" "$fish_color_yellow$fish_color_bold" "" "$fish_color_reset"
    printf "  %s%-20s%s %s\n" "$fish_color_bright_yellow" "Functions:" "$fish_color_reset" "~/.config/dotfiles/configs/fish/functions/"
    printf "  %s%-20s%s %s\n" "$fish_color_bright_yellow" "Colors:" "$fish_color_reset" "~/.config/dotfiles/configs/fish/core/colors.fish"
    echo ""
    
    printf "%s%sPress any key to return to main menu...%s" "$fish_color_bright_black" "$fish_color_italic" "$fish_color_reset"
    read -n 1
    dotfiles_menu
end

function _show_config_menu
    clear
    printf "%s%s⚙️ CONFIGURATION MANAGEMENT%s\n" "$fish_color_cyan$fish_color_bold" "" "$fish_color_reset"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    printf "%s%s📁 Core Files:%s\n" "$fish_color_blue$fish_color_bold" "" "$fish_color_reset"
    printf "  %s%-25s%s %s\n" "$fish_color_bright_blue" "v ~/.config/dotfiles/configs/fish/config.fish" "$fish_color_reset" "Main fish configuration"
    printf "  %s%-25s%s %s\n" "$fish_color_bright_blue" "v ~/.config/dotfiles/configs/fish/core/colors.fish" "$fish_color_reset" "Unified color system"
    printf "  %s%-25s%s %s\n" "$fish_color_bright_blue" "v ~/.config/dotfiles/configs/fish/core/env.fish" "$fish_color_reset" "Environment variables"
    echo ""
    
    printf "%s%s🔗 Alias Categories:%s\n" "$fish_color_green$fish_color_bold" "" "$fish_color_reset"
    printf "  %s%-25s%s %s\n" "$fish_color_bright_green" "v ~/.config/dotfiles/configs/fish/aliases/system.fish" "$fish_color_reset" "System & navigation"
    printf "  %s%-25s%s %s\n" "$fish_color_bright_green" "v ~/.config/dotfiles/configs/fish/aliases/dev.fish" "$fish_color_reset" "Development tools"
    printf "  %s%-25s%s %s\n" "$fish_color_bright_green" "v ~/.config/dotfiles/configs/fish/aliases/git.fish" "$fish_color_reset" "Git workflow"
    printf "  %s%-25s%s %s\n" "$fish_color_bright_green" "v ~/.config/dotfiles/configs/fish/aliases/fzf.fish" "$fish_color_reset" "Fuzzy finding"
    echo ""
    
    printf "%s%s⚡ Quick Actions:%s\n" "$fish_color_yellow$fish_color_bold" "" "$fish_color_reset"
    printf "  %s%-25s%s %s\n" "$fish_color_bright_yellow" "dotfiles edit" "$fish_color_reset" "Open entire dotfiles in editor"
    printf "  %s%-25s%s %s\n" "$fish_color_bright_yellow" "reload" "$fish_color_reset" "Apply configuration changes"
    printf "  %s%-25s%s %s\n" "$fish_color_bright_yellow" "dotfiles dir" "$fish_color_reset" "Navigate to dotfiles directory"
    echo ""
    
    printf "%s%sPress any key to return to main menu...%s" "$fish_color_bright_black" "$fish_color_italic" "$fish_color_reset"
    read -n 1
    dotfiles_menu
end

function _show_git_menu
    clear
    printf "%s%s📝 GIT OPERATIONS%s\n" "$fish_color_cyan$fish_color_bold" "" "$fish_color_reset"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    # Show current git status if in dotfiles directory
    set -l current_dir (pwd)
    if test "$current_dir" = "$HOME/.config/dotfiles"
        printf "%s%s📊 Current Status:%s\n" "$fish_color_blue$fish_color_bold" "" "$fish_color_reset"
        git status --short 2>/dev/null | head -10
        echo ""
    end
    
    printf "%s%s🚀 Quick Git Actions:%s\n" "$fish_color_green$fish_color_bold" "" "$fish_color_reset"
    printf "  %s%-20s%s %s\n" "$fish_color_bright_green" "gs" "$fish_color_reset" "Git status (short)"
    printf "  %s%-20s%s %s\n" "$fish_color_bright_green" "ga ." "$fish_color_reset" "Git add all"
    printf "  %s%-20s%s %s\n" "$fish_color_bright_green" "gc 'message'" "$fish_color_reset" "Git commit with message"  
    printf "  %s%-20s%s %s\n" "$fish_color_bright_green" "gp" "$fish_color_reset" "Git push"
    printf "  %s%-20s%s %s\n" "$fish_color_bright_green" "gl" "$fish_color_reset" "Git log (pretty)"
    echo ""
    
    printf "%s%s🌿 Branch Management:%s\n" "$fish_color_magenta$fish_color_bold" "" "$fish_color_reset"
    printf "  %s%-20s%s %s\n" "$fish_color_bright_magenta" "gb" "$fish_color_reset" "List branches"
    printf "  %s%-20s%s %s\n" "$fish_color_bright_magenta" "gco <branch>" "$fish_color_reset" "Checkout branch"
    printf "  %s%-20s%s %s\n" "$fish_color_bright_magenta" "gcb <name>" "$fish_color_reset" "Create & checkout new branch"
    echo ""
    
    printf "%s%s🔍 Information:%s\n" "$fish_color_yellow$fish_color_bold" "" "$fish_color_reset"
    printf "  %s%-20s%s %s\n" "$fish_color_bright_yellow" "gd" "$fish_color_reset" "Git diff"
    printf "  %s%-20s%s %s\n" "$fish_color_bright_yellow" "help git" "$fish_color_reset" "All git aliases"
    echo ""
    
    printf "%s%sPress any key to return to main menu...%s" "$fish_color_bright_black" "$fish_color_italic" "$fish_color_reset"
    read -n 1
    dotfiles_menu
end

function _show_dotfiles_menu_help
    printf "%s%s🏠 DOTFILES MANAGEMENT HELP%s\n" "$fish_color_cyan$fish_color_bold" "" "$fish_color_reset"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    printf "%s%sUsage:%s dotfiles [OPTION]\n" "$fish_color_yellow$fish_color_bold" "" "$fish_color_reset"
    echo ""
    
    printf "%s%sOptions:%s\n" "$fish_color_green$fish_color_bold" "" "$fish_color_reset"
    printf "  %s%-15s%s %s\n" "$fish_color_bright_green" "--help, -h" "$fish_color_reset" "Show this help message"
    printf "  %s%-15s%s %s\n" "$fish_color_bright_green" "--dir, -d" "$fish_color_reset" "Navigate to dotfiles directory"
    printf "  %s%-15s%s %s\n" "$fish_color_bright_green" "--edit, -e" "$fish_color_reset" "Open dotfiles in editor"
    printf "  %s%-15s%s %s\n" "$fish_color_bright_green" "--reload, -r" "$fish_color_reset" "Reload fish configuration"
    printf "  %s%-15s%s %s\n" "$fish_color_bright_green" "--aliases, -a" "$fish_color_reset" "Show aliases management menu"
    printf "  %s%-15s%s %s\n" "$fish_color_bright_green" "--scripts, -s" "$fish_color_reset" "Show scripts & tools menu"
    printf "  %s%-15s%s %s\n" "$fish_color_bright_green" "--functions, -f" "$fish_color_reset" "Show functions reference menu"
    printf "  %s%-15s%s %s\n" "$fish_color_bright_green" "--config, -c" "$fish_color_reset" "Show configuration menu"
    printf "  %s%-15s%s %s\n" "$fish_color_bright_green" "--git, -g" "$fish_color_reset" "Show git operations menu"
    echo ""
    
    printf "%s%sExamples:%s\n" "$fish_color_blue$fish_color_bold" "" "$fish_color_reset"
    printf "  %sdotfiles%s          %s# Show main menu (this interface)%s\n" "$fish_color_bright_blue" "$fish_color_reset" "$fish_color_bright_black" "$fish_color_reset"
    printf "  %sdotfiles dir%s       %s# Navigate to dotfiles directory%s\n" "$fish_color_bright_blue" "$fish_color_reset" "$fish_color_bright_black" "$fish_color_reset"
    printf "  %sdotfiles edit%s      %s# Open dotfiles in \$EDITOR%s\n" "$fish_color_bright_blue" "$fish_color_reset" "$fish_color_bright_black" "$fish_color_reset"
    printf "  %sdotfiles aliases%s   %s# Show alias management menu%s\n" "$fish_color_bright_blue" "$fish_color_reset" "$fish_color_bright_black" "$fish_color_reset"
    echo ""
end