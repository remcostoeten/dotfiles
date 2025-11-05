#!/bin/bash

# Command line argument parsing

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
                show_help
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

show_help() {
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
}

# List all packages function (placeholder - will be implemented in menu module)
list_all_packages() {
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
