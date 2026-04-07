#!/bin/bash
set -euo pipefail

init_packages() {
    VERBOSE=false
}

get_method() {
    local pkg="$1"
    case "$pkg" in
        git|curl|wget|build-essential|ca-certificates|gnupg|software-properties-common|fish|python3|python3-pip|python3-venv|nodejs|neovim|vim|ripgrep|fd-find|fzf|zoxide|eza|bat|htop|tree|jq|gh|docker.io|docker-compose|neofetch|btop|vlc)
            echo "apt" ;;
        starship|fnm|rustup|uv|turso|pnpm|bun)
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
        turso) echo "https://get.tur.so/install.sh" ;;
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
        starship|uv|turso|pnpm)
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
