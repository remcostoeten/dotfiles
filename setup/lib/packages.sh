#!/bin/bash
set -euo pipefail

detect_os_family() {
    if [[ -r /etc/os-release ]]; then
        # shellcheck disable=SC1091
        source /etc/os-release
        case "${ID:-}" in
            arch|manjaro|endeavouros|cachyos|artix)
                echo "arch"
                ;;
            ubuntu|debian|linuxmint|pop|zorin|elementary)
                echo "debian"
                ;;
            *)
                echo "${ID_LIKE:-unknown}"
                ;;
        esac
    else
        echo "unknown"
    fi
}

init_packages() {
    VERBOSE=false
}

get_method() {
    local pkg="$1"
    local os_family
    os_family="$(detect_os_family)"
    case "$pkg" in
        git|curl|wget|build-essential|ca-certificates|gnupg|software-properties-common|fish|python3|python3-pip|python3-venv|nodejs|npm|neovim|vim|ripgrep|fd-find|fzf|zoxide|eza|bat|htop|tree|jq|gh|docker.io|docker-compose|fastfetch|btop|vlc)
            if [[ "$os_family" == "arch" ]]; then
                echo "pacman"
            else
                echo "apt"
            fi
            ;;
        starship|fnm|rustup|uv|pnpm|bun)
            echo "curl" ;;
        vercel|gemini|codex)
            echo "npm" ;;
        lazygit|lazydocker)
            echo "github" ;;
        ghostty)
            echo "snap" ;;
        zed|vscode|opencode)
            echo "script" ;;
        *)
            echo ""
            ;;
    esac
}

get_extra() {
    local pkg="$1"
    case "$pkg" in
        pnpm) echo "https://get.pnpm.io/install.sh" ;;
        bun) echo "https://bun.sh/install" ;;
        rustup) echo "https://sh.rustup.rs" ;;
        fnm) echo "https://fnm.vercel.app/install" ;;
        uv) echo "https://astral.sh/uv/install.sh" ;;
        starship) echo "https://starship.rs/install.sh" ;;
        lazygit) echo "jesseduffield/lazygit" ;;
        lazydocker) echo "jesseduffield/lazydocker" ;;
        *) echo "" ;;
    esac
}

get_shell() {
    local pkg="$1"
    case "$pkg" in
        bun|rustup|fnm)
            echo "bash" ;;
        starship|uv|pnpm)
            echo "sh" ;;
        *)
            echo "sh" ;;
    esac
}

get_flags() {
    local pkg="$1"
    case "$pkg" in
        ghostty) echo "--classic" ;;
        spotify) echo "--classic" ;;
        *) echo "" ;;
    esac
}
