#!/bin/bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

fail() {
    echo "not ok - $*" >&2
    exit 1
}

assert_eq() {
    local expected="$1"
    local actual="$2"
    local message="$3"

    [[ "$expected" == "$actual" ]] || fail "$message: expected '$expected', got '$actual'"
}

test_setup_config_symlinks_skips_hooks_when_links_are_current() {
    local tmp home script_dir configs_dir
    tmp="$(mktemp -d)"
    home="$tmp/home"
    script_dir="$tmp/repo/setup"
    configs_dir="$tmp/repo/configs"
    mkdir -p "$home/.config" "$script_dir" "$configs_dir"

    export HOME="$home"
    export SCRIPT_DIR="$script_dir"
    export DRY_RUN=false
    export VERBOSE=false
    export SETUP_BACKUP_ROOT=""

    # shellcheck disable=SC1091
    source "$repo_root/setup/lib/logger.sh"
    # shellcheck disable=SC1091
    source "$repo_root/setup/lib/executor.sh"
    # shellcheck disable=SC1091
    source "$repo_root/setup/lib/installers.sh"

    install_keyd() { echo "install_keyd" >> "$tmp/hooks"; }
    setup_window_management() { echo "setup_window_management" >> "$tmp/hooks"; }
    install_editor_extensions() { echo "install_editor_extensions" >> "$tmp/hooks"; }
    setup_runtime_permissions() { echo "setup_runtime_permissions" >> "$tmp/hooks"; }

    local specs=(
        "nvim:$home/.config/nvim"
        "starship/starship.toml:$home/.config/starship.toml"
        "fastfetch:$home/.config/fastfetch"
        "ghostty:$home/.config/ghostty"
        "fuzzel:$home/.config/fuzzel"
        "fish/config.fish:$home/.config/fish/config.fish"
        "fish/conf.d:$home/.config/fish/conf.d"
        "zsh:$home/.config/zsh"
        "bash:$home/.config/bash"
        "agents:$home/.agents"
        "zed:$home/.config/zed"
        "cursor:$home/.config/cursor"
        "hypr:$home/.config/hypr"
        "waybar:$home/.config/waybar"
        "dunst:$home/.config/dunst"
        "swayosd:$home/.config/swayosd"
        "git/ignore:$home/.config/git/ignore"
        "kxkbrc:$home/.config/kxkbrc"
        "sxhkd:$home/.config/sxhkd"
    )

    local item src dst src_path
    for item in "${specs[@]}"; do
        src="${item%%:*}"
        dst="${item##*:}"
        src_path="$configs_dir/$src"
        mkdir -p "$(dirname "$src_path")" "$(dirname "$dst")"
        case "$src" in
            */*.toml|*/config.fish|git/ignore|kxkbrc)
                : > "$src_path"
                ;;
            *)
                mkdir -p "$src_path"
                ;;
        esac
        ln -s "$src_path" "$dst"
    done

    setup_config_symlinks >/dev/null

    [[ ! -e "$tmp/hooks" ]] || fail "setup_config_symlinks ran hooks even though managed links were current"

    rm -rf "$tmp"
}

test_command_backed_category_is_satisfied_when_commands_exist() {
    local tmp bin
    tmp="$(mktemp -d)"
    bin="$tmp/bin"
    mkdir -p "$bin"

    export HOME="$tmp/home"
    export SCRIPT_DIR="$tmp/repo/setup"
    export DRY_RUN=false
    export VERBOSE=false
    export PATH="$bin:$PATH"

    mkdir -p "$HOME" "$SCRIPT_DIR"

    # shellcheck disable=SC1091
    source "$repo_root/setup/lib/logger.sh"
    # shellcheck disable=SC1091
    source "$repo_root/setup/lib/executor.sh"
    # shellcheck disable=SC1091
    source "$repo_root/setup/lib/installers.sh"

    local command_name
    for command_name in starship fnm rustup uv; do
        printf '#!/bin/sh\nexit 0\n' > "$bin/$command_name"
        chmod +x "$bin/$command_name"
    done

    category_already_satisfied "curl-tools" || fail "curl-tools was not satisfied even though all commands exist"

    rm -rf "$tmp"
}

test_setup_config_symlinks_skips_hooks_when_links_are_current
test_command_backed_category_is_satisfied_when_commands_exist
echo "ok - setup_config_symlinks skips hooks when links are current"
