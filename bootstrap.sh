#!/usr/bin/env bash
# DOCSTRING: Bootstrap script for initial machine setup - clones repos, sets up SSH, installs essentials
#
# PREREQUISITES:
# - Internet connection
# - GitHub authentication (for private env-private repository):
#   * Option 1: GitHub CLI (gh) - run 'gh auth login' first
#   * Option 2: Personal Access Token - will be prompted during clone
#   * Option 3: SSH keys already in place (if using SSH URLs)
#
# The main dotfiles repository is public and requires no authentication.

set -e  # Exit on error, but we handle some errors gracefully with || true

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m' # No Color

DOTFILES_REPO="https://github.com/remcostoeten/dotfiles.git"
DOTFILES_DIR="$HOME/.config/dotfiles"
ENV_PRIVATE_DIR="$DOTFILES_DIR/env-private"
SSH_HOME_DIR="$HOME/.ssh"
SSH_STORAGE_DIR="$ENV_PRIVATE_DIR/.ssh"

function print_header() {
  echo -e "${CYAN}${BOLD}"
  echo "╔══════════════════════════════════════════════════════════════╗"
  echo "║                                                              ║"
  echo "║    🚀 Dotfiles Bootstrap Setup                              ║"
  echo "║                                                              ║"
  echo "║    Initial machine setup for dotfiles                       ║"
  echo "║                                                              ║"
  echo "╚══════════════════════════════════════════════════════════════╝"
  echo -e "${NC}"
}

function check_prerequisites() {
  print_step "Checking prerequisites..."
  
  # Check internet connection
  if ! ping -c 1 -W 2 github.com >/dev/null 2>&1; then
    print_error "No internet connection or GitHub is unreachable"
    echo -e "${DIM}  Please check your internet connection and try again.${NC}"
    exit 1
  fi
  print_success "Internet connection available"
  
  # Check GitHub authentication (for private repos)
  print_step "Checking GitHub authentication..."
  
  # Check if GitHub CLI is installed and authenticated
  if check_command gh; then
    if gh auth status >/dev/null 2>&1; then
      print_success "GitHub CLI (gh) is authenticated"
      return 0
    else
      print_warning "GitHub CLI (gh) is installed but not authenticated"
      echo -e "${YELLOW}  You may need to run: ${BOLD}gh auth login${NC}"
    fi
  else
    print_warning "GitHub CLI (gh) is not installed"
  fi
  
  # Check if we have SSH keys that might work with GitHub
  if [ -d "$SSH_HOME_DIR" ] && [ "$(ls -A $SSH_HOME_DIR/*.pub 2>/dev/null)" ]; then
    print_warning "SSH keys found, but env-private uses HTTPS (may need PAT)"
  fi
  
  echo -e "${DIM}  Note: You may be prompted for GitHub credentials when cloning env-private${NC}"
  echo -e "${DIM}  If you have a Personal Access Token, you can use it when prompted${NC}"
  echo ""
  read -p "Continue anyway? (Y/n): " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Nn]$ ]]; then
    echo -e "${YELLOW}Setup cancelled. Please authenticate with GitHub first.${NC}"
    echo -e "${DIM}  Options:${NC}"
    echo -e "${DIM}    1. Install and authenticate GitHub CLI: gh auth login${NC}"
    echo -e "${DIM}    2. Create a Personal Access Token at: https://github.com/settings/tokens${NC}"
    exit 0
  fi
}

function print_step() {
  echo -e "\n${CYAN}▶${NC} ${BOLD}$1${NC}"
}

function print_success() {
  echo -e "  ${GREEN}✓${NC} $1"
}

function print_warning() {
  echo -e "  ${YELLOW}⚠${NC} $1"
}

function print_error() {
  echo -e "  ${RED}✗${NC} $1"
}

function check_command() {
  command -v "$1" >/dev/null 2>&1
}

function install_git() {
  print_step "Installing Git..."
  
  if check_command git; then
    print_success "Git is already installed"
    return 0
  fi

  if check_command apt-get; then
    sudo apt-get update -qq
    sudo apt-get install -y git
    print_success "Git installed via apt"
  elif check_command yum; then
    sudo yum install -y git
    print_success "Git installed via yum"
  elif check_command brew; then
    brew install git
    print_success "Git installed via brew"
  else
    print_error "Could not install Git automatically. Please install Git manually."
    return 1
  fi
}

function clone_dotfiles() {
  print_step "Cloning dotfiles repository..."
  
  if [ -d "$DOTFILES_DIR" ]; then
    print_warning "Dotfiles directory already exists at $DOTFILES_DIR"
    read -p "  Do you want to update it? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
      cd "$DOTFILES_DIR"
      git pull
      print_success "Dotfiles repository updated"
    else
      print_success "Using existing dotfiles directory"
    fi
  else
    mkdir -p "$(dirname "$DOTFILES_DIR")"
    git clone "$DOTFILES_REPO" "$DOTFILES_DIR"
    print_success "Dotfiles repository cloned to $DOTFILES_DIR"
  fi
}

function init_submodules() {
  print_step "Initializing git submodules..."
  
  cd "$DOTFILES_DIR"
  
  # Try to use GitHub CLI for authentication if available
  if check_command gh && gh auth status >/dev/null 2>&1; then
    print_success "Using GitHub CLI for authentication"
    # GitHub CLI will handle auth automatically
  fi
  
  # Initialize submodules
  # This will prompt for credentials if needed (PAT for HTTPS)
  if git submodule update --init --recursive 2>/dev/null; then
    print_success "Git submodules initialized"
  else
    print_warning "Failed to initialize some submodules"
    
    # Check if it's an authentication issue
    if git submodule update --init env-private 2>&1 | grep -qi "authentication\|permission\|401\|403"; then
      print_error "Authentication failed for env-private repository"
      echo ""
      echo -e "${YELLOW}To fix this, you have a few options:${NC}"
      echo -e "${DIM}  1. Install and authenticate GitHub CLI:${NC}"
      echo -e "${DIM}     curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg${NC}"
      echo -e "${DIM}     echo 'deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main' | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null${NC}"
      echo -e "${DIM}     sudo apt update && sudo apt install gh -y${NC}"
      echo -e "${DIM}     gh auth login${NC}"
      echo ""
      echo -e "${DIM}  2. Use a Personal Access Token:${NC}"
      echo -e "${DIM}     Create one at: https://github.com/settings/tokens${NC}"
      echo -e "${DIM}     Use it as password when prompted (username is your GitHub username)${NC}"
      echo ""
      echo -e "${DIM}  3. Skip for now and clone manually later${NC}"
      echo ""
      
      read -p "Would you like to try cloning env-private manually with a different method? (y/N): " -n 1 -r
      echo
      if [[ $REPLY =~ ^[Yy]$ ]]; then
        read -p "  Enter env-private repository URL (HTTPS or SSH): " env_repo_url
        if [ -n "$env_repo_url" ]; then
          if git clone "$env_repo_url" "$ENV_PRIVATE_DIR" 2>/dev/null; then
            print_success "env-private cloned manually"
          else
            print_error "Failed to clone env-private. You can do this later."
            print_warning "You can continue without env-private, but SSH keys won't be restored automatically"
          fi
        fi
      fi
    else
      print_warning "Submodule initialization failed for unknown reason"
      print_warning "You may need to manually clone env-private if it's a private repository"
    fi
  fi
}

function restore_ssh_keys() {
  print_step "Restoring SSH keys from env-private..."
  
  if [ ! -d "$ENV_PRIVATE_DIR" ]; then
    print_warning "env-private directory not found. Skipping SSH key restoration."
    print_warning "SSH keys will be restored after env-private is available."
    return 0
  fi
  
  if [ ! -d "$SSH_STORAGE_DIR" ]; then
    print_warning "No SSH keys found in env-private/.ssh. Skipping SSH key restoration."
    return 0
  fi
  
  # Create ~/.ssh if it doesn't exist
  if [ ! -d "$SSH_HOME_DIR" ]; then
    mkdir -p "$SSH_HOME_DIR"
    chmod 700 "$SSH_HOME_DIR"
    print_success "Created ~/.ssh directory"
  fi
  
  # Copy SSH keys (only if they don't already exist)
  keys_restored=0
  # Check if directory has files before looping (handles empty directory case)
  if [ "$(ls -A "$SSH_STORAGE_DIR" 2>/dev/null)" ]; then
    for file in "$SSH_STORAGE_DIR"/*; do
      # Skip if glob didn't match any files
      [ ! -f "$file" ] && continue
      
      filename=$(basename "$file")
      target="$SSH_HOME_DIR/$filename"
      
      if [ -f "$target" ]; then
        continue  # Skip if already exists
      fi
      
      cp "$file" "$target"
      
      # Set secure permissions
      if [[ "$filename" =~ (_rsa|_ed25519|_ecdsa|_dsa)$ ]]; then
        chmod 600 "$target"
      else
        chmod 644 "$target"
      fi
      
      keys_restored=$((keys_restored + 1))
    done
  fi
  
  # Ensure .ssh directory has correct permissions
  chmod 700 "$SSH_HOME_DIR"
  
  if [ $keys_restored -gt 0 ]; then
    print_success "Restored $keys_restored SSH key file(s)"
  else
    print_success "No new SSH keys to restore (all keys already exist)"
  fi
}

function install_essentials() {
  print_step "Installing essential tools..."
  
  # Install bun if not present
  if ! check_command bun; then
    echo -e "${DIM}  Installing Bun...${NC}"
    if curl -fsSL https://bun.sh/install | bash; then
      print_success "Bun installed"
      # Source bun if it was just installed - add to PATH for this session
      if [ -f "$HOME/.bun/_bun" ]; then
        export BUN_INSTALL="$HOME/.bun"
        export PATH="$BUN_INSTALL/bin:$PATH"
        # Also add to shell profile for persistence (if not already there)
        if [ -f "$HOME/.bashrc" ] && ! grep -q "BUN_INSTALL" "$HOME/.bashrc"; then
          echo "" >> "$HOME/.bashrc"
          echo "# Bun" >> "$HOME/.bashrc"
          echo 'export BUN_INSTALL="$HOME/.bun"' >> "$HOME/.bashrc"
          echo 'export PATH="$BUN_INSTALL/bin:$PATH"' >> "$HOME/.bashrc"
        fi
      fi
    else
      print_warning "Failed to install Bun. You may need to install it manually."
      print_warning "Visit: https://bun.sh/docs/installation"
    fi
  else
    print_success "Bun is already installed"
  fi
  
  # Install setup dependencies
  if [ -d "$DOTFILES_DIR/setup" ]; then
    cd "$DOTFILES_DIR/setup"
    if check_command bun; then
      echo -e "${DIM}  Installing setup dependencies...${NC}"
      bun install --silent && print_success "Setup dependencies installed" || print_warning "Failed to install some dependencies"
    fi
  fi
}

function make_scripts_executable() {
  print_step "Making scripts executable..."
  
  if [ -d "$DOTFILES_DIR/bin" ]; then
    find "$DOTFILES_DIR/bin" -type f -exec chmod +x {} \; 2>/dev/null || true
    print_success "Made bin scripts executable"
  fi
  
  if [ -d "$DOTFILES_DIR/scripts" ]; then
    find "$DOTFILES_DIR/scripts" -type f \( -name "*.sh" -o -name "*.ts" -o -name "*.py" -o -name "*.fish" -o -name "*.js" \) -exec chmod +x {} \; 2>/dev/null || true
    print_success "Made script files executable"
  fi
}

function prompt_main_setup() {
  echo -e "\n${GREEN}${BOLD}✅ Bootstrap setup complete!${NC}\n"
  
  echo -e "${CYAN}Next steps:${NC}"
  echo -e "  1. The dotfiles repository is now at: ${BOLD}$DOTFILES_DIR${NC}"
  echo -e "  2. SSH keys have been restored (if available)"
  echo -e "  3. Essential tools have been installed"
  echo ""
  
  read -p "Would you like to run the main setup script now? (Y/n): " -n 1 -r
  echo
  
  if [[ ! $REPLY =~ ^[Nn]$ ]]; then
    echo ""
    print_step "Running main setup script..."
    cd "$DOTFILES_DIR/setup"
    
    if check_command bun && [ -f "package.json" ]; then
      bun run setup
    else
      echo -e "${YELLOW}  Bun or setup script not found.${NC}"
      echo -e "${DIM}  You can run the setup manually with:${NC}"
      echo -e "${DIM}    cd $DOTFILES_DIR/setup && bun install && bun run setup${NC}"
    fi
  else
    echo -e "\n${DIM}You can run the setup script later with:${NC}"
    echo -e "${DIM}  cd $DOTFILES_DIR/setup && bun run setup${NC}"
  fi
}

function main() {
  print_header
  
  # Check if running as root
  if [ "$EUID" -eq 0 ]; then
    print_error "Please do not run this script as root"
    exit 1
  fi
  
  # Step 0: Check prerequisites
  check_prerequisites
  
  # Step 1: Install Git
  install_git || exit 1
  
  # Step 2: Clone dotfiles repository
  clone_dotfiles || exit 1
  
  # Step 3: Initialize git submodules (may fail if env-private needs auth)
  init_submodules || true  # Don't exit if this fails - we'll retry later
  
  # Step 4: Restore SSH keys (if env-private is available)
  restore_ssh_keys || true  # Don't exit if this fails - it's optional
  
  # Step 4.5: Retry submodule init if env-private is still missing
  # Note: This won't help if .gitmodules uses HTTPS (which it does), but we try anyway
  # in case the user manually changed the URL or has credential helper configured
  if [ ! -d "$ENV_PRIVATE_DIR" ]; then
    print_step "Retrying env-private submodule initialization..."
    cd "$DOTFILES_DIR"
    # Try again - might work if user entered credentials or has credential helper
    if git submodule update --init env-private 2>/dev/null; then
      print_success "env-private submodule initialized"
      # Now restore SSH keys if they're in the newly cloned env-private
      restore_ssh_keys
    else
      print_warning "env-private still not available. You can clone it manually later."
    fi
  fi
  
  # Step 5: Install essential tools
  install_essentials
  
  # Step 6: Make scripts executable
  make_scripts_executable
  
  # Step 7: Prompt to run main setup
  prompt_main_setup
}

# Run main function
main

