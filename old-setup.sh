
#!/bin/bash

set +e
readonly GREEN='\033[0;32m'
readonly BLUE='\033[0;34m'
readonly YELLOW='\033[1;33m'
readonly RED='\033[0;31m'
readonly CYAN='\033[0;36m'
readonly MAGENTA='\033[0;35m'
readonly BOLD='\033[1m'
readonly NC='\033[0m' # No Color

# Configuration
readonly DOTFILES_DIR="$HOME/.config/dotfiles"
readonly DOTFILES_DATA_DIR="$HOME/.dotfiles"
readonly PROGRESS_FILE="$DOTFILES_DATA_DIR/setup/progress.json"

# ============================================================================
# PACKAGE DEFINITIONS
# ============================================================================
#
# Format: "package_name|install_method|extra_data|display_name"
#
# Install Methods:
#   apt     - Standard apt-get install
#   snap    - Snap package manager
#   curl    - Download and run install script
#   npm     - NPM global package
#   cargo   - Rust cargo install
#   github  - Download from GitHub releases
#
# Examples:
#   "git|apt|Git"                                      → apt-get install git
#   "code|snap|Visual Studio Code"                     → snap install code
#   "pnpm|curl|https://get.pnpm.io/install.sh|pnpm"   → curl URL | bash
#   "gemini-cli|npm|gemini-cli"                        → npm install -g gemini-cli
#   "ripgrep|cargo|ripgrep"                            → cargo install ripgrep
#   "lazygit|github|jesseduffield/lazygit|lazygit"    → Download from GitHub releases
#
# Note: For curl and github methods, extra_data field is required (URL or repo)
# ============================================================================

# Essential system packages
declare -a ESSENTIAL_PACKAGES=(
    "git|apt|Git"
    "curl|apt|cURL"
    "wget|apt|wget"
    "build-essential|apt|Build Essential"
    "ca-certificates|apt|CA Certificates"
    "gnupg|apt|GnuPG"
    "software-properties-common|apt|Software Properties Common"
    "fish|apt|Fish Shell"
)

# Programming languages & runtimes
declare -a LANGUAGES=(
    "python3|apt|Python 3"
    "python3-pip|apt|Python pip"
    "python3-venv|apt|Python venv"
    "nodejs|apt|Node.js"
)

# Code editors & IDEs
declare -a EDITORS=(
    "neovim|apt|Neovim"
    "code|snap|Visual Studio Code"
)

# Package managers
declare -a PACKAGE_MANAGERS=(
    "npm|apt|npm (Node Package Manager)"
    "pnpm|curl|https://get.pnpm.io/install.sh|pnpm"
    "bun|curl|https://bun.sh/install|Bun"
)

# Git tools
declare -a GIT_TOOLS=(
    "gh|apt|GitHub CLI"
    "lazygit|github|jesseduffield/lazygit|lazygit"
    "lazydocker|github|jesseduffield/lazydocker|lazydocker"
)

# Android emulator (optional)
declare -a ANDROID_TOOLS=(
    "android-studio:Android Studio"
)

# Modern CLI utilities
declare -a CLI_UTILITIES=(
    "ripgrep:ripgrep"
    "fd-find:fd"
    "fzf:fzf"
    "zoxide:zoxide"
    "eza:eza"
    "bat:bat"
    "htop:htop"
    "tree:tree"
    "jq:jq"
    "unzip:unzip"
    "zip:zip"
    "xclip:xclip"
    "wl-clipboard:wl-clipboard"
    "wget:wget"
    "bc:bc"
    "libnotify-bin:libnotify-bin"
)

# Automation & Testing tools
declare -a AUTOMATION_TOOLS=(
    "xdotool:xdotool"
    "ydotool:ydotool"
)

# Media playback (for alarm script)
declare -a MEDIA_PLAYBACK=(
    "mpv:mpv"
    "pulseaudio-utils:pulseaudio-utils"
)

# GNOME specific tools
declare -a GNOME_TOOLS=(
    "gnome-shell-extensions:gnome-shell-extensions"
    "dconf-cli:dconf-cli"
)

# Communication & Social
declare -a COMMUNICATION_APPS=(
    "discord:Discord"
    "slack:Slack"
    "telegram-desktop:Telegram"
)

# Media & Graphics
declare -a MEDIA_APPS=(
    "gimp:GIMP"
    "inkscape:Inkscape"
    "vlc:VLC Media Player"
    "obs-studio:OBS Studio"
)

# Browsers
declare -a BROWSERS=(
    "firefox:Firefox"
    "google-chrome-stable:Google Chrome"
    "brave-browser:Brave Browser"
)

# Container & DevOps
declare -a DEVOPS_TOOLS=(
    "docker.io:Docker"
    "docker-compose:Docker Compose"
    "kubectl:kubectl"
)

# System utilities
declare -a SYSTEM_UTILS=(
    "htop:htop"
    "btop:btop"
    "neofetch:neofetch"
    "timeshift:Timeshift"
)

# Hardware & GPU tools
declare -a HARDWARE_TOOLS=(
    "openrgb:OpenRGB"
    "nvidia-settings:NVIDIA Settings"
    "nvidia-utils:NVIDIA Utils"
)

# Tools installed via snap
declare -a SNAP_PACKAGES=(
    "whatsapp-for-linux:WhatsApp"
    "spotify:Spotify"
    "obsidian:Obsidian"
    "signal-desktop:Signal"
    "code:Visual Studio Code"
)

# Tools installed via curl scripts
declare -a CURL_TOOLS=(
    "bun:https://bun.sh/install:bun"
    "starship:https://starship.rs/install.sh:starship"
    "nvm:https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh:nvm"
    "pnpm:https://get.pnpm.io/install.sh:pnpm"
    "turso:https://get.tur.so/install.sh:turso"
    "uvx:https://astral.sh/uv/install.sh:uvx"
    "vercel:https://vercel.com/cli.sh:vercel"
    "netlify:https://cli.netlify.com/install.sh:netlify"
)

# CLI tools installed via npm/pnpm (after node is installed)
declare -a NPM_CLI_TOOLS=(
    "gemini-cli:gemini-cli"
)

declare -A CONFIG_APPS=(
    ["nvim"]="neovim:~/.config/nvim"
    ["wezterm"]="wezterm:~/.config/wezterm"
    ["kitty"]="kitty:~/.config/kitty"
    ["hyprland"]="hyprland:~/.config/hypr"
    ["waybar"]="waybar:~/.config/waybar"
)

# Command line flags
DRY_RUN=false
DRY_RUN_SECTION=""
DRY_RUN_INTERACTIVE=false
SKIP_SYSTEM_UPDATE=false
SKIP_FONTS=false
VERBOSE=false
QUIET=false
INSTALL_SECTION=""
INSTALL_INTERACTIVE=false
SKIP_SECTION=""
SKIP_INTERACTIVE=false

# Parse command line arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            --dry-run-section)
                DRY_RUN=true
                DRY_RUN_SECTION="$2"
                shift 2
                ;;
            --dry-run-interactive|--dry-run-i)
                DRY_RUN=true
                DRY_RUN_INTERACTIVE=true
                shift
                ;;
            --skip-system-update)
                SKIP_SYSTEM_UPDATE=true
                shift
                ;;
            --skip-fonts)
                SKIP_FONTS=true
                shift
                ;;
            --verbose|-v)
                VERBOSE=true
                shift
                ;;
            --quiet|-q)
                QUIET=true
                shift
                ;;
            --install)
                INSTALL_SECTION="$2"
                shift 2
                ;;
            --install-interactive|--install-i)
                INSTALL_INTERACTIVE=true
                shift
                ;;
            --skip)
                SKIP_SECTION="$2"
                shift 2
                ;;
            --skip-interactive|--skip-i)
                SKIP_INTERACTIVE=true
                shift
                ;;
            --list)
                list_all_packages
                exit 0
                ;;
            --source)
                if command_exists xdg-open; then
                    xdg-open "https://github.com/remcostoeten/dotfiles/blob/main/setup.sh" 2>/dev/null &
                    echo -e "${GREEN}✓${NC} Opening source in browser..."
                elif command_exists open; then
                    open "https://github.com/remcostoeten/dotfiles/blob/main/setup.sh" 2>/dev/null &
                    echo -e "${GREEN}✓${NC} Opening source in browser..."
                else
                    echo -e "${CYAN}Source:${NC} https://github.com/remcostoeten/dotfiles/blob/main/setup.sh"
                fi
                exit 0
                ;;
            -h|--help)
                clear
                echo -e "${BOLD}${MAGENTA}"
                echo "╔════════════════════════════════════════════════════════════════════╗"
                echo "║                    Dotfiles Setup Script                          ║"
                echo "║              Interactive Environment Configuration                 ║"
                echo "╚════════════════════════════════════════════════════════════════════╝"
                echo -e "${NC}\n"

                echo -e "${BOLD}${CYAN}USAGE${NC}"
                echo -e "  ${BOLD}./setup.sh${NC} ${GREEN}[OPTIONS]${NC}\n"

                echo -e "${BOLD}${CYAN}OPTIONS${NC}"
                echo -e "  ${GREEN}--dry-run${NC}                         Preview all installations without making changes"
                echo -e "  ${GREEN}--dry-run-section${NC} ${YELLOW}<NAME>${NC}          Preview a specific section only"
                echo -e "  ${GREEN}--dry-run-interactive, -i${NC}         Interactive dry-run mode (select sections to preview)"
                echo -e "  ${GREEN}--skip-system-update${NC}              Skip apt update/upgrade step"
                echo -e "  ${GREEN}--skip-fonts${NC}                      Skip Nerd Fonts installation"
                echo -e "  ${GREEN}--verbose, -v${NC}                     Show detailed installation output"
                echo -e "  ${GREEN}--quiet, -q${NC}                       Minimal output, errors only"
                echo -e "  ${GREEN}--install${NC} ${YELLOW}<NAME>${NC}                 Install a specific section non-interactively"
                echo -e "  ${GREEN}--install-interactive, --install-i${NC}  Select sections to install interactively"
                echo -e "  ${GREEN}--skip${NC} ${YELLOW}<NAME>${NC}                    Skip a specific section"
                echo -e "  ${GREEN}--skip-interactive, --skip-i${NC}      Select sections to skip interactively"
                echo -e "  ${GREEN}--list${NC}                            List all available packages by category"
                echo -e "  ${GREEN}--source${NC}                          Open script source on GitHub"
                echo -e "  ${GREEN}-h, --help${NC}                        Display this help message\n"

                echo -e "${BOLD}${CYAN}AVAILABLE SECTIONS${NC}"
                echo -e "  ${YELLOW}dev${NC}              Development tools (Python, Node.js, npm, neovim)"
                echo -e "  ${YELLOW}git${NC}              Git tools (GitHub CLI, lazygit, lazydocker)"
                echo -e "  ${YELLOW}cli${NC}              Modern CLI utilities (ripgrep, fzf, bat, eza, zoxide)"
                echo -e "  ${YELLOW}browsers${NC}         Web browsers (Firefox, Chrome, Brave)"
                echo -e "  ${YELLOW}snaps${NC}            Snap packages (VS Code, WhatsApp, Spotify)"
                echo -e "  ${YELLOW}communication${NC}    Communication apps (Discord, Slack, Telegram)"
                echo -e "  ${YELLOW}media${NC}            Media & graphics (GIMP, Inkscape, VLC, OBS)"
                echo -e "  ${YELLOW}devops${NC}           DevOps tools (Docker, kubectl)"
                echo -e "  ${YELLOW}system${NC}           System utilities (htop, btop, neofetch, timeshift)"
                echo -e "  ${YELLOW}hardware${NC}         Hardware tools (OpenRGB, NVIDIA settings)"
                echo -e "  ${YELLOW}automation${NC}       Automation tools (xdotool, ydotool)"
                echo -e "  ${YELLOW}gnome${NC}            GNOME desktop tools and aesthetics"
                echo -e "  ${YELLOW}tools${NC}            Essential tools (bun, starship, nvm, pnpm, turso)"
                echo -e "  ${YELLOW}npm-tools${NC}        NPM CLI tools (gemini-cli)"
                echo -e "  ${YELLOW}android${NC}          Android development (Android Studio)"
                echo -e "  ${YELLOW}config-apps${NC}      Config-based apps (nvim, wezterm, kitty, hyprland)"
                echo -e "  ${YELLOW}fish${NC}             Fish shell setup and configuration"
                echo -e "  ${YELLOW}fonts${NC}            Nerd Fonts installation\n"

                echo -e "${BOLD}${CYAN}EXAMPLES${NC}"
                echo -e "  ${BLUE}#${NC} Run full interactive setup"
                echo -e "  ${BOLD}./setup.sh${NC}\n"

                echo -e "  ${BLUE}#${NC} Preview all changes without installing"
                echo -e "  ${BOLD}./setup.sh${NC} ${GREEN}--dry-run${NC}\n"

                echo -e "  ${BLUE}#${NC} Interactive dry-run (select sections to preview)"
                echo -e "  ${BOLD}./setup.sh${NC} ${GREEN}--dry-run-interactive${NC}\n"

                echo -e "  ${BLUE}#${NC} Preview only development tools section"
                echo -e "  ${BOLD}./setup.sh${NC} ${GREEN}--dry-run-section${NC} ${YELLOW}dev${NC}\n"

                echo -e "  ${BLUE}#${NC} Install only CLI utilities (non-interactive)"
                echo -e "  ${BOLD}./setup.sh${NC} ${GREEN}--install${NC} ${YELLOW}cli${NC}\n"

                echo -e "  ${BLUE}#${NC} Skip system update and fonts"
                echo -e "  ${BOLD}./setup.sh${NC} ${GREEN}--skip-system-update --skip-fonts${NC}\n"

                echo -e "  ${BLUE}#${NC} Verbose output for debugging"
                echo -e "  ${BOLD}./setup.sh${NC} ${GREEN}--verbose${NC}\n"

                echo -e "  ${BLUE}#${NC} View script source on GitHub"
                echo -e "  ${BOLD}./setup.sh${NC} ${GREEN}--source${NC}\n"

                echo -e "  ${BLUE}#${NC} List all available packages by category"
                echo -e "  ${BOLD}./setup.sh${NC} ${GREEN}--list${NC}\n"

                echo -e "${BOLD}${CYAN}PACKAGE FORMAT${NC}"
                echo -e "  Packages are defined as: ${YELLOW}name|method|extra|display${NC}"
                echo -e "  Methods: ${GREEN}apt${NC}, ${GREEN}snap${NC}, ${GREEN}curl${NC}, ${GREEN}npm${NC}, ${GREEN}cargo${NC}, ${GREEN}github${NC}"
                echo -e "  Example: ${DIM}lazygit|github|jesseduffield/lazygit|lazygit${NC}\n"

                echo -e "${BOLD}${CYAN}NOTES${NC}"
                echo -e "  ${BLUE}•${NC} The script will prompt for selections in interactive mode"
                echo -e "  ${BLUE}•${NC} Progress is saved and can be resumed if interrupted"
                echo -e "  ${BLUE}•${NC} Existing configurations are backed up before changes"
                echo -e "  ${BLUE}•${NC} Packages can use different install methods in same category"
                echo -e "  ${BLUE}•${NC} Requires Ubuntu/Debian with sudo access\n"

                exit 0
                ;;
            *)
                print_error "Unknown option: $1"
                echo "Use --help for usage information"
                exit 1
                ;;
        esac
    done
}

# Helper functions
print_status() {
    [ "$QUIET" = true ] && return 0
    echo -e "${BLUE}→${NC} $1"
}
print_success() {
    [ "$QUIET" = true ] && return 0
    echo -e "${GREEN}✓${NC} $1"
}
print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}
print_error() {
    echo -e "${RED}✗${NC} $1" >&2
}
print_info() {
    [ "$QUIET" = true ] && return 0
    echo -e "${CYAN}ℹ${NC} $1"
}
print_header() {
    [ "$QUIET" = true ] && return 0
    echo -e "\n${BOLD}${MAGENTA}$1${NC}"
}
print_dry_run() {
    echo -e "${YELLOW}[DRY RUN]${NC} $1"
}
print_verbose() {
    [ "$VERBOSE" = true ] && echo -e "${CYAN}[VERBOSE]${NC} $2"
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Initialize data directory structure
init_data_directory() {
    if [ ! -d "$DOTFILES_DATA_DIR" ]; then
        mkdir -p "$DOTFILES_DATA_DIR"/{setup,logs,backups}
        print_verbose "Created data directory structure at $DOTFILES_DATA_DIR"
    fi

    update_gitignore
}

# Update .gitignore to exclude data directory
update_gitignore() {
    local gitignore="$DOTFILES_DIR/.gitignore"
    local ignore_pattern="# Data directory (logs, progress, backups)"
    local ignore_entry="/.dotfiles/"

    if [ ! -f "$gitignore" ]; then
        touch "$gitignore"
        print_verbose "Created .gitignore file"
    fi

    if grep -q "^/.dotfiles/" "$gitignore" 2>/dev/null; then
        print_verbose "Data directory already in .gitignore"
        return 0
    fi

    {
        echo ""
        echo "$ignore_pattern"
        echo "$ignore_entry"
    } >> "$gitignore"

    print_success "Added $DOTFILES_DATA_DIR to .gitignore"
    print_info "Data directory will not be version controlled"
}

# Track installation results
track_result() {
    local result=$1
    if [ $result -eq 0 ]; then
        ((TOTAL_SUCCESS++))
    else
        ((TOTAL_FAILED++))
    fi
}

# Show welcome screen and main menu
show_main_menu() {
    while true; do
        clear
        echo -e "${BOLD}${MAGENTA}"
        echo "╔══════════════════════════════════════════════════════════════════╗"
        echo "║                                                                  ║"
        echo "║                   Dotfiles Setup Script                          ║"
        echo "║                                                                  ║"
        echo "║                   Welcome to the installer                       ║"
        echo "║                                                                  ║"
        echo "╚══════════════════════════════════════════════════════════════════╝"
        echo -e "${NC}\n"

        echo -e "${CYAN}What would you like to do?${NC}\n"

        local options=(
            "Full Interactive Setup|Run complete setup with package selection"
            "Quick Install (All)|Install everything without prompts"
            "Custom Install|Select specific categories to install"
            "Dry Run|Preview what would be installed"
            "List Packages|View all available packages"
            "Resume Previous|Continue interrupted installation"
            "Help|Show detailed help and options"
            "Exit|Exit the installer"
        )

        local selected=0
        local total=${#options[@]}

        while true; do
            # Display menu options
            for i in "${!options[@]}"; do
                IFS='|' read -ra parts <<< "${options[$i]}"
                local title="${parts[0]}"
                local desc="${parts[1]}"
                local num=$((i + 1))

                if [ $i -eq $selected ]; then
                    echo -e "  ${BOLD}${GREEN}[$num]${NC} ${BOLD}$title${NC}"
                    echo -e "      ${DIM}$desc${NC}"
                else
                    echo -e "  ${CYAN}[$num]${NC} ${DIM}$title${NC}"
                    echo -e "      ${DIM}$desc${NC}"
                fi
                echo ""
            done

            echo -e "\n${DIM}Select: 1-8 or ↑/k ↓/j | Confirm: Enter | Quit: q/Esc${NC}"

            # Read single key
            read -rsn1 key

            # Handle arrow keys (they send 3 characters: ESC [ A/B)
            if [[ $key == $'\e' ]]; then
                read -rsn2 -t 0.1 key2
                case "$key2" in
                    '[A') # Up arrow
                        ((selected--))
                        [ $selected -lt 0 ] && selected=$((total - 1))
                        clear
                        echo -e "${BOLD}${MAGENTA}"
                        echo "╔══════════════════════════════════════════════════════════════════╗"
                        echo "║                                                                  ║"
                        echo "║                   Dotfiles Setup Script                          ║"
                        echo "║                                                                  ║"
                        echo "║                   Welcome to the installer                       ║"
                        echo "║                                                                  ║"
                        echo "╚══════════════════════════════════════════════════════════════════╝"
                        echo -e "${NC}\n"
                        echo -e "${CYAN}What would you like to do?${NC}\n"
                        continue
                        ;;
                    '[B') # Down arrow
                        ((selected++))
                        [ $selected -ge $total ] && selected=0
                        clear
                        echo -e "${BOLD}${MAGENTA}"
                        echo "╔══════════════════════════════════════════════════════════════════╗"
                        echo "║                                                                  ║"
                        echo "║                   Dotfiles Setup Script                          ║"
                        echo "║                                                                  ║"
                        echo "║                   Welcome to the installer                       ║"
                        echo "║                                                                  ║"
                        echo "╚══════════════════════════════════════════════════════════════════╝"
                        echo -e "${NC}\n"
                        echo -e "${CYAN}What would you like to do?${NC}\n"
                        continue
                        ;;
                    *)
                        # ESC key pressed (quit)
                        echo -e "\n${YELLOW}Exiting installer...${NC}"
                        exit 0
                        ;;
                esac
            fi

            # Handle vim keys, number keys, and other inputs
            case "$key" in
                [1-8]) # Number keys - direct selection
                    local choice=$((key - 1))
                    if [ $choice -ge 0 ] && [ $choice -lt $total ]; then
                        selected=$choice
                        # Auto-execute the selection
                        clear
                        case $selected in
                            0) # Full Interactive Setup
                                return 0
                                ;;
                            1) # Quick Install (All)
                                SKIP_INTERACTIVE=true
                                return 0
                                ;;
                            2) # Custom Install
                                INSTALL_INTERACTIVE=true
                                return 0
                                ;;
                            3) # Dry Run
                                DRY_RUN=true
                                DRY_RUN_INTERACTIVE=true
                                return 0
                                ;;
                            4) # List Packages
                                list_all_packages_simple
                                read -p "Press Enter to return to menu..."
                                break
                                ;;
                            5) # Resume Previous
                                if [ -f "$PROGRESS_FILE" ]; then
                                    print_info "Resuming previous installation..."
                                    return 0
                                else
                                    print_warning "No previous installation found"
                                    sleep 2
                                    break
                                fi
                                ;;
                            6) # Help
                                parse_arguments "--help"
                                exit 0
                                ;;
                            7) # Exit
                                echo -e "${YELLOW}Exiting installer...${NC}"
                                exit 0
                                ;;
                        esac
                    fi
                    ;;
                k|K) # Vim up
                    ((selected--))
                    [ $selected -lt 0 ] && selected=$((total - 1))
                    clear
                    echo -e "${BOLD}${MAGENTA}"
                    echo "╔══════════════════════════════════════════════════════════════════╗"
                    echo "║                                                                  ║"
                    echo "║                   Dotfiles Setup Script                          ║"
                    echo "║                                                                  ║"
                    echo "║                   Welcome to the installer                       ║"
                    echo "║                                                                  ║"
                    echo "╚══════════════════════════════════════════════════════════════════╝"
                    echo -e "${NC}\n"
                    echo -e "${CYAN}What would you like to do?${NC}\n"
                    ;;
                j|J) # Vim down
                    ((selected++))
                    [ $selected -ge $total ] && selected=0
                    clear
                    echo -e "${BOLD}${MAGENTA}"
                    echo "╔══════════════════════════════════════════════════════════════════╗"
                    echo "║                                                                  ║"
                    echo "║                   Dotfiles Setup Script                          ║"
                    echo "║                                                                  ║"
                    echo "║                   Welcome to the installer                       ║"
                    echo "║                                                                  ║"
                    echo "╚══════════════════════════════════════════════════════════════════╝"
                    echo -e "${NC}\n"
                    echo -e "${CYAN}What would you like to do?${NC}\n"
                    ;;
                q|Q) # Quit
                    echo -e "\n${YELLOW}Exiting installer...${NC}"
                    exit 0
                    ;;
                '') # Enter key
                    clear
                    case $selected in
                        0) # Full Interactive Setup
                            return 0
                            ;;
                        1) # Quick Install (All)
                            SKIP_INTERACTIVE=true
                            return 0
                            ;;
                        2) # Custom Install
                            INSTALL_INTERACTIVE=true
                            return 0
                            ;;
                        3) # Dry Run
                            DRY_RUN=true
                            DRY_RUN_INTERACTIVE=true
                            return 0
                            ;;
                        4) # List Packages
                            list_all_packages_simple
                            read -p "Press Enter to return to menu..."
                            break
                            ;;
                        5) # Resume Previous
                            if [ -f "$PROGRESS_FILE" ]; then
                                print_info "Resuming previous installation..."
                                return 0
                            else
                                print_warning "No previous installation found"
                                sleep 2
                                break
                            fi
                            ;;
                        6) # Help
                            parse_arguments "--help"
                            exit 0
                            ;;
                        7) # Exit
                            echo -e "${YELLOW}Exiting installer...${NC}"
                            exit 0
                            ;;
                    esac
                    ;;
            esac
        done
    done
}

# Simple package list for menu
list_all_packages_simple() {
    clear
    echo -e "${BOLD}${CYAN}Available Package Categories${NC}\n"

    echo -e "${BOLD}Essential Packages${NC} (${#ESSENTIAL_PACKAGES[@]} packages)"
    echo -e "${BOLD}Programming Languages${NC} (${#LANGUAGES[@]} packages)"
    echo -e "${BOLD}Code Editors${NC} (${#EDITORS[@]} packages)"
    echo -e "${BOLD}Package Managers${NC} (${#PACKAGE_MANAGERS[@]} packages)"
    echo -e "${BOLD}Git Tools${NC} (${#GIT_TOOLS[@]} packages)"
    echo -e "${BOLD}CLI Utilities${NC} (${#CLI_UTILITIES[@]} packages)"
    echo -e "${BOLD}Browsers${NC} (${#BROWSERS[@]} packages)"
    echo -e "${BOLD}Communication Apps${NC} (${#COMMUNICATION_APPS[@]} packages)"
    echo -e "${BOLD}Media & Graphics${NC} (${#MEDIA_APPS[@]} packages)"
    echo -e "${BOLD}DevOps Tools${NC} (${#DEVOPS_TOOLS[@]} packages)"
    echo -e "${BOLD}System Utilities${NC} (${#SYSTEM_UTILS[@]} packages)"
    echo -e "${BOLD}Hardware Tools${NC} (${#HARDWARE_TOOLS[@]} packages)"
    echo -e "${BOLD}Automation Tools${NC} (${#AUTOMATION_TOOLS[@]} packages)"
    echo -e "${BOLD}GNOME Tools${NC} (${#GNOME_TOOLS[@]} packages)"
    echo -e "${BOLD}Android Tools${NC} (${#ANDROID_TOOLS[@]} packages)"
    echo ""
}

# List all available packages by category
list_all_packages() {
    clear
    echo -e "${BOLD}${MAGENTA}"
    echo "╔══════════════════════════════════════════════════════════════════╗"
    echo "║            Available Packages by Category                        ║"
    echo "╚══════════════════════════════════════════════════════════════════╝"
    echo -e "${NC}\n"

    # Function to display a category
    display_category() {
        local category_name="$1"
        local -n packages_ref="$2"
        local count=${#packages_ref[@]}

        echo -e "${BOLD}${CYAN}$category_name${NC} ${DIM}($count packages)${NC}"
        echo -e "${DIM}────────────────────────────────────────────────────────────────────${NC}"

        for package in "${packages_ref[@]}"; do
            # Parse format: "name|method|extra|display"
            IFS='|' read -ra parts <<< "$package"
            local name="${parts[0]}"
            local method="${parts[1]}"
            local display="${parts[3]:-${parts[2]:-$name}}"

            # Check if installed
            local status=""
            if command_exists "$name" || dpkg -l 2>/dev/null | grep -q "^ii.*$name "; then
                status="${GREEN}✓${NC}"
            else
                status="${DIM}○${NC}"
            fi

            # Color code by install method
            local method_color=""
            case "$method" in
                apt) method_color="${BLUE}" ;;
                snap) method_color="${MAGENTA}" ;;
                curl) method_color="${YELLOW}" ;;
                npm) method_color="${GREEN}" ;;
                cargo) method_color="${RED}" ;;
                github) method_color="${CYAN}" ;;
                *) method_color="${NC}" ;;
            esac

            printf "  %b %-30s %b%-6s%b %s\n" "$status" "$display" "$method_color" "$method" "${NC}" "${DIM}($name)${NC}"
        done
        echo ""
    }

    # Display all categories
    display_category "Essential Packages" ESSENTIAL_PACKAGES
    display_category "Programming Languages & Runtimes" LANGUAGES
    display_category "Code Editors & IDEs" EDITORS
    display_category "Package Managers" PACKAGE_MANAGERS
    display_category "Git Tools" GIT_TOOLS
    display_category "CLI Utilities" CLI_UTILITIES
    display_category "Browsers" BROWSERS
    display_category "Communication Apps" COMMUNICATION_APPS
    display_category "Media & Graphics" MEDIA_APPS
    display_category "DevOps Tools" DEVOPS_TOOLS
    display_category "System Utilities" SYSTEM_UTILS
    display_category "Hardware Tools" HARDWARE_TOOLS
    display_category "Automation Tools" AUTOMATION_TOOLS
    display_category "GNOME Tools" GNOME_TOOLS
    display_category "Android Tools" ANDROID_TOOLS

    echo -e "${BOLD}${CYAN}Legend:${NC}"
    echo -e "  ${GREEN}✓${NC} Installed    ${DIM}○${NC} Not installed"
    echo -e "  ${BLUE}apt${NC}  ${MAGENTA}snap${NC}  ${YELLOW}curl${NC}  ${GREEN}npm${NC}  ${RED}cargo${NC}  ${CYAN}github${NC}"
    echo ""
}

# Universal installer - parses format and installs accordingly
install_universal() {
    local package_string="$1"

    # Parse the package string: "name|method|extra|display"
    IFS='|' read -ra parts <<< "$package_string"
    local package="${parts[0]}"
    local method="${parts[1]}"
    local extra="${parts[2]}"
    local display="${parts[3]:-$package}"

    if [ "$DRY_RUN" = true ]; then
        print_dry_run "Would install: $display (via $method)"
        return 0
    fi

    # Check if already completed
    if is_completed "packages" "$package"; then
        print_success "$display already installed (skipped)"
        return 0
    fi

    # Check if already installed
    if command_exists "$package" || dpkg -l 2>/dev/null | grep -q "^ii.*$package "; then
        print_success "$display already installed"
        save_progress "packages" "$package" "completed"
        return 0
    fi

    print_status "Installing $display..."

    case "$method" in
        apt)
            if [ "$VERBOSE" = true ]; then
                sudo apt-get install -y "$package"
            else
                sudo apt-get install -y "$package" >/dev/null 2>&1
            fi
            ;;
        snap)
            if command_exists snap; then
                sudo snap install "$package" >/dev/null 2>&1
            else
                print_error "snapd not installed"
                return 1
            fi
            ;;
        curl)
            # extra contains the URL
            if [ "$VERBOSE" = true ]; then
                curl -fsSL "$extra" | bash
            else
                curl -fsSL "$extra" | bash >/dev/null 2>&1
            fi
            ;;
        npm)
            if command_exists npm; then
                npm install -g "$package" >/dev/null 2>&1
            elif command_exists pnpm; then
                pnpm add -g "$package" >/dev/null 2>&1
            else
                print_error "npm/pnpm not installed"
                return 1
            fi
            ;;
        github)
            # extra contains repo like "owner/repo"
            install_from_github "$package" "$extra" "$display"
            return $?
            ;;
        cargo)
            if command_exists cargo; then
                cargo install "$package" >/dev/null 2>&1
            else
                print_error "cargo not installed"
                return 1
            fi
            ;;
        *)
            print_error "Unknown install method: $method"
            return 1
            ;;
    esac

    local result=$?
    if [ $result -eq 0 ]; then
        print_success "$display installed successfully"
        save_progress "packages" "$package" "completed"
        track_result 0
    else
        print_error "Failed to install $display"
        save_progress "packages" "$package" "failed"
        track_result 1
    fi

    return $result
}

# Install from GitHub releases
install_from_github() {
    local package="$1"
    local repo="$2"
    local display="$3"

    local arch=""
    case "$(uname -m)" in
        x86_64) arch="x86_64" ;;
        aarch64|arm64) arch="arm64" ;;
        *) print_error "Unsupported architecture"; return 1 ;;
    esac

    local latest_url=$(curl -s "https://api.github.com/repos/$repo/releases/latest" | \
                       grep "browser_download_url.*Linux.*${arch}.*tar.gz" | \
                       head -1 | cut -d'"' -f4)

    if [ -z "$latest_url" ]; then
        print_warning "Could not find download URL for $display"
        return 1
    fi

    local temp_dir=$(mktemp -d)
    cd "$temp_dir" || return 1

    if wget -q "$latest_url" -O "${package}.tar.gz" 2>/dev/null; then
        tar -xzf "${package}.tar.gz" 2>/dev/null
        local binary=$(find . -name "$package" -type f | head -1)
        if [ -n "$binary" ] && [ -f "$binary" ]; then
            sudo mv "$binary" "/usr/local/bin/$package"
            sudo chmod +x "/usr/local/bin/$package"
            cd - >/dev/null
            rm -rf "$temp_dir"
            return 0
        fi
    fi

    cd - >/dev/null
    rm -rf "$temp_dir"
    return 1
}

# Save progress
save_progress() {
    local category="$1"
    local item="$2"
    local status="$3"

    # Ensure directory exists
    mkdir -p "$(dirname "$PROGRESS_FILE")"

    if [ ! -f "$PROGRESS_FILE" ]; then
        echo "{}" > "$PROGRESS_FILE"
    fi

    # Use jq if available, otherwise warn user
    if command_exists jq; then
        local content=$(cat "$PROGRESS_FILE")
        echo "$content" | jq ". + {\"$category\": (.${category} // {}) + {\"$item\": \"$status\"}}" > "$PROGRESS_FILE"
    else
        print_warning "jq not installed - progress tracking disabled. Install jq for progress tracking."
        return 0
    fi
}

# Check if item was already installed successfully
is_completed() {
    local category="$1"
    local item="$2"

    if [ ! -f "$PROGRESS_FILE" ]; then
        return 1
    fi

    if command_exists jq; then
        local status=$(jq -r ".${category}.${item} // \"\"" "$PROGRESS_FILE" 2>/dev/null)
        [ "$status" = "completed" ]
    else
        grep -q "\"$item\".*\"completed\"" "$PROGRESS_FILE" 2>/dev/null
    fi
}

# Install package with error handling
install_package() {
    local package="$1"
    local name="${2:-$package}"

    if [ "$DRY_RUN" = true ]; then
        print_dry_run "Would install: $name"
        return 0
    fi

    if is_completed "packages" "$package"; then
        print_success "$name already installed (skipped)"
        return 0
    fi

    # Special handling for GitHub CLI
    if [ "$package" = "gh" ]; then
        install_github_cli "$name"
        return $?
    fi

    # Special handling for lazygit and lazydocker
    if [ "$package" = "lazygit" ] || [ "$package" = "lazydocker" ]; then
        install_lazy_tool "$package" "$name"
        return $?
    fi

    # Special handling for OpenRGB
    if [ "$package" = "openrgb" ]; then
        install_openrgb "$name"
        return $?
    fi

    # Special handling for NVIDIA tools
    if [ "$package" = "nvidia-settings" ] || [ "$package" = "nvidia-utils" ]; then
        install_nvidia_tools "$package" "$name"
        return $?
    fi

    if dpkg -l | grep -q "^ii.*$package "; then
        print_success "$name already installed"
        save_progress "packages" "$package" "completed"
        return 0
    fi

    print_status "Installing $name..."
    if sudo apt-get install -y "$package" >/dev/null 2>&1; then
        print_success "$name installed successfully"
        save_progress "packages" "$package" "completed"
        return 0
    else
        print_error "Failed to install $name"
        save_progress "packages" "$package" "failed"
        return 1
    fi
}

# Install GitHub CLI
install_github_cli() {
    local name="${1:-gh}"

    if is_completed "packages" "gh"; then
        print_success "$name already installed (skipped)"
        install_gh_select_extension
        return 0
    fi

    if command_exists gh; then
        print_success "$name already installed"
        save_progress "packages" "gh" "completed"
        install_gh_select_extension
        return 0
    fi

    print_status "Installing GitHub CLI..."

    # Add GitHub CLI repository and install
    if curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg >/dev/null 2>&1 && \
       echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null 2>&1 && \
       sudo apt update >/dev/null 2>&1 && \
       sudo apt install -y gh >/dev/null 2>&1; then
        print_success "$name installed successfully"
        save_progress "packages" "gh" "completed"
        install_gh_select_extension
        return 0
    else
        print_warning "Failed to install GitHub CLI via apt, trying alternative method..."
        # Fallback: try snap
        if command_exists snap; then
            if sudo snap install gh >/dev/null 2>&1; then
                print_success "$name installed via snap"
                save_progress "packages" "gh" "completed"
                install_gh_select_extension
                return 0
            fi
        fi
        print_error "Failed to install $name"
        save_progress "packages" "gh" "failed"
        return 1
    fi
}

# Install gh-select extension for GitHub CLI
install_gh_select_extension() {
    if ! command_exists gh; then
        return 0
    fi

    # Check if extension is already installed
    if gh extension list 2>/dev/null | grep -q "remcostoeten/gh-select"; then
        print_success "gh-select extension already installed"
        return 0
    fi

    # Check dependencies
    local missing_deps=()
    if ! command_exists fzf; then
        missing_deps+=("fzf")
    fi
    if ! command_exists jq; then
        missing_deps+=("jq")
    fi

    if [ ${#missing_deps[@]} -gt 0 ]; then
        print_warning "gh-select requires: ${missing_deps[*]}"
        print_info "These will be installed in the CLI Utilities section"
        return 0
    fi

    print_status "Installing gh-select extension..."
    if gh extension install remcostoeten/gh-select >/dev/null 2>&1; then
        print_success "gh-select extension installed successfully"
        save_progress "tools" "gh-select" "completed"
        return 0
    else
        print_warning "Failed to install gh-select extension"
        print_info "You can install it manually with: gh extension install remcostoeten/gh-select"
        return 1
    fi
}

# Install lazygit or lazydocker
install_lazy_tool() {
    local package="$1"
    local name="${2:-$package}"

    if is_completed "packages" "$package"; then
        print_success "$name already installed (skipped)"
        return 0
    fi

    if command_exists "$package"; then
        print_success "$name already installed"
        save_progress "packages" "$package" "completed"
        return 0
    fi

    print_status "Installing $name..."

    # Get latest release URL from GitHub
    local repo=""
    if [ "$package" = "lazygit" ]; then
        repo="jesseduffield/lazygit"
    elif [ "$package" = "lazydocker" ]; then
        repo="jesseduffield/lazydocker"
    else
        print_error "Unknown lazy tool: $package"
        return 1
    fi

    # Detect architecture
    local arch=""
    case "$(uname -m)" in
        x86_64) arch="x86_64" ;;
        aarch64|arm64) arch="arm64" ;;
        *) print_error "Unsupported architecture for $name"; return 1 ;;
    esac

    # Get latest release
    local latest_url=$(curl -s https://api.github.com/repos/$repo/releases/latest | grep "browser_download_url.*Linux_${arch}.tar.gz" | head -1 | cut -d'"' -f4)

    if [ -z "$latest_url" ]; then
        print_warning "Could not determine download URL for $name"
        print_info "You can install manually from: https://github.com/$repo/releases"
        return 1
    fi

    # Download and install
    local temp_dir=$(mktemp -d)
    cd "$temp_dir" || return 1

    if wget -q "$latest_url" -O "${package}.tar.gz" 2>/dev/null; then
        tar -xzf "${package}.tar.gz" 2>/dev/null
        local binary=$(find . -name "$package" -type f | head -1)
        if [ -n "$binary" ] && [ -f "$binary" ]; then
            sudo mv "$binary" "/usr/local/bin/$package"
            sudo chmod +x "/usr/local/bin/$package"
            print_success "$name installed successfully"
            save_progress "packages" "$package" "completed"
            cd - >/dev/null
            rm -rf "$temp_dir"
            return 0
        fi
    fi

    print_error "Failed to install $name"
    save_progress "packages" "$package" "failed"
    cd - >/dev/null
    rm -rf "$temp_dir"
    return 1
}

# Install via snap
install_snap() {
    local package="$1"
    local name="${2:-$package}"

    if is_completed "snaps" "$package"; then
        print_success "$name already installed (skipped)"
        return 0
    fi

    if ! command_exists snap; then
        print_warning "snapd not installed. Installing snapd..."
        if ! install_package "snapd" "snapd"; then
            print_error "Failed to install snapd. Cannot install $name"
            return 1
        fi
        sudo systemctl enable --now snapd.socket
    fi

    print_status "Installing $name via snap..."
    if sudo snap install "$package" >/dev/null 2>&1; then
        print_success "$name installed successfully"
        save_progress "snaps" "$package" "completed"
        return 0
    else
        print_error "Failed to install $name"
        save_progress "snaps" "$package" "failed"
        return 1
    fi
}

# Install via curl script
install_curl_script() {
    local url="$1"
    local name="$2"
    local args="${3:-}"

    if is_completed "tools" "$name"; then
        print_success "$name already installed (skipped)"
        return 0
    fi

    # Special handling for uvx (uv installer)
    if [ "$name" = "uvx" ]; then
        if command_exists uv; then
            print_success "$name already installed (uv is available)"
            save_progress "tools" "$name" "completed"
            return 0
        fi
    fi

    # Check if already installed
    if [ "$name" = "bun" ] && [ -d "$HOME/.bun" ] && [ -f "$HOME/.bun/bin/bun" ]; then
        print_success "$name already installed"
        save_progress "tools" "$name" "completed"
        return 0
    fi

    if [ "$name" = "pnpm" ] && command_exists pnpm; then
        print_success "$name already installed"
        save_progress "tools" "$name" "completed"
        return 0
    fi

    if [ "$name" = "turso" ] && command_exists turso; then
        print_success "$name already installed"
        save_progress "tools" "$name" "completed"
        return 0
    fi

    if [ "$name" = "uvx" ] && command_exists uv; then
        print_success "$name already installed (uv available)"
        save_progress "tools" "$name" "completed"
        return 0
    fi

    if [ "$name" = "nvm" ] && [ -d "$HOME/.nvm" ]; then
        print_success "$name already installed"
        save_progress "tools" "$name" "completed"
        return 0
    fi

    if [ "$name" = "vercel" ] && command_exists vercel; then
        print_success "$name already installed"
        save_progress "tools" "$name" "completed"
        return 0
    fi

    if [ "$name" = "netlify" ] && command_exists netlify; then
        print_success "$name already installed"
        save_progress "tools" "$name" "completed"
        return 0
    fi

    print_status "Installing $name..."

    # Different installers need different handling
    local install_cmd=""
    if [ "$name" = "starship" ]; then
        install_cmd="curl -fsSL \"$url\" | sh -s -- -y"
    elif [ "$name" = "pnpm" ]; then
        install_cmd="curl -fsSL \"$url\" | sh -"
    elif [ "$name" = "turso" ]; then
        install_cmd="curl -sSfL \"$url\" | bash"
    elif [ "$name" = "uvx" ]; then
        install_cmd="curl -LsSf https://astral.sh/uv/install.sh | sh"
    elif [ "$name" = "vercel" ]; then
        install_cmd="curl -fsSL \"$url\" | sh"
    elif [ "$name" = "netlify" ]; then
        install_cmd="curl -fsSL \"$url\" | sh"
    elif [ "$name" = "nvm" ]; then
        install_cmd="curl -o- \"$url\" | bash"
    else
        install_cmd="curl -fsSL \"$url\" | bash"
    fi

    if eval "$install_cmd" >/dev/null 2>&1; then
        print_success "$name installed successfully"
        save_progress "tools" "$name" "completed"

        # Add to PATH if needed
        if [ "$name" = "bun" ]; then
            export BUN_INSTALL="$HOME/.bun"
            export PATH="$BUN_INSTALL/bin:$PATH"
            if [ -f "$HOME/.bashrc" ] && ! grep -q "BUN_INSTALL" "$HOME/.bashrc"; then
                echo "" >> "$HOME/.bashrc"
                echo "# Bun" >> "$HOME/.bashrc"
                echo "export BUN_INSTALL=\"\$HOME/.bun\"" >> "$HOME/.bashrc"
                echo "export PATH=\"\$BUN_INSTALL/bin:\$PATH\"" >> "$HOME/.bashrc"
            fi
        fi

        if [ "$name" = "pnpm" ]; then
            export PNPM_HOME="$HOME/.local/share/pnpm"
            export PATH="$PNPM_HOME:$PATH"
            if [ -f "$HOME/.bashrc" ] && ! grep -q "PNPM_HOME" "$HOME/.bashrc"; then
                echo "" >> "$HOME/.bashrc"
                echo "# pnpm" >> "$HOME/.bashrc"
                echo "export PNPM_HOME=\"\$HOME/.local/share/pnpm\"" >> "$HOME/.bashrc"
                echo "export PATH=\"\$PNPM_HOME:\$PATH\"" >> "$HOME/.bashrc"
            fi
        fi

        if [ "$name" = "turso" ]; then
            export TURSO_INSTALL="$HOME/.turso"
            export PATH="$TURSO_INSTALL:$PATH"
            if [ -f "$HOME/.bashrc" ] && ! grep -q "TURSO_INSTALL" "$HOME/.bashrc"; then
                echo "" >> "$HOME/.bashrc"
                echo "# Turso CLI" >> "$HOME/.bashrc"
                echo "export TURSO_INSTALL=\"\$HOME/.turso\"" >> "$HOME/.bashrc"
                echo "export PATH=\"\$TURSO_INSTALL:\$PATH\"" >> "$HOME/.bashrc"
            fi
        fi

        if [ "$name" = "uvx" ]; then
            export PATH="$HOME/.cargo/bin:$PATH"
            if [ -f "$HOME/.bashrc" ] && ! grep -q "\.cargo/bin" "$HOME/.bashrc"; then
                echo "" >> "$HOME/.bashrc"
                echo "# uv (includes uvx)" >> "$HOME/.bashrc"
                echo "export PATH=\"\$HOME/.cargo/bin:\$PATH\"" >> "$HOME/.bashrc"
            fi
        fi

        if [ "$name" = "nvm" ]; then
            export NVM_DIR="$HOME/.nvm"
            if [ -f "$HOME/.bashrc" ] && ! grep -q "NVM_DIR" "$HOME/.bashrc"; then
                echo "" >> "$HOME/.bashrc"
                echo "# NVM" >> "$HOME/.bashrc"
                echo "export NVM_DIR=\"\$HOME/.nvm\"" >> "$HOME/.bashrc"
                echo "[ -s \"\$NVM_DIR/nvm.sh\" ] && \. \"\$NVM_DIR/nvm.sh\"" >> "$HOME/.bashrc"
                echo "[ -s \"\$NVM_DIR/bash_completion\" ] && \. \"\$NVM_DIR/bash_completion\"" >> "$HOME/.bashrc"
            fi
        fi

        if [ "$name" = "vercel" ] || [ "$name" = "netlify" ]; then
            # These typically install to ~/.local/bin or similar
            if [ -f "$HOME/.bashrc" ] && ! grep -q "\.local/bin" "$HOME/.bashrc"; then
                echo "" >> "$HOME/.bashrc"
                echo "# Local bin (for vercel, netlify, etc.)" >> "$HOME/.bashrc"
                echo "export PATH=\"\$HOME/.local/bin:\$PATH\"" >> "$HOME/.bashrc"
            fi
        fi

        return 0
    else
        print_error "Failed to install $name"
        save_progress "tools" "$name" "failed"
        return 1
    fi
}

# Install via cargo
install_cargo() {
    local package="$1"
    local name="${2:-$package}"

    if is_completed "cargo" "$package"; then
        print_success "$name already installed (skipped)"
        return 0
    fi

    if ! command_exists cargo; then
        print_warning "Cargo not found. Install Rust first."
        return 1
    fi

    print_status "Installing $name via cargo..."
    if cargo install "$package" >/dev/null 2>&1; then
        print_success "$name installed successfully"
        save_progress "cargo" "$package" "completed"
        return 0
    else
        print_error "Failed to install $name"
        save_progress "cargo" "$package" "failed"
        return 1
    fi
}

# Install via npm
install_npm() {
    local package="$1"
    local name="${2:-$package}"
    local global="${3:-true}"

    if is_completed "npm" "$package"; then
        print_success "$name already installed (skipped)"
        return 0
    fi

    if ! command_exists npm; then
        print_warning "npm not found. Install Node.js first."
        return 1
    fi

    print_status "Installing $name via npm..."
    local cmd="npm install"
    [ "$global" = "true" ] && cmd="npm install -g"

    if $cmd "$package" >/dev/null 2>&1; then
        print_success "$name installed successfully"
        save_progress "npm" "$package" "completed"
        return 0
    else
        print_error "Failed to install $name"
        save_progress "npm" "$package" "failed"
        return 1
    fi
}

# Install npm CLI tool
install_npm_tool() {
    local package="$1"
    local name="${2:-$package}"

    if is_completed "tools" "$name"; then
        print_success "$name already installed (skipped)"
        return 0
    fi

    if command_exists "$name" || command_exists "$package"; then
        print_success "$name already installed"
        save_progress "tools" "$name" "completed"
        return 0
    fi

    if ! command_exists npm && ! command_exists pnpm; then
        print_warning "npm or pnpm not found. Please install Node.js first."
        return 1
    fi

    print_status "Installing $name via npm/pnpm..."

    local install_cmd=""
    if command_exists pnpm; then
        install_cmd="pnpm add -g $package"
    else
        install_cmd="npm install -g $package"
    fi

    if eval "$install_cmd" >/dev/null 2>&1; then
        print_success "$name installed successfully"
        save_progress "tools" "$name" "completed"
        return 0
    else
        print_error "Failed to install $name"
        save_progress "tools" "$name" "failed"
        return 1
    fi
}

# Install OpenRGB
install_openrgb() {
    local name="${1:-OpenRGB}"

    if is_completed "packages" "openrgb"; then
        print_success "$name already installed (skipped)"
        return 0
    fi

    if command_exists openrgb; then
        print_success "$name already installed"
        save_progress "packages" "openrgb" "completed"
        return 0
    fi

    print_status "Installing $name..."

    # Try apt first
    if sudo apt-get install -y openrgb >/dev/null 2>&1; then
        print_success "$name installed successfully via apt"
        save_progress "packages" "openrgb" "completed"
        return 0
    fi

    # Try adding PPA if apt install fails
    print_status "Adding OpenRGB PPA..."
    if sudo add-apt-repository -y ppa:thopiekar/openrgb >/dev/null 2>&1; then
        sudo apt update >/dev/null 2>&1
        if sudo apt-get install -y openrgb >/dev/null 2>&1; then
            print_success "$name installed successfully via PPA"
            save_progress "packages" "openrgb" "completed"
            return 0
        fi
    fi

    print_error "Failed to install $name"
    print_info "You can try installing manually: sudo add-apt-repository ppa:thopiekar/openrgb && sudo apt update && sudo apt install openrgb"
    save_progress "packages" "openrgb" "failed"
    return 1
}

# Install NVIDIA tools
install_nvidia_tools() {
    local package="$1"
    local name="${2:-$package}"

    if is_completed "packages" "$package"; then
        print_success "$name already installed (skipped)"
        return 0
    fi

    if dpkg -l | grep -q "^ii.*$package "; then
        print_success "$name already installed"
        save_progress "packages" "$package" "completed"
        return 0
    fi

    print_status "Installing $name..."

    # Check if NVIDIA GPU is present
    if ! lspci | grep -i nvidia >/dev/null 2>&1; then
        print_warning "No NVIDIA GPU detected. Skipping $name installation."
        return 1
    fi

    if sudo apt-get install -y "$package" >/dev/null 2>&1; then
        print_success "$name installed successfully"
        save_progress "packages" "$package" "completed"

        # For nvidia-settings, provide helpful info
        if [ "$package" = "nvidia-settings" ]; then
            print_info "NVIDIA Settings installed. You can configure fan curves with: nvidia-settings"
            print_info "For automatic fan control, consider installing: nvidia-ml-py3 (Python package)"
        fi

        return 0
    else
        print_error "Failed to install $name"
        save_progress "packages" "$package" "failed"
        return 1
    fi
}

# Select snap packages
select_snap_packages() {
    local category="$1"
    local title="$2"
    local -n packages="$3"

    print_header "$title"

    local selected=()
    local index=1

    for package in "${packages[@]}"; do
        local name="${package%%:*}"
        local display="${package##*:}"

        local installed=""
        if snap list "$name" >/dev/null 2>&1; then
            installed=" [INSTALLED]"
        fi

        echo -e "  ${CYAN}[$index]${NC} $display$installed"
        ((index++))
    done

    echo -e "  ${CYAN}[a]${NC} Select all"
    echo -e "  ${CYAN}[s]${NC} Skip this category"
    echo ""

    read -p "Select packages (comma-separated numbers, 'a' for all, 's' to skip): " selection

    if [ "$selection" = "s" ] || [ -z "$selection" ]; then
        return 1
    fi

    if [ "$selection" = "a" ]; then
        selected=("${packages[@]}")
    else
        IFS=',' read -ra indices <<< "$selection"
        for idx in "${indices[@]}"; do
            idx=$(echo "$idx" | xargs)
            if [[ "$idx" =~ ^[0-9]+$ ]] && [ "$idx" -ge 1 ] && [ "$idx" -le "${#packages[@]}" ]; then
                selected+=("${packages[$((idx-1))]}")
            fi
        done
    fi

    local failed=0
    for package in "${selected[@]}"; do
        local name="${package%%:*}"
        local display="${package##*:}"

        if ! install_snap "$name" "$display"; then
            ((failed++))
        fi
    done

    return $failed
}


# ============================================================================
# INTERACTIVE SELECTION FUNCTIONS
# ============================================================================

# Show menu and get selections (Universal format)
select_packages() {
    local category="$1"
    local title="$2"
    local -n packages="$3"

    print_header "$title"

    local selected=()
    local index=1

    # Display packages
    for package in "${packages[@]}"; do
        # Parse new format: "name|method|extra|display"
        IFS='|' read -ra parts <<< "$package"
        local name="${parts[0]}"
        local method="${parts[1]}"
        local display="${parts[3]:-${parts[2]:-$name}}"

        # Check if already installed
        local installed=""
        if command_exists "$name" || dpkg -l | grep -q "^ii.*$name "; then
            installed=" [INSTALLED]"
        fi

        echo -e "  ${CYAN}[$index]${NC} $display$installed"
        ((index++))
    done

    echo -e "  ${CYAN}[a]${NC} Select all"
    echo -e "  ${CYAN}[s]${NC} Skip this category"
    echo ""

    read -p "Select packages (comma-separated numbers, 'a' for all, 's' to skip): " selection

    if [ "$selection" = "s" ] || [ -z "$selection" ]; then
        return 1
    fi

    if [ "$selection" = "a" ]; then
        selected=("${packages[@]}")
    else
        IFS=',' read -ra indices <<< "$selection"
        for idx in "${indices[@]}"; do
            idx=$(echo "$idx" | xargs) # trim whitespace
            if [[ "$idx" =~ ^[0-9]+$ ]] && [ "$idx" -ge 1 ] && [ "$idx" -le "${#packages[@]}" ]; then
                selected+=("${packages[$((idx-1))]}")
            fi
        done
    fi

    # Install selected packages using universal installer
    local failed=0
    for package_string in "${selected[@]}"; do
        if ! install_universal "$package_string"; then
            ((failed++))
        fi
    done

    if [ $failed -gt 0 ]; then
        print_warning "$failed package(s) failed to install"
        return 1
    fi

    return 0
}

# Install tool via curl script
select_curl_tools() {
    local category="$1"
    local title="$2"
    local -n tools="$3"

    print_header "$title"

    local selected=()
    local index=1

    for tool in "${tools[@]}"; do
        IFS=':' read -ra parts <<< "$tool"
        local name="${parts[0]}"
        local url="${parts[1]}"
        local display="${parts[2]:-$name}"

        local installed=""
        if command_exists "$name"; then
            installed=" [INSTALLED]"
        fi

        echo -e "  ${CYAN}[$index]${NC} $display$installed"
        ((index++))
    done

    echo -e "  ${CYAN}[a]${NC} Select all"
    echo -e "  ${CYAN}[s]${NC} Skip this category"
    echo ""

    read -p "Select tools (comma-separated numbers, 'a' for all, 's' to skip): " selection

    if [ "$selection" = "s" ] || [ -z "$selection" ]; then
        return 1
    fi

    if [ "$selection" = "a" ]; then
        selected=("${tools[@]}")
    else
        IFS=',' read -ra indices <<< "$selection"
        for idx in "${indices[@]}"; do
            idx=$(echo "$idx" | xargs)
            if [[ "$idx" =~ ^[0-9]+$ ]] && [ "$idx" -ge 1 ] && [ "$idx" -le "${#tools[@]}" ]; then
                selected+=("${tools[$((idx-1))]}")
            fi
        done
    fi

    local failed=0
    for tool in "${selected[@]}"; do
        IFS=':' read -ra parts <<< "$tool"
        local name="${parts[0]}"
        local url="${parts[1]}"
        local display="${parts[2]:-$name}"

        if ! install_curl_script "$url" "$name"; then
            ((failed++))
        fi
    done

    return $failed
}

# Install npm CLI tools
select_npm_tools() {
    local category="$1"
    local title="$2"
    local -n tools="$3"

    # Check if Node.js is installed
    if ! command_exists npm && ! command_exists pnpm; then
        print_warning "npm or pnpm not found. Skipping npm CLI tools installation."
        print_info "Please install Node.js first (it's in Development Tools)"
        return 1
    fi

    print_header "$title"

    local selected=()
    local index=1

    for tool in "${tools[@]}"; do
        IFS=':' read -ra parts <<< "$tool"
        local package="${parts[0]}"
        local name="${parts[1]:-$package}"

        local installed=""
        if command_exists "$package" || command_exists "$name"; then
            installed=" [INSTALLED]"
        fi

        echo -e "  ${CYAN}[$index]${NC} $name$installed"
        ((index++))
    done

    echo -e "  ${CYAN}[a]${NC} Select all"
    echo -e "  ${CYAN}[s]${NC} Skip this category"
    echo ""

    read -p "Select tools (comma-separated numbers, 'a' for all, 's' to skip): " selection

    if [ "$selection" = "s" ] || [ -z "$selection" ]; then
        return 1
    fi

    if [ "$selection" = "a" ]; then
        selected=("${tools[@]}")
    else
        IFS=',' read -ra indices <<< "$selection"
        for idx in "${indices[@]}"; do
            idx=$(echo "$idx" | xargs)
            if [[ "$idx" =~ ^[0-9]+$ ]] && [ "$idx" -ge 1 ] && [ "$idx" -le "${#tools[@]}" ]; then
                selected+=("${tools[$((idx-1))]}")
            fi
        done
    fi

    local failed=0
    for tool in "${selected[@]}"; do
        IFS=':' read -ra parts <<< "$tool"
        local package="${parts[0]}"
        local name="${parts[1]:-$package}"

        if ! install_npm_tool "$package" "$name"; then
            ((failed++))
        fi
    done

    return $failed
}

# ============================================================================
# MAIN SETUP FUNCTIONS
# ============================================================================

update_system() {
    if [ "$SKIP_SYSTEM_UPDATE" = true ]; then
        print_info "Skipping system update (--skip-system-update)"
        return 0
    fi

    print_header "System Update"
    print_status "Updating package lists..."

    if [ "$VERBOSE" = true ]; then
        sudo apt update
    else
        sudo apt update >/dev/null 2>&1
    fi

    print_status "Upgrading system packages..."

    if [ "$VERBOSE" = true ]; then
        sudo apt upgrade -y
    else
        sudo apt upgrade -y >/dev/null 2>&1
    fi

    print_success "System updated"
}

setup_dotfiles() {
    print_header "Dotfiles Setup"

    if [ ! -d "$DOTFILES_DIR" ]; then
        print_warning "Dotfiles directory not found at $DOTFILES_DIR"
        read -p "Enter dotfiles directory path (or press Enter to skip): " custom_dir
        if [ -n "$custom_dir" ]; then
            DOTFILES_DIR="$custom_dir"
        else
            print_warning "Skipping dotfiles setup"
            return 1
        fi
    fi

    # Create fish config symlink (cfg is the entry point)
    if [ -f "$DOTFILES_DIR/cfg" ]; then
        print_status "Creating fish config symlink..."
        mkdir -p "$HOME/.config/fish"

        local fish_config="$HOME/.config/fish/config.fish"
        local already_linked=false

        # Check if already correctly symlinked
        if [ -L "$fish_config" ]; then
            local target=$(readlink "$fish_config")
            if [ "$target" = "$DOTFILES_DIR/cfg" ] || [ "$target" = "../dotfiles/cfg" ] || [ "$target" = "~/.config/dotfiles/cfg" ]; then
                already_linked=true
                print_success "✓ Fish config already correctly symlinked"
                print_info "  cfg → ~/.config/fish/config.fish (entry point)"
            fi
        fi

        if [ "$already_linked" = false ]; then
            # Backup existing config if it exists
            if [ -e "$fish_config" ] && [ ! -L "$fish_config" ]; then
                print_warning "Backing up existing fish config..."
                mv "$fish_config" "${fish_config}.bak.$(date +%s)" 2>/dev/null || true
            fi

            # Create symlink
            if ln -sf "$DOTFILES_DIR/cfg" "$fish_config" 2>/dev/null; then
                print_success "✓ Created fish config symlink: $fish_config → cfg"
                print_info "  cfg is the entry point that sources configs/fish/aliases/*.fish"
                print_info "  Fish shell configuration initialized!"
            else
                print_error "Failed to create fish config symlink"
            fi
        fi
    else
        print_warning "cfg file not found at $DOTFILES_DIR/cfg"
    fi

    # Create symlinks for fish functions (to standard fish location)
    if [ -d "$DOTFILES_DIR/configs/fish/functions" ]; then
        print_status "Creating fish functions symlinks..."
        mkdir -p "$HOME/.config/fish/functions"

        local function_count=0
        for func_file in "$DOTFILES_DIR/configs/fish/functions"/*.fish; do
            if [ -f "$func_file" ]; then
                local func_name=$(basename "$func_file")
                local fish_func_target="$HOME/.config/fish/functions/$func_name"

                # Check if already correctly symlinked
                if [ -L "$fish_func_target" ]; then
                    local target=$(readlink "$fish_func_target")
                    if [ "$target" = "$func_file" ] || [ "$target" = "../../configs/fish/functions/$func_name" ]; then
                        continue
                    fi
                fi

                # Backup existing function if it exists
                if [ -e "$fish_func_target" ] && [ ! -L "$fish_func_target" ]; then
                    mv "$fish_func_target" "${fish_func_target}.bak.$(date +%s)" 2>/dev/null || true
                fi

                # Create symlink
                if ln -sf "$func_file" "$fish_func_target" 2>/dev/null; then
                    ((function_count++))
                fi
            fi
        done

        if [ $function_count -gt 0 ]; then
            print_success "✓ Created $function_count fish function symlinks"
            print_info "  configs/fish/functions/*.fish → ~/.config/fish/functions/*.fish"
        else
            print_info "All fish functions already symlinked"
        fi
    fi

    # Create symlinks for all scripts in scripts/ directory
    print_status "Creating symlinks from scripts/ to bin/..."
    if [ -d "$DOTFILES_DIR/scripts" ]; then
        local symlink_count=0
        for script in "$DOTFILES_DIR/scripts"/*; do
            if [ -f "$script" ] && [ ! -d "$script" ]; then
                local script_name=$(basename "$script")
                # Skip documentation and config files
                if [[ "$script_name" == *.md ]] || [[ "$script_name" == *.txt ]] || \
                   [[ "$script_name" == *.json ]] || [[ "$script_name" == *.lock ]] || \
                   [[ "$script_name" == *.pyc ]] || [[ "$script_name" == "__pycache__" ]]; then
                    continue
                fi

                local bin_target="$DOTFILES_DIR/bin/$script_name"

                # Skip if already a correct symlink
                if [ -L "$bin_target" ]; then
                    local target=$(readlink "$bin_target")
                    if [ "$target" = "../scripts/$script_name" ] || [ "$target" = "$script" ]; then
                        continue
                    fi
                fi

                # Create symlink
                if [ -e "$bin_target" ] && [ ! -L "$bin_target" ]; then
                    print_warning "Backing up existing $script_name"
                    mv "$bin_target" "${bin_target}.backup.$(date +%s)" 2>/dev/null || true
                fi

                if ln -sf "../scripts/$script_name" "$bin_target" 2>/dev/null; then
                    ((symlink_count++))
                fi
            fi
        done
        if [ $symlink_count -gt 0 ]; then
            print_success "Created $symlink_count symlinks from scripts/ to bin/"
        else
            print_info "All scripts already symlinked"
        fi
    fi

    # Add to PATH
    if [ -d "$DOTFILES_DIR/bin" ]; then
        if [ -f "$HOME/.bashrc" ] && ! grep -q "dotfiles/bin" "$HOME/.bashrc"; then
            echo "" >> "$HOME/.bashrc"
            echo "# Dotfiles bin directory" >> "$HOME/.bashrc"
            echo "export PATH=\"\$HOME/.config/dotfiles/bin:\$PATH\"" >> "$HOME/.bashrc"
            print_success "Added dotfiles/bin to .bashrc"
        fi

        find "$DOTFILES_DIR/bin" -type f -exec chmod +x {} \; 2>/dev/null || true
    fi

    if [ -d "$DOTFILES_DIR/scripts" ]; then
        if [ -f "$HOME/.bashrc" ] && ! grep -q "dotfiles/scripts" "$HOME/.bashrc"; then
            echo "export PATH=\"\$HOME/.config/dotfiles/scripts:\$PATH\"" >> "$HOME/.bashrc"
        fi

        find "$DOTFILES_DIR/scripts" -type f \( -name "*.sh" -o -name "*.py" -o -name "*.ts" -o -name "*.fish" -o -name "*.js" \) -exec chmod +x {} \; 2>/dev/null || true
    fi

    # Create dotfiles CLI config
    if [ ! -f "$DOTFILES_DIR/.dotfiles-cli.json" ]; then
        print_status "Creating dotfiles CLI config..."
        cat > "$DOTFILES_DIR/.dotfiles-cli.json" << 'EOF'
{
  "layout": "categories",
  "banner": "modern",
  "includeAliases": true,
  "includeFunctions": true,
  "groupAliases": true,
  "preferBinOverScripts": true,
  "fzfHeight": "90%",
  "showDescriptions": true,
  "enableCategories": true,
  "recentItems": []
}
EOF
        print_success "Created dotfiles CLI config"
    fi

    # Create git config symlink
    if [ -f "$DOTFILES_DIR/configs/git/.gitconfig" ]; then
        print_status "Creating git config symlink..."
        local git_config="$HOME/.gitconfig"

        if [ -L "$git_config" ]; then
            local target=$(readlink "$git_config")
            if [ "$target" = "$DOTFILES_DIR/configs/git/.gitconfig" ] || [ "$target" = "../dotfiles/configs/git/.gitconfig" ]; then
                print_success "✓ Git config already correctly symlinked"
            else
                print_warning "Backing up existing git config..."
                mv "$git_config" "${git_config}.bak.$(date +%s)" 2>/dev/null || true
                ln -sf "$DOTFILES_DIR/configs/git/.gitconfig" "$git_config"
                print_success "✓ Created git config symlink: $git_config → configs/git/.gitconfig"
            fi
        elif [ -e "$git_config" ]; then
            print_warning "Backing up existing git config..."
            mv "$git_config" "${git_config}.bak.$(date +%s)" 2>/dev/null || true
            ln -sf "$DOTFILES_DIR/configs/git/.gitconfig" "$git_config"
            print_success "✓ Created git config symlink: $git_config → configs/git/.gitconfig"
        else
            ln -sf "$DOTFILES_DIR/configs/git/.gitconfig" "$git_config"
            print_success "✓ Created git config symlink: $git_config → configs/git/.gitconfig"
        fi
    fi

    # Create Cursor config symlinks (settings.json and keybindings.json)
    if [ -d "$DOTFILES_DIR/configs/cursor" ]; then
        print_status "Creating Cursor config symlinks..."
        mkdir -p "$HOME/.config/Cursor/User"

        for config_file in settings.json keybindings.json; do
            if [ -f "$DOTFILES_DIR/configs/cursor/$config_file" ]; then
                local cursor_config="$HOME/.config/Cursor/User/$config_file"

                if [ -L "$cursor_config" ]; then
                    local target=$(readlink "$cursor_config")
                    if [ "$target" = "$DOTFILES_DIR/configs/cursor/$config_file" ] || [ "$target" = "../../dotfiles/configs/cursor/$config_file" ]; then
                        continue
                    fi
                fi

                if [ -e "$cursor_config" ] && [ ! -L "$cursor_config" ]; then
                    print_warning "Backing up existing Cursor $config_file..."
                    mv "$cursor_config" "${cursor_config}.bak.$(date +%s)" 2>/dev/null || true
                fi

                if ln -sf "$DOTFILES_DIR/configs/cursor/$config_file" "$cursor_config" 2>/dev/null; then
                    print_success "✓ Created Cursor $config_file symlink"
                fi
            fi
        done
    fi

    # Initialize git submodules (e.g., env-private)
    if [ -f "$DOTFILES_DIR/.gitmodules" ]; then
        print_status "Initializing git submodules..."
        (cd "$DOTFILES_DIR" && git submodule update --init --recursive >/dev/null 2>&1)
        if [ $? -eq 0 ]; then
            print_success "Git submodules initialized"
        else
            print_warning "Failed to initialize git submodules. Please check .gitmodules."
        fi
    fi

    # Create common directories
    print_status "Creating common directories..."
    local dirs=(
        "$HOME/programs"
        "$HOME/tmp"
        "$HOME/sandbox"
        "$HOME/dev"
        "$HOME/Audio"
    )

    for dir in "${dirs[@]}"; do
        if [ ! -d "$dir" ]; then
            if mkdir -p "$dir" 2>/dev/null; then
                print_success "✓ Created directory: $dir"
            else
                print_error "Failed to create directory: $dir"
            fi
        else
            print_info "Directory already exists: $dir"
        fi
    done

    # Download alarm sound if Audio directory exists and sound doesn't exist
    if [ -d "$HOME/Audio" ] && [ ! -f "$HOME/Audio/alarm.mp3" ]; then
        print_status "Downloading alarm sound..."
        if command_exists curl; then
            if curl -L -f -s -o "$HOME/Audio/alarm.mp3" "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3" >/dev/null 2>&1; then
                print_success "✓ Downloaded alarm sound to ~/Audio/alarm.mp3"
            else
                print_warning "Failed to download alarm sound. You can manually add ~/Audio/alarm.mp3"
            fi
        else
            print_warning "curl not found, skipping alarm sound download"
        fi
    fi
}

setup_config_apps() {
    print_header "Configuration-Based Applications"
    print_info "Detecting applications with configs in configs/ directory..."
    echo ""

    if [ ! -d "$DOTFILES_DIR/configs" ]; then
        print_warning "configs/ directory not found"
        return 1
    fi

    local config_dirs=()
    for dir in "$DOTFILES_DIR/configs"/*; do
        if [ -d "$dir" ]; then
            local dir_name=$(basename "$dir")
            # Skip fish and gnome (handled separately)
            if [ "$dir_name" != "fish" ] && [ "$dir_name" != "gnome" ]; then
                config_dirs+=("$dir_name")
            fi
        fi
    done

    if [ ${#config_dirs[@]} -eq 0 ]; then
        print_info "No config directories found (excluding fish/gnome)"
        return 0
    fi

    print_info "Found config directories: ${config_dirs[*]}"
    echo ""

    local selected_apps=()
    local index=1

    # Show available config apps
    for app in "${config_dirs[@]}"; do
        local package_info="${CONFIG_APPS[$app]:-}"
        local app_name="${app}"
        local installed=""

        if [ -n "$package_info" ]; then
            local package="${package_info%%:*}"
            if command_exists "$package" || command_exists "$app" || dpkg -l | grep -q "^ii.*$package "; then
                installed=" [INSTALLED]"
            fi
        fi

        echo -e "  ${CYAN}[$index]${NC} $app_name$installed"
        ((index++))
    done

    echo -e "  ${CYAN}[a]${NC} Select all"
    echo -e "  ${CYAN}[s]${NC} Skip this section"
    echo ""

    read -p "Select apps to install and configure (comma-separated numbers, 'a' for all, 's' to skip): " selection

    if [ "$selection" = "s" ] || [ -z "$selection" ]; then
        return 1
    fi

    if [ "$selection" = "a" ]; then
        selected_apps=("${config_dirs[@]}")
    else
        IFS=',' read -ra indices <<< "$selection"
        for idx in "${indices[@]}"; do
            idx=$(echo "$idx" | xargs)
            if [[ "$idx" =~ ^[0-9]+$ ]] && [ "$idx" -ge 1 ] && [ "$idx" -le "${#config_dirs[@]}" ]; then
                selected_apps+=("${config_dirs[$((idx-1))]}")
            fi
        done
    fi

    # Install and configure selected apps
    local failed=0
    for app in "${selected_apps[@]}"; do
        local package_info="${CONFIG_APPS[$app]:-}"

        if [ -z "$package_info" ]; then
            print_warning "$app: No package mapping found, skipping installation"
            # Still try to create symlink if config exists
            create_config_symlink "$app" || ((failed++))
            continue
        fi

        local package="${package_info%%:*}"
        local symlink_target="${package_info##*:}"

        # Special handling for wezterm
        if [ "$app" = "wezterm" ]; then
            install_wezterm || print_warning "Failed to install wezterm, but will still try to create symlink"
        else
            # Install package
            print_status "Installing $package for $app..."
            if ! install_package "$package" "$app"; then
                print_warning "Failed to install $package, but will still try to create symlink"
            fi
        fi

        # Create symlink
        create_config_symlink "$app" || ((failed++))
    done

    return $failed
}

# Install wezterm (requires special handling)
install_wezterm() {
    if is_completed "config-apps" "wezterm"; then
        print_success "wezterm already installed (skipped)"
        return 0
    fi

    if command_exists wezterm; then
        print_success "wezterm already installed"
        save_progress "config-apps" "wezterm" "completed"
        return 0
    fi

    print_status "Installing wezterm..."

    # Wezterm installation via GitHub releases
    local temp_dir=$(mktemp -d)
    cd "$temp_dir" || return 1

    # Detect architecture
    local arch=""
    case "$(uname -m)" in
        x86_64) arch="x86_64" ;;
        aarch64|arm64) arch="aarch64" ;;
        *) print_error "Unsupported architecture for wezterm"; cd - >/dev/null; rm -rf "$temp_dir"; return 1 ;;
    esac

    # Get latest release URL
    local latest_url=$(curl -s https://api.github.com/repos/wez/wezterm/releases/latest | grep "browser_download_url.*Ubuntu${arch}.deb" | head -1 | cut -d'"' -f4)

    if [ -z "$latest_url" ]; then
        print_warning "Could not determine wezterm download URL"
        print_info "You can install manually from: https://wezfurlong.org/wezterm/install/linux.html"
        cd - >/dev/null
        rm -rf "$temp_dir"
        return 1
    fi

    # Download and install
    if wget -q "$latest_url" -O wezterm.deb 2>/dev/null; then
        if sudo dpkg -i wezterm.deb >/dev/null 2>&1 || sudo apt-get install -f -y >/dev/null 2>&1; then
            print_success "wezterm installed successfully"
            save_progress "config-apps" "wezterm" "completed"
            cd - >/dev/null
            rm -rf "$temp_dir"
            return 0
        fi
    fi

    # Fallback: try using cargo if available
    if command_exists cargo; then
        print_info "Trying alternative installation via cargo..."
        if cargo install --locked wezterm >/dev/null 2>&1; then
            print_success "wezterm installed via cargo"
            save_progress "config-apps" "wezterm" "completed"
            cd - >/dev/null
            rm -rf "$temp_dir"
            return 0
        fi
    fi

    print_warning "Failed to install wezterm automatically"
    print_info "You can install manually from: https://wezfurlong.org/wezterm/install/linux.html"
    cd - >/dev/null
    rm -rf "$temp_dir"
    return 1
}

create_config_symlink() {
    local app="$1"
    local source_dir="$DOTFILES_DIR/configs/$app"
    local symlink_target=""

    if [ -n "${CONFIG_APPS[$app]:-}" ]; then
        local package_info="${CONFIG_APPS[$app]}"
        symlink_target="${package_info##*:}"
    else
        symlink_target="$HOME/.config/$app"
    fi

    if [ -z "$symlink_target" ]; then
        print_warning "Could not determine symlink target for $app"
        return 1
    fi

    if [ ! -d "$source_dir" ]; then
        print_warning "Source directory not found: $source_dir"
        return 1
    fi

    print_status "Creating symlink for $app config..."

    # Expand ~ in symlink_target
    symlink_target="${symlink_target/#\~/$HOME}"

    # Create parent directory if needed
    local parent_dir=$(dirname "$symlink_target")
    mkdir -p "$parent_dir"

    # Backup existing config if it exists
    if [ -e "$symlink_target" ] || [ -L "$symlink_target" ]; then
        if [ -L "$symlink_target" ]; then
            local current_target=$(readlink "$symlink_target")
            # Check if already pointing to correct location
            if [ "$current_target" = "$source_dir" ] || [ "$current_target" = "../configs/$app" ] || [ "$current_target" = "../../configs/$app/.config/wezterm" ]; then
                print_success "$app config already correctly symlinked"
                return 0
            fi
        fi
        print_warning "Backing up existing $app config..."
        mv "$symlink_target" "${symlink_target}.backup.$(date +%s)" 2>/dev/null || true
    fi

    # Create symlink
    if ln -sf "$source_dir" "$symlink_target"; then
        print_success "Created symlink: $symlink_target -> $source_dir"
        return 0
    else
        print_error "Failed to create symlink for $app"
        return 1
    fi
}

setup_gnome_aesthetics() {
    print_header "GNOME Aesthetic Setup"

    if [ ! -d "$DOTFILES_DIR/configs/gnome" ]; then
        print_info "GNOME configs directory not found, skipping"
        return 0
    fi

    print_info "This will set up a beautiful GNOME desktop with:"
    echo "  • Transparent and blurred panels"
    echo "  • Custom GTK theming"
    echo "  • Aesthetic lock screen"
    echo "  • Beautiful animations and effects"
    echo ""

    read -p "Set up GNOME aesthetics? (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_info "Skipping GNOME aesthetic setup"
        return 0
    fi

    # Ensure GNOME tools are installed
    if ! command_exists gnome-extensions; then
        print_status "Installing gnome-shell-extensions..."
        install_package "gnome-shell-extensions" "gnome-shell-extensions" || {
            print_warning "Failed to install gnome-shell-extensions"
            return 1
        }
    fi

    if ! command_exists gsettings; then
        print_status "Installing dconf-cli..."
        install_package "dconf-cli" "dconf-cli" || {
            print_warning "Failed to install dconf-cli"
            return 1
        }
    fi

    local setup_script="$DOTFILES_DIR/configs/gnome/setup-aesthetic-gnome.sh"

    if [ -f "$setup_script" ]; then
        print_status "Running GNOME aesthetic setup..."
        if bash "$setup_script"; then
            print_success "GNOME aesthetic setup completed!"
            print_info "You may need to log out and log back in for all changes to take effect"
        else
            print_warning "GNOME aesthetic setup encountered some issues"
        fi
    else
        print_warning "GNOME setup script not found at $setup_script"
    fi
}

setup_fish_shell() {
    print_header "Fish Shell Setup"

    if ! command_exists fish; then
        print_warning "Fish shell not installed"
        return 1
    fi

    read -p "Set fish as default shell? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        chsh -s /usr/bin/fish || print_warning "Failed to set fish as default (may require logout/login)"
        print_success "Fish set as default shell (restart terminal to apply)"
    fi
}

install_nerd_fonts() {
    if [ "$SKIP_FONTS" = true ]; then
        print_info "Skipping Nerd Fonts installation (--skip-fonts)"
        return 0
    fi

    print_header "Nerd Fonts Installation"
    print_info "Installing popular Nerd Fonts in the background..."
    print_info "This may take a few minutes (fonts are large downloads)"

    local fonts_dir="$HOME/.local/share/fonts"
    mkdir -p "$fonts_dir"

    # List of popular Nerd Fonts to install
    local fonts=(
        "FiraCode"
        "JetBrainsMono"
        "CaskaydiaCove"
        "Hack"
        "Iosevka"
        "Meslo"
        "SourceCodePro"
    )

    # Function to install a single font in background
    install_font_background() {
        local font_name="$1"
        local font_url="https://github.com/ryanoasis/nerd-fonts/releases/latest/download/${font_name}.zip"
        local temp_dir=$(mktemp -d)

        cd "$temp_dir" || return 1

        # Download font
        if wget -q "$font_url" -O "${font_name}.zip" 2>/dev/null; then
            # Extract fonts (unzip without progress, quiet mode)
            unzip -q -o "${font_name}.zip" -d "$fonts_dir" 2>/dev/null || true
            # Clean up extracted files, keep only .ttf files
            find "$fonts_dir" -name "*.otf" -delete 2>/dev/null || true
            cd - >/dev/null
            rm -rf "$temp_dir"
            return 0
        else
            cd - >/dev/null
            rm -rf "$temp_dir"
            return 1
        fi
    }

    # Install fonts in parallel (background jobs)
    local installed=0
    local failed=0

    for font in "${fonts[@]}"; do
        # Check if font already installed
        if find "$fonts_dir" -name "*${font}*" -type f | grep -q "${font}"; then
            print_success "$font Nerd Font already installed (skipped)"
            continue
        fi

        print_status "Installing $font Nerd Font..."
        # Run in background without throttling
        install_font_background "$font" &
    done

    # Wait for all background jobs to complete
    wait

    # Refresh font cache
    print_status "Refreshing font cache..."
    fc-cache -f "$fonts_dir" >/dev/null 2>&1 || true

    # Count installed fonts
    local font_count=$(find "$fonts_dir" -name "*Nerd*" -type f 2>/dev/null | wc -l)

    if [ "$font_count" -gt 0 ]; then
        print_success "✓ Nerd Fonts installation completed!"
        print_info "  Installed $font_count font files"
        print_info "  Fonts available: JetBrains Mono, Fira Code, Caskaydia Cove, Hack, and more"
        print_info "  Use fc-list | grep -i nerd to see all installed Nerd Fonts"
    else
        print_warning "No Nerd Fonts were installed. Check your internet connection."
    fi
}

# ============================================================================
# MAIN EXECUTION
# ============================================================================

main() {
    # Initialize tracking variables
    TOTAL_SUCCESS=0
    TOTAL_FAILED=0

    # Parse command line arguments first
    parse_args "$@"

    # If no arguments provided, show interactive menu
    if [ $# -eq 0 ]; then
        show_main_menu
    fi

    clear
    if [ "$DRY_RUN" = true ]; then
        echo -e "${BOLD}${YELLOW}"
        echo "╔════════════════════════════════════════════════════════════╗"
        echo "║     DRY RUN MODE - No changes will be made               ║"
        if [ -n "$DRY_RUN_SECTION" ]; then
            echo "║     Section: $DRY_RUN_SECTION"
        fi
        echo "╚════════════════════════════════════════════════════════════╝"
        echo -e "${NC}"
        echo ""
    else
        echo -e "${BOLD}${MAGENTA}"
        echo "╔════════════════════════════════════════════════════════════╗"
        echo "║     Interactive Dotfiles Setup for Ubuntu/Debian         ║"
        echo "╚════════════════════════════════════════════════════════════╝"
        echo -e "${NC}"
    fi

    # Check if running on Ubuntu/Debian
    if ! command_exists apt-get; then
        print_error "This script is designed for Ubuntu/Debian systems"
        exit 1
    fi

    # Check for sudo
    if ! command_exists sudo; then
        print_error "sudo is required but not installed"
        exit 1
    fi

    # Initialize data directory structure
    init_data_directory

    # Check for resume
    if [ -f "$PROGRESS_FILE" ]; then
        print_info "Previous progress found: $PROGRESS_FILE"
        read -p "Resume previous installation? (y/n): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            rm -f "$PROGRESS_FILE"
            print_info "Progress file removed. Starting fresh installation."
        else
            print_info "Resuming previous installation. Already completed items will be skipped."
        fi
    fi

    # System update (always run, unless dry run)
    if [ "$DRY_RUN" != true ]; then
        update_system
    else
        print_dry_run "Would run: sudo apt update && sudo apt upgrade -y"
    fi

    # Check if running specific section dry run
    local run_section=""
    if [ -n "$DRY_RUN_SECTION" ]; then
        case "$DRY_RUN_SECTION" in
            dev|cli|browsers|snaps|config-apps|git|fish|fonts|communication|media|devops|system|automation|media-playback|gnome|tools|android)
                run_section="$DRY_RUN_SECTION"
                print_info "Dry run mode: Only showing section '$run_section'"
                ;;
            *)
                print_error "Unknown section: $DRY_RUN_SECTION"
                print_info "Available sections: dev, cli, browsers, snaps, config-apps, git, fish, fonts, communication, media, devops, system, automation, media-playback, gnome, tools, android"
                exit 1
                ;;
        esac
    fi

    # Essential packages (always install)
    if [ -z "$run_section" ] || [ "$run_section" = "essential" ]; then
        print_header "Essential Packages"
        print_info "These are required for the setup to work properly"
        for package in "${ESSENTIAL_PACKAGES[@]}"; do
            install_package "$package" "$package" || true
        done
    fi

    # Dotfiles setup (always run, but respect dry run)
    if [ -z "$run_section" ] || [ "$run_section" = "config" ]; then
        setup_dotfiles
    fi

    # Install Python dependencies if requirements.txt exists
    if [ -f "$DOTFILES_DIR/setup/requirements.txt" ]; then
        print_header "Python Dependencies"
        print_status "Installing Python dependencies from setup/requirements.txt..."
        if pip3 install --user -r "$DOTFILES_DIR/setup/requirements.txt" >/dev/null 2>&1; then
            print_success "Python dependencies installed"
        else
            print_warning "Some Python dependencies failed to install. You can install manually with: pip3 install -r setup/requirements.txt"
        fi
    fi

    # Interactive selections
    echo ""
    print_info "You can now select which categories to install"
    echo ""

    # Programming languages & runtimes
    if [ -z "$run_section" ] || [ "$run_section" = "languages" ]; then
        print_info "Press Enter to continue or Ctrl+C to exit at any time"
        echo ""
        select_packages "languages" "Programming Languages & Runtimes" LANGUAGES || true
    fi

    # Code editors & IDEs
    if [ -z "$run_section" ] || [ "$run_section" = "editors" ]; then
        select_packages "editors" "Code Editors & IDEs" EDITORS || true
    fi

    # Package managers
    if [ -z "$run_section" ] || [ "$run_section" = "package-managers" ]; then
        select_packages "package-managers" "Package Managers" PACKAGE_MANAGERS || true
    fi

    # Git tools
    if [ -z "$run_section" ] || [ "$run_section" = "git" ]; then
        select_packages "git-tools" "Git Tools (GitHub CLI, lazygit, lazydocker)" GIT_TOOLS || true
    fi

    # CLI utilities
    if [ -z "$run_section" ] || [ "$run_section" = "cli" ]; then
        select_packages "cli" "Modern CLI Utilities" CLI_UTILITIES || true
    fi

    # Communication apps
    if [ -z "$run_section" ] || [ "$run_section" = "communication" ]; then
        select_packages "communication" "Communication & Social Apps" COMMUNICATION_APPS || true
    fi

    # Media apps
    if [ -z "$run_section" ] || [ "$run_section" = "media" ]; then
        select_packages "media" "Media & Graphics Apps" MEDIA_APPS || true
    fi

    # Browsers
    if [ -z "$run_section" ] || [ "$run_section" = "browsers" ]; then
        select_packages "browsers" "Web Browsers" BROWSERS || true
    fi

    # DevOps tools
    if [ -z "$run_section" ] || [ "$run_section" = "devops" ]; then
        select_packages "devops" "DevOps & Container Tools" DEVOPS_TOOLS || true
    fi

    # System utilities
    if [ -z "$run_section" ] || [ "$run_section" = "system" ]; then
        select_packages "system" "System Utilities" SYSTEM_UTILS || true
    fi

    # Hardware & GPU tools (NVIDIA, OpenRGB)
    if [ -z "$run_section" ] || [ "$run_section" = "hardware" ]; then
        select_packages "hardware" "Hardware & GPU Tools (NVIDIA, OpenRGB)" HARDWARE_TOOLS || true
    fi

    # Snap packages (includes editors like Cursor, VS Code, WhatsApp)
    if [ -z "$run_section" ] || [ "$run_section" = "snaps" ]; then
        select_snap_packages "snaps" "Snap Packages (includes Cursor, VS Code, WhatsApp, etc.)" SNAP_PACKAGES || true
    fi

    # Automation tools
    if [ -z "$run_section" ] || [ "$run_section" = "automation" ]; then
        select_packages "automation" "Automation & Testing Tools (xdotool, ydotool)" AUTOMATION_TOOLS || true
    fi

    # Media playback
    if [ -z "$run_section" ] || [ "$run_section" = "media-playback" ]; then
        select_packages "media-playback" "Media Playback (for alarm script)" MEDIA_PLAYBACK || true
    fi

    # GNOME tools (if GNOME desktop)
    if [ -z "$run_section" ] || [ "$run_section" = "gnome" ]; then
        if [ -n "$XDG_CURRENT_DESKTOP" ] && [[ "$XDG_CURRENT_DESKTOP" == *"GNOME"* ]]; then
            select_packages "gnome" "GNOME Tools" GNOME_TOOLS || true
        fi
    fi

    # Curl-installed tools (bun, starship, nvm, pnpm, turso, vercel, netlify)
    if [ -z "$run_section" ] || [ "$run_section" = "tools" ]; then
        select_curl_tools "tools" "Essential Tools (bun, starship, nvm, pnpm, turso, vercel, netlify)" CURL_TOOLS || true
    fi

    # npm CLI tools (gemini-cli, etc.)
    if [ -z "$run_section" ] || [ "$run_section" = "npm-tools" ]; then
        select_npm_tools "npm-tools" "NPM CLI Tools (gemini-cli, etc.)" NPM_CLI_TOOLS || true
    fi

    # Android Development Tools (optional)
    if [ -z "$run_section" ] || [ "$run_section" = "android" ]; then
        select_snap_packages "android" "Android Development Tools" ANDROID_TOOLS || true
    fi

    # Config-based applications (nvim, wezterm, kitty, etc.)
    if [ -z "$run_section" ] || [ "$run_section" = "config-apps" ]; then
        setup_config_apps || true
    fi

    # GNOME Aesthetic Setup (if GNOME desktop)
    if [ -z "$run_section" ] || [ "$run_section" = "gnome" ]; then
        if [ -n "$XDG_CURRENT_DESKTOP" ] && [[ "$XDG_CURRENT_DESKTOP" == *"GNOME"* ]]; then
            setup_gnome_aesthetics || true
        fi
    fi

    # Setup fish shell
    if [ -z "$run_section" ] || [ "$run_section" = "fish" ]; then
        setup_fish_shell
    fi

    # Install Nerd Fonts (background, no throttling)
    if [ -z "$run_section" ] || [ "$run_section" = "fonts" ]; then
        install_nerd_fonts
    fi

    # Summary
    if [ "$DRY_RUN" = true ]; then
        echo ""
        print_header "Dry Run Complete!"
        print_info "No changes were made. Run without --dry-run to install."
        return 0
    fi
    echo ""
    print_header "Setup Complete!"
    print_success "Installation finished"
    echo ""

    # Show failed installations if any
    if [ -f "$PROGRESS_FILE" ] && command_exists jq; then
        local failed=$(jq -r '.[] | to_entries[] | select(.value == "failed") | .key' "$PROGRESS_FILE" 2>/dev/null | wc -l)
        if [ "$failed" -gt 0 ]; then
            print_warning "$failed installation(s) failed. You can rerun this script to retry."
        fi
    fi

    print_info "Next steps:"
    echo "  1. Restart your terminal or run: source ~/.bashrc"
    echo "  2. If you set fish as default, restart your terminal"
    echo "  3. Run 'dotfiles' or 'df' to launch the interactive menu"
    echo ""
    print_info "Progress saved to: $PROGRESS_FILE"
    print_info "You can rerun './setup.sh' to resume or install additional packages"

    # Cleanup progress file on successful completion (optional)
    read -p "Remove progress file? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        rm -f "$PROGRESS_FILE"
        print_success "Progress file removed"
    fi
}

# Run main function
main "$@"
