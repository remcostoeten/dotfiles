#!/usr/bin/env bash
set -euo pipefail
source "${HOME}/.config/dotfiles/core/_env"
source "${HOME}/.config/dotfiles/core/_colors"
source "${HOME}/.config/dotfiles/core/_safety"
function usage() {
  echo.header "Dotfiles Visualization"
  echo
  echo.info "Usage: dotfiles visualize [secrets|init|all] [--format svg|png] [--open]"
  echo
  echo.info "Examples:"
  echo "  dotfiles visualize secrets"
  echo "  dotfiles visualize init --format png"
  echo "  dotfiles visualize all --open"
}
function ensure_mmdc() {
  if command -v mmdc >/dev/null 2>&1; then
    return 0
  fi
  echo.warning "Mermaid CLI (mmdc) not found"
  echo.info "Install via additional packages in init.sh or manually: npm i -g @mermaid-js/mermaid-cli"
  return 1
}
function render_one() {
  local name="$1"
  local fmt="$2"
  local input="$DOTFILES_ROOT/assets/${name}.mmd"
  local output="$DOTFILES_ROOT/assets/${name}.${fmt}"
  if [[ ! -f "$input" ]]; then
    echo.error "Missing diagram: $input"
    return 1
  fi
  echo.info "Rendering ${name}.${fmt}"
  mmdc -i "$input" -o "$output"
  echo.success "Created $output"
  RENDERED_FILES+=("$output")
}
function main() {
  local target="secrets"
  local fmt="svg"
  local open_after=0
  while [[ $# -gt 0 ]]; do
    case "$1" in
      secrets|init|all)
        target="$1"; shift ;;
      --format)
        fmt="${2:-svg}"; shift 2 ;;
      --open)
        open_after=1; shift ;;
      -h|--help|help)
        usage; return 0 ;;
      *)
        echo.error "Unknown argument: $1"; usage; return 1 ;;
    esac
  done
  ensure_mmdc || return 1
  RENDERED_FILES=()
  case "$target" in
    secrets)
      render_one "secrets-sync" "$fmt" ;;
    init)
      render_one "init-flow" "$fmt" ;;
    all)
      render_one "init-flow" "$fmt"
      render_one "secrets-sync" "$fmt" ;;
  esac
  if [[ $open_after -eq 1 ]]; then
    for f in "${RENDERED_FILES[@]}"; do
      if command -v xdg-open >/dev/null 2>&1; then xdg-open "$f" >/dev/null 2>&1 || true; fi
      if [[ "$(uname -s)" == "Darwin" ]] && command -v open >/dev/null 2>&1; then open "$f" >/dev/null 2>&1 || true; fi
    done
  fi
}
main "$@"
