#!/bin/bash
set -euo pipefail

APP_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$APP_ROOT"

DRY_RUN=false
NO_BUILD=false
UNINSTALL=false

BIN_SRC="src-tauri/target/release/keybind-manager"
HELPER_SRC="src-tauri/target/release/keybind-manager-helper"
POLICY_SRC="polkit/org.remcostoeten.keybind-manager.policy"
DESKTOP_SRC="packaging/keybind-manager.desktop"
ICON_512_SRC="src-tauri/icons/icon.png"
ICON_128_SRC="src-tauri/icons/128x128.png"

BIN_DST="/usr/bin/keybind-manager"
HELPER_DST="/usr/bin/keybind-manager-helper"
POLICY_DST="/usr/share/polkit-1/actions/org.remcostoeten.keybind-manager.policy"
DESKTOP_DST="/usr/share/applications/keybind-manager.desktop"
ICON_512_DST="/usr/share/icons/hicolor/512x512/apps/keybind-manager.png"
ICON_128_DST="/usr/share/icons/hicolor/128x128/apps/keybind-manager.png"

log_info() { printf '\033[1;34m==>\033[0m %s\n' "$1"; }
log_ok() { printf '\033[1;32m OK \033[0m %s\n' "$1"; }
log_warn() { printf '\033[1;33mWARN\033[0m %s\n' "$1" >&2; }
log_err() { printf '\033[1;31mFAIL\033[0m %s\n' "$1" >&2; }

usage() {
    cat <<'EOF'
Usage: scripts/install.sh [--uninstall] [--no-build] [--dry-run]

  --uninstall   Remove the installed app, helper, polkit policy and desktop
                entry. Never touches /etc/keyd/keybind-manager-*.conf.
  --no-build    Skip building; use existing binaries under
                src-tauri/target/release.
  --dry-run     Print the actions that would be taken without doing them.
EOF
}

while [[ $# -gt 0 ]]; do
    case "$1" in
        --uninstall) UNINSTALL=true; shift ;;
        --no-build) NO_BUILD=true; shift ;;
        --dry-run) DRY_RUN=true; shift ;;
        -h|--help) usage; exit 0 ;;
        *) log_err "Unknown option: $1"; usage; exit 1 ;;
    esac
done

run() {
    if [[ "$DRY_RUN" == "true" ]]; then
        printf '\033[1;36mDRY\033[0m  %s\n' "$*"
    else
        "$@"
    fi
}

detect_os_family() {
    if [[ -r /etc/os-release ]]; then
        # shellcheck disable=SC1091
        source /etc/os-release
        case "${ID:-}" in
            arch|manjaro|endeavouros|cachyos|artix) echo "arch" ;;
            ubuntu|debian|linuxmint|pop|zorin|elementary) echo "debian" ;;
            *)
                case "${ID_LIKE:-}" in
                    *arch*) echo "arch" ;;
                    *debian*) echo "debian" ;;
                    *) echo "unknown" ;;
                esac
                ;;
        esac
    else
        echo "unknown"
    fi
}

ensure_keyd() {
    if command -v keyd >/dev/null 2>&1; then
        log_ok "keyd already installed"
        return 0
    fi

    local os_family
    os_family="$(detect_os_family)"
    log_info "keyd not found, installing via ${os_family}"

    case "$os_family" in
        arch)
            run sudo pacman -S --needed --noconfirm keyd
            ;;
        debian)
            if run sudo apt-get install -y keyd; then
                :
            else
                log_warn "keyd is not available via apt on this release."
                log_warn "Build it from source:"
                log_warn "  sudo apt install git build-essential"
                log_warn "  git clone https://github.com/rvaiya/keyd"
                log_warn "  cd keyd && make && sudo make install"
                return 1
            fi
            ;;
        *)
            log_warn "Unsupported distribution for automatic keyd install; install keyd manually."
            return 1
            ;;
    esac
}

build_app() {
    if [[ "$NO_BUILD" == "true" ]]; then
        log_info "Skipping build (--no-build)"
        return 0
    fi
    log_info "Building app and helper..."
    run ./scripts/build.sh
}

require_binaries() {
    if [[ "$DRY_RUN" == "true" ]]; then
        return 0
    fi
    if [[ ! -f "$BIN_SRC" ]]; then
        log_err "Missing $BIN_SRC (run without --no-build, or build first)"
        exit 1
    fi
    if [[ ! -f "$HELPER_SRC" ]]; then
        log_err "Missing $HELPER_SRC (run without --no-build, or build first)"
        exit 1
    fi
}

install_files() {
    require_binaries

    log_info "Installing keybind-manager to $BIN_DST"
    run sudo install -Dm755 "$BIN_SRC" "$BIN_DST"

    log_info "Installing helper to $HELPER_DST (root:root, 0755)"
    run sudo install -Dm755 -o root -g root "$HELPER_SRC" "$HELPER_DST"

    log_info "Installing polkit policy to $POLICY_DST"
    run sudo install -Dm644 "$POLICY_SRC" "$POLICY_DST"

    log_info "Installing desktop entry to $DESKTOP_DST"
    run sudo install -Dm644 "$DESKTOP_SRC" "$DESKTOP_DST"

    if [[ -f "$ICON_512_SRC" ]]; then
        log_info "Installing 512x512 icon"
        run sudo install -Dm644 "$ICON_512_SRC" "$ICON_512_DST"
    fi
    if [[ -f "$ICON_128_SRC" ]]; then
        log_info "Installing 128x128 icon"
        run sudo install -Dm644 "$ICON_128_SRC" "$ICON_128_DST"
    fi

    log_ok "Files installed"
}

enable_keyd_service() {
    if ! command -v keyd >/dev/null 2>&1; then
        log_warn "keyd not installed; skipping service enable"
        return 0
    fi
    log_info "Enabling keyd service"
    run sudo systemctl enable --now keyd
}

do_install() {
    ensure_keyd || log_warn "Continuing install without keyd; see message above"
    build_app
    install_files
    enable_keyd_service
    log_ok "keybind-manager installed"
}

do_uninstall() {
    log_info "Removing installed files (keyd config under /etc/keyd is left untouched)"
    for f in "$BIN_DST" "$HELPER_DST" "$POLICY_DST" "$DESKTOP_DST" "$ICON_512_DST" "$ICON_128_DST"; do
        if [[ -e "$f" ]]; then
            run sudo rm -f "$f"
        fi
    done
    log_ok "keybind-manager uninstalled"
}

if [[ "$UNINSTALL" == "true" ]]; then
    do_uninstall
else
    do_install
fi
