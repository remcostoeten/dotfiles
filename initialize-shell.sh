#!/usr/bin/env bash

# initialize-shell.sh
# Enhanced script for setting up Fish shell with comprehensive OS support and edge case handling

# --- Configuration ---
DOTFILES_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FISH_CONFIG_SOURCE="${DOTFILES_ROOT}/fish-config"
FISH_CONFIG_TARGET="$HOME/.config/fish"
INITIALIZE_DRY_RUN=false
SCRIPT_VERSION="2.0.0"

# --- Styling and Utility Functions ---
COLOR_GREEN='\033[0;32m'
COLOR_YELLOW='\033[0;33m'
COLOR_RED='\033[0;31m'
COLOR_BLUE='\033[0;34m'
COLOR_PURPLE='\033[0;35m'
COLOR_NC='\033[0m' # No Color

log_info() {
  echo -e "${COLOR_BLUE}[INFO]${COLOR_NC} $1"
}

log_success() {
  echo -e "${COLOR_GREEN}[SUCCESS]${COLOR_NC} $1"
}

log_warn() {
  echo -e "${COLOR_YELLOW}[WARN]${COLOR_NC} $1"
}

log_error() {
  echo -e "${COLOR_RED}[ERROR]${COLOR_NC} $1" >&2
}

log_debug() {
  echo -e "${COLOR_PURPLE}[DEBUG]${COLOR_NC} $1"
}

run_command() {
  local cmd="$@"
  log_info "Executing: ${cmd}"
  if [ "$INITIALIZE_DRY_RUN" = true ]; then
    log_info "DRY RUN: Skipping execution."
    return 0
  else
    eval "${cmd}" 2>/dev/null
    local status=$?
    if [ $status -ne 0 ]; then
      log_error "Command failed with status $status: ${cmd}"
      return $status
    fi
    return 0
  fi
}

confirm_action() {
  local prompt_msg=$1
  read -p "${COLOR_YELLOW}[CONFIRM]${COLOR_NC} ${prompt_msg} (y/N)? " -n 1 -r
  echo "" # New line
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    return 0 # User confirmed
  else
    return 1 # User did not confirm
  fi
}

# Enhanced OS detection
detect_os() {
  local os_name=""
  local os_version=""

  if [[ "$OSTYPE" == "darwin"* ]]; then
    os_name="macOS"
    os_version=$(sw_vers -productVersion 2>/dev/null || echo "unknown")
  elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    if [ -f /etc/os-release ]; then
      . /etc/os-release
      os_name="$NAME"
      os_version="$VERSION_ID"
    elif [ -f /etc/redhat-release ]; then
      os_name="Red Hat"
      os_version=$(cat /etc/redhat-release)
    elif [ -f /etc/debian_version ]; then
      os_name="Debian"
      os_version=$(cat /etc/debian_version)
    else
      os_name="Linux"
      os_version="unknown"
    fi
  elif [[ "$OSTYPE" == "freebsd"* ]]; then
    os_name="FreeBSD"
    os_version=$(freebsd-version 2>/dev/null || uname -r)
  elif [[ "$OSTYPE" == "openbsd"* ]]; then
    os_name="OpenBSD"
    os_version=$(uname -r)
  elif [[ "$OSTYPE" == "netbsd"* ]]; then
    os_name="NetBSD"
    os_version=$(uname -r)
  elif [[ "$OSTYPE" == "cygwin" ]] || [[ "$OSTYPE" == "msys" ]]; then
    os_name="Windows"
    os_version="WSL/Cygwin"
  else
    os_name="Unknown"
    os_version="$OSTYPE"
  fi

  echo "$os_name|$os_version"
}

# Check for potential issues
check_environment() {
  local issues=0

  # Check if running as root
  if [ "$EUID" -eq 0 ]; then
    log_warn "Running as root. This may cause permission issues with dotfiles."
    ((issues++))
  fi

  # Check if HOME is set and accessible
  if [ -z "$HOME" ] || [ ! -d "$HOME" ]; then
    log_error "HOME directory not set or not accessible: $HOME"
    ((issues++))
  fi

  # Check if we can write to HOME
  if [ ! -w "$HOME" ]; then
    log_error "Cannot write to HOME directory: $HOME"
    ((issues++))
  fi

  # Check if .config directory exists or can be created
  if [ ! -d "$HOME/.config" ]; then
    log_info ".config directory doesn't exist. Will create it."
    if [ "$INITIALIZE_DRY_RUN" = false ]; then
      mkdir -p "$HOME/.config" 2>/dev/null || {
        log_error "Cannot create .config directory"
        ((issues++))
      }
    fi
  fi

  # Check for restricted environments
  if [ -n "$SSH_CONNECTION" ] && [ -z "$TMUX" ] && [ -z "$SCREEN" ]; then
    log_warn "Detected SSH connection. Shell changes may not persist after disconnect."
  fi

  # Check filesystem type for symlink support
  local fs_type=$(df -T "$HOME" 2>/dev/null | tail -1 | awk '{print $2}')
  case "$fs_type" in
  "vfat" | "fat32" | "ntfs")
    log_warn "Filesystem ($fs_type) may not support symlinks properly."
    ;;
  esac

  return $issues
}

# Enhanced package manager detection and installation
install_fish() {
  local os_info=$(detect_os)
  local os_name=$(echo "$os_info" | cut -d'|' -f1)
  local os_version=$(echo "$os_info" | cut -d'|' -f2)

  log_info "Detected OS: $os_name $os_version"

  case "$os_name" in
  "macOS")
    install_fish_macos
    ;;
  *"Ubuntu"* | *"Debian"* | *"Mint"*)
    install_fish_debian
    ;;
  *"Red Hat"* | *"CentOS"* | *"Fedora"* | *"Rocky"* | *"AlmaLinux"*)
    install_fish_redhat
    ;;
  *"SUSE"* | *"openSUSE"*)
    install_fish_suse
    ;;
  *"Arch"* | *"Manjaro"*)
    install_fish_arch
    ;;
  *"Alpine"*)
    install_fish_alpine
    ;;
  "FreeBSD")
    install_fish_freebsd
    ;;
  "OpenBSD")
    install_fish_openbsd
    ;;
  "NetBSD")
    install_fish_netbsd
    ;;
  *"Windows"*)
    install_fish_windows
    ;;
  *)
    install_fish_generic
    ;;
  esac
}

install_fish_macos() {
  if command -v brew &>/dev/null; then
    log_info "Using Homebrew to install Fish"
    run_command "brew install fish"
  elif command -v port &>/dev/null; then
    log_info "Using MacPorts to install Fish"
    run_command "sudo port install fish"
  else
    log_error "No package manager found. Please install Homebrew (https://brew.sh) or MacPorts."
    return 1
  fi
}

install_fish_debian() {
  log_info "Using apt to install Fish"
  if run_command "sudo apt-get update"; then
    run_command "sudo apt-get install -y fish"
  else
    log_warn "apt update failed, trying to install anyway"
    run_command "sudo apt-get install -y fish"
  fi
}

install_fish_redhat() {
  if command -v dnf &>/dev/null; then
    log_info "Using dnf to install Fish"
    run_command "sudo dnf install -y fish"
  elif command -v yum &>/dev/null; then
    log_info "Using yum to install Fish"
    run_command "sudo yum install -y fish"
  else
    log_error "No supported package manager (dnf/yum) found"
    return 1
  fi
}

install_fish_suse() {
  log_info "Using zypper to install Fish"
  run_command "sudo zypper install -y fish"
}

install_fish_arch() {
  if command -v pacman &>/dev/null; then
    log_info "Using pacman to install Fish"
    run_command "sudo pacman -Sy --noconfirm fish"
  elif command -v yay &>/dev/null; then
    log_info "Using yay to install Fish"
    run_command "yay -S --noconfirm fish"
  else
    log_error "No supported package manager (pacman/yay) found"
    return 1
  fi
}

install_fish_alpine() {
  log_info "Using apk to install Fish"
  run_command "sudo apk add --no-cache fish"
}

install_fish_freebsd() {
  if command -v pkg &>/dev/null; then
    log_info "Using pkg to install Fish"
    run_command "sudo pkg install -y fish"
  else
    log_error "pkg not found. Please install Fish manually from ports."
    return 1
  fi
}

install_fish_openbsd() {
  log_info "Using pkg_add to install Fish"
  run_command "sudo pkg_add fish"
}

install_fish_netbsd() {
  if command -v pkgin &>/dev/null; then
    log_info "Using pkgin to install Fish"
    run_command "sudo pkgin -y install fish"
  else
    log_error "pkgin not found. Please install Fish manually."
    return 1
  fi
}

install_fish_windows() {
  log_warn "Windows/WSL detected. Fish installation varies by environment."
  if command -v apt-get &>/dev/null; then
    log_info "WSL with apt detected"
    install_fish_debian
  elif command -v pacman &>/dev/null; then
    log_info "WSL with pacman detected (Arch)"
    install_fish_arch
  else
    log_error "Please install Fish manually for your Windows environment."
    return 1
  fi
}

install_fish_generic() {
  log_warn "Unsupported OS. Trying common package managers..."
  local managers=("apt-get" "dnf" "yum" "pacman" "zypper" "apk" "pkg" "brew")
  local commands=("sudo apt-get install -y fish" "sudo dnf install -y fish" "sudo yum install -y fish" "sudo pacman -Sy --noconfirm fish" "sudo zypper install -y fish" "sudo apk add fish" "sudo pkg install -y fish" "brew install fish")

  for i in "${!managers[@]}"; do
    if command -v "${managers[$i]}" &>/dev/null; then
      log_info "Found ${managers[$i]}, attempting installation"
      if run_command "${commands[$i]}"; then
        return 0
      fi
    fi
  done

  log_error "No supported package manager found. Please install Fish manually."
  return 1
}

# Enhanced symlink handling
create_fish_symlink() {
  local target_dir=$(dirname "$FISH_CONFIG_TARGET")

  # Ensure parent directory exists
  if [ ! -d "$target_dir" ]; then
    log_info "Creating parent directory: $target_dir"
    run_command "mkdir -p $target_dir"
  fi

  # Handle existing symlinks (including broken ones)
  if [ -L "$FISH_CONFIG_TARGET" ]; then
    log_info "Removing existing symlink at $FISH_CONFIG_TARGET"
    run_command "rm $FISH_CONFIG_TARGET"
  fi

  # Create absolute path symlink for better reliability
  local abs_source=$(readlink -f "$FISH_CONFIG_SOURCE" 2>/dev/null || realpath "$FISH_CONFIG_SOURCE" 2>/dev/null || echo "$FISH_CONFIG_SOURCE")

  log_info "Creating symlink: $FISH_CONFIG_TARGET -> $abs_source"
  run_command "ln -sf $abs_source $FISH_CONFIG_TARGET"

  # Verify symlink was created correctly
  if [ "$INITIALIZE_DRY_RUN" = false ]; then
    if [ -L "$FISH_CONFIG_TARGET" ] && [ -e "$FISH_CONFIG_TARGET" ]; then
      log_success "Symlink created and verified successfully"
      return 0
    else
      log_error "Symlink creation failed or points to non-existent target"
      return 1
    fi
  fi
}

# Enhanced shell changing with better error handling
setup_default_shell() {
  local fish_path=$(command -v fish)

  if [ -z "$fish_path" ]; then
    log_error "Fish executable not found in PATH"
    return 1
  fi

  log_info "Fish found at: $fish_path"

  # Check if fish is in /etc/shells
  if ! grep -Fxq "$fish_path" /etc/shells 2>/dev/null; then
    log_warn "Fish is not in /etc/shells"
    if confirm_action "Add Fish to /etc/shells? (requires sudo)"; then
      if [ "$INITIALIZE_DRY_RUN" = false ]; then
        echo "$fish_path" | sudo tee -a /etc/shells >/dev/null
        if [ $? -eq 0 ]; then
          log_success "Fish added to /etc/shells"
        else
          log_error "Failed to add Fish to /etc/shells"
          return 1
        fi
      else
        log_info "DRY RUN: Would add $fish_path to /etc/shells"
      fi
    else
      log_warn "Cannot set Fish as default shell without adding it to /etc/shells"
      return 1
    fi
  else
    log_success "Fish is already in /etc/shells"
  fi

  # Check current shell
  local current_shell=$(basename "$SHELL")
  if [ "$current_shell" = "fish" ]; then
    log_success "Fish is already your default shell"
    return 0
  fi

  # Attempt to change shell
  if confirm_action "Set Fish as your default shell?"; then
    if [ "$INITIALIZE_DRY_RUN" = false ]; then
      if chsh -s "$fish_path" 2>/dev/null; then
        log_success "Default shell changed to Fish"
        log_info "Please log out and back in for changes to take effect"
      else
        log_error "Failed to change default shell. You may need to contact your system administrator."
        log_info "You can manually run Fish by typing 'fish' in your terminal"
      fi
    else
      log_info "DRY RUN: Would change default shell to $fish_path"
    fi
  fi
}

# --- Main Logic ---

print_header() {
  echo -e "${COLOR_BLUE}=================================${COLOR_NC}"
  echo -e "${COLOR_BLUE}  Fish Shell Dotfiles Installer  ${COLOR_NC}"
  echo -e "${COLOR_BLUE}  Version: $SCRIPT_VERSION        ${COLOR_NC}"
  echo -e "${COLOR_BLUE}=================================${COLOR_NC}"
  echo ""
}

print_summary() {
  echo ""
  echo -e "${COLOR_GREEN}=================================${COLOR_NC}"
  echo -e "${COLOR_GREEN}  Installation Summary           ${COLOR_NC}"
  echo -e "${COLOR_GREEN}=================================${COLOR_NC}"
  echo -e "Dotfiles root: ${DOTFILES_ROOT}"
  echo -e "Fish config source: ${FISH_CONFIG_SOURCE}"
  echo -e "Fish config target: ${FISH_CONFIG_TARGET}"
  echo -e "Current shell: $(basename "$SHELL")"
  echo -e "Fish path: $(command -v fish 2>/dev/null || echo 'Not found')"
  echo ""
}

main() {
  # Parse arguments
  while [[ $# -gt 0 ]]; do
    case $1 in
    --dry | --dry-run)
      INITIALIZE_DRY_RUN=true
      shift
      ;;
    --help | -h)
      echo "Usage: $0 [--dry-run] [--help]"
      echo "  --dry-run: Show what would be done without making changes"
      echo "  --help:    Show this help message"
      exit 0
      ;;
    *)
      log_error "Unknown option: $1"
      exit 1
      ;;
    esac
  done

  print_header

  if [ "$INITIALIZE_DRY_RUN" = true ]; then
    log_warn "=== DRY RUN MODE ACTIVATED ==="
    log_warn "No changes will be made to your system"
    echo ""
  fi

  # Environment checks
  log_info "Performing environment checks..."
  if ! check_environment; then
    log_error "Environment check failed. Please resolve issues before continuing."
    exit 1
  fi
  log_success "Environment checks passed"
  echo ""

  # Check if fish-config source exists
  if [ ! -d "$FISH_CONFIG_SOURCE" ]; then
    log_error "Fish config source directory not found: $FISH_CONFIG_SOURCE"
    log_error "Please ensure you have a 'fish-config' directory in your dotfiles root."
    exit 1
  fi

  # Install Fish if needed
  if ! command -v fish &>/dev/null; then
    log_info "Fish shell not found. Installing..."
    if ! install_fish; then
      log_error "Fish installation failed"
      exit 1
    fi
    log_success "Fish shell installed successfully"
  else
    log_success "Fish shell is already installed"
    log_info "Fish version: $(fish --version 2>/dev/null || echo 'unknown')"
  fi
  echo ""

  # Handle existing config and create symlink
  log_info "Setting up Fish configuration..."

  # Backup existing config if needed
  if [ -e "$FISH_CONFIG_TARGET" ]; then
    if [ -L "$FISH_CONFIG_TARGET" ]; then
      local link_target=$(readlink "$FISH_CONFIG_TARGET")
      if [ "$link_target" = "$FISH_CONFIG_SOURCE" ] || [ "$link_target" = "$(realpath "$FISH_CONFIG_SOURCE" 2>/dev/null)" ]; then
        log_success "Correct symlink already exists"
        echo ""
      else
        log_warn "Different symlink exists, will be replaced"
        create_fish_symlink
      fi
    else
      local timestamp=$(date +%Y%m%d_%H%M%S)
      local backup_path="${FISH_CONFIG_TARGET}_backup_${timestamp}"
      log_warn "Existing Fish config found, backing up to: $backup_path"
      run_command "mv $FISH_CONFIG_TARGET $backup_path"
      create_fish_symlink
    fi
  else
    create_fish_symlink
  fi
  echo ""

  # Setup default shell
  log_info "Setting up Fish as default shell..."
  setup_default_shell
  echo ""

  print_summary
  log_success "Fish shell dotfiles installation completed!"

  if [ "$INITIALIZE_DRY_RUN" = false ]; then
    log_info "Next steps:"
    log_info "1. Restart your terminal or run 'exec fish' to start using Fish"
    log_info "2. If you changed your default shell, log out and back in"
    log_info "3. Run 'fish --version' to verify the installation"
  else
    log_info "This was a dry run. Run without --dry-run to apply changes."
  fi
}

# Run main function
main "$@"
