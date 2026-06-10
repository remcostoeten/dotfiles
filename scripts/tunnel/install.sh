#!/usr/bin/env bash
set -euo pipefail

REPO="${REPO:-remcostoeten/dotfiles}"
BRANCH="${BRANCH:-master}"
BIN_NAME="${BIN_NAME:-tunnel}"
INSTALL_DIR="${INSTALL_DIR:-$HOME/.local/bin}"
BASE_URL="https://raw.githubusercontent.com/$REPO/$BRANCH/scripts/tunnel"
MARKER="# Added by tunnel installer"

GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

usage() {
  cat <<EOF
Install tunnel without cloning the dotfiles repo.

Usage:
  curl -fsSL $BASE_URL/install.sh | bash
  ./install.sh
  ./install.sh --uninstall

Environment:
  INSTALL_DIR   Install location (default: ~/.local/bin)
  BRANCH        Git branch to download from (default: master)
  REPO          GitHub repo (default: remcostoeten/dotfiles)
  TUNNEL_YES    Force-write shell config without prompting
  TUNNEL_NO     Skip writing shell config (even for curl | bash)
EOF
}

detect_shell_name() {
  basename "${SHELL:-bash}"
}

detect_shell_config() {
  local shell_name
  shell_name=$(detect_shell_name)

  case "$shell_name" in
    zsh)
      echo "${ZDOTDIR:-$HOME}/.zshrc"
      ;;
    fish)
      echo "${XDG_CONFIG_HOME:-$HOME/.config}/fish/config.fish"
      ;;
    bash)
      if [[ "$(uname -s)" == "Darwin" ]]; then
        if [[ -f "$HOME/.bash_profile" ]]; then
          echo "$HOME/.bash_profile"
        elif [[ -f "$HOME/.bashrc" ]]; then
          echo "$HOME/.bashrc"
        else
          echo "$HOME/.bash_profile"
        fi
      elif [[ -f "$HOME/.bashrc" ]]; then
        echo "$HOME/.bashrc"
      else
        echo "$HOME/.profile"
      fi
      ;;
    *)
      if [[ -f "$HOME/.profile" ]]; then
        echo "$HOME/.profile"
      else
        echo "$HOME/.bashrc"
      fi
      ;;
  esac
}

path_contains() {
  case ":$PATH:" in
    *":$1:"*) return 0 ;;
    *) return 1 ;;
  esac
}

config_has_path() {
  local config="$1"
  [[ -f "$config" ]] && grep -qF "$INSTALL_DIR" "$config"
}

config_has_marker() {
  local config="$1"
  [[ -f "$config" ]] && grep -qF "$MARKER" "$config"
}

path_line_for_shell() {
  case "$(detect_shell_name)" in
    fish)
      printf 'fish_add_path %s' "$INSTALL_DIR"
      ;;
    *)
      printf 'export PATH="%s:$PATH"' "$INSTALL_DIR"
      ;;
  esac
}

is_interactive() {
  [[ -t 0 ]]
}

prompt_yes() {
  local prompt="$1"
  local default_non_interactive="${2:-1}"

  [[ "${TUNNEL_NO:-}" == "1" ]] && return 1
  [[ "${TUNNEL_YES:-}" == "1" ]] && return 0

  # curl | bash has no TTY — default to yes for install, no for uninstall
  if ! is_interactive; then
    [[ "$default_non_interactive" == "1" ]]
    return
  fi

  local answer=""
  read -r -p "$prompt" answer
  case "${answer:-Y}" in
    y|Y|yes|Yes|YES|"") return 0 ;;
    *) return 1 ;;
  esac
}

write_path_to_config() {
  local config="$1"
  mkdir -p "$(dirname "$config")"
  touch "$config"

  if config_has_path "$config"; then
    echo -e "${GREEN}✓${NC} $INSTALL_DIR already in ${CYAN}$config${NC}"
    return 0
  fi

  {
    echo ""
    echo "$MARKER"
    path_line_for_shell
  } >> "$config"

  echo -e "${GREEN}✓ Updated${NC} $config"
  echo -e "  Added: ${CYAN}$(path_line_for_shell)${NC}"
}

ensure_path_in_shell() {
  local config
  config=$(detect_shell_config)

  if config_has_path "$config"; then
    if path_contains "$INSTALL_DIR"; then
      echo -e "${GREEN}✓${NC} $INSTALL_DIR is in PATH"
    else
      echo -e "${YELLOW}⚠${NC} $INSTALL_DIR is in ${CYAN}$config${NC} but not loaded in this shell."
      echo -e "  Run: ${CYAN}source $config${NC}  or open a new terminal"
    fi
    return 0
  fi

  echo ""
  if path_contains "$INSTALL_DIR"; then
    echo -e "${YELLOW}⚠${NC} ${CYAN}$INSTALL_DIR${NC} works in this shell but is not saved to your config."
  else
    echo -e "${YELLOW}⚠${NC} ${CYAN}$INSTALL_DIR${NC} is not in your PATH."
  fi

  echo -e "  Shell:  ${CYAN}$(detect_shell_name)${NC}"
  echo -e "  Config: ${CYAN}$config${NC}"
  echo -e "  Line:   ${CYAN}$(path_line_for_shell)${NC}"
  echo ""

  if ! is_interactive; then
    echo -e "${CYAN}⟳ Non-interactive install — updating shell config...${NC}"
  fi

  if prompt_yes "Add this to $config? [Y/n] " 1; then
    write_path_to_config "$config"
    echo ""
    if is_interactive; then
      echo -e "  Run: ${CYAN}source $config${NC}  or open a new terminal"
    else
      echo -e "  Open a new terminal, or run: ${CYAN}source $config${NC}"
    fi
  else
    echo -e "${YELLOW}Skipped.${NC} Add manually when ready:"
    echo -e "  ${CYAN}$(path_line_for_shell)${NC}"
  fi
}

print_next_steps() {
  local config
  config=$(detect_shell_config)

  echo ""
  echo -e "${GREEN}Done!${NC} Use it from any git project with a dev server running:"
  echo ""
  echo -e "  ${CYAN}$BIN_NAME${NC}           auto-detect port"
  echo -e "  ${CYAN}$BIN_NAME 3000${NC}      expose port 3000"
  echo ""

  if command -v "$BIN_NAME" &>/dev/null; then
    echo -e "  ${GREEN}✓${NC} Ready in this terminal — run ${CYAN}$BIN_NAME${NC} now."
  elif path_contains "$INSTALL_DIR"; then
    echo -e "  ${GREEN}✓${NC} Ready in this terminal — run ${CYAN}$BIN_NAME${NC} now."
  elif config_has_path "$config"; then
    echo -e "  Run ${CYAN}source $config${NC} or open a new terminal first."
  else
    echo -e "  Add the PATH line above, then open a new terminal."
  fi

  echo ""
  echo -e "  ${BOLD}Controls while running:${NC}"
  echo -e "    ${BOLD}q${NC}  quit"
  echo -e "    ${BOLD}r${NC}  restart tunnel (new URL)"
  echo -e "    ${BOLD}c${NC}  copy URL to clipboard"
  echo -e "    ${BOLD}o${NC}  open URL in browser"
}

local_tunnel() {
  local dir=""
  if [[ -n "${BASH_SOURCE[0]:-}" && "${BASH_SOURCE[0]}" != "-" ]]; then
    dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    if [[ -f "$dir/tunnel" ]]; then
      echo "$dir/tunnel"
      return 0
    fi
  fi
  return 1
}

install_tunnel() {
  local dest="$INSTALL_DIR/$BIN_NAME"
  local source=""

  mkdir -p "$INSTALL_DIR"
  INSTALL_DIR="$(cd "$INSTALL_DIR" && pwd)"

  if source=$(local_tunnel); then
    echo -e "${CYAN}Installing from local checkout...${NC}"
    cp "$source" "$dest"
  else
    if ! command -v curl &>/dev/null; then
      echo -e "${RED}✗ curl is required to download tunnel${NC}" >&2
      exit 1
    fi
    echo -e "${CYAN}Downloading tunnel from GitHub...${NC}"
    curl -fsSL "$BASE_URL/tunnel" -o "$dest"
  fi

  chmod +x "$dest"

  echo -e "${GREEN}✓ Installed${NC} $dest"
  ensure_path_in_shell
  print_next_steps
}

uninstall_tunnel() {
  local dest="$INSTALL_DIR/$BIN_NAME"
  if [[ -f "$dest" ]]; then
    rm -f "$dest"
    echo -e "${GREEN}✓ Removed${NC} $dest"
  else
    echo -e "${YELLOW}⚠${NC} Not installed at $dest"
  fi

  local config
  config=$(detect_shell_config)
  if [[ -f "$config" ]] && config_has_marker "$config"; then
    echo ""
    if prompt_yes "Remove tunnel PATH entry from $config? [y/N] " 0; then
      local tmp
      tmp=$(mktemp "${TMPDIR:-/tmp}/tunnel-config.XXXXXX")
      awk -v marker="$MARKER" '
        $0 == marker { skip=2; next }
        skip > 0 { skip--; next }
        { print }
      ' "$config" > "$tmp"
      mv "$tmp" "$config"
      echo -e "${GREEN}✓ Cleaned${NC} $config"
    fi
  fi
}

case "${1:-}" in
  -h|--help)
    usage
    ;;
  --uninstall)
    uninstall_tunnel
    ;;
  "")
    install_tunnel
    ;;
  *)
    echo -e "${RED}✗ Unknown option:${NC} $1" >&2
    usage >&2
    exit 1
    ;;
esac
