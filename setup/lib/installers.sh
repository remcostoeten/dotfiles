#!/bin/bash
set -euo pipefail

detect_package_manager() {
    if command -v apt >/dev/null 2>&1; then
        echo "apt"
        return 0
    fi

    if command -v pacman >/dev/null 2>&1; then
        echo "pacman"
        return 0
    fi

    echo "unknown"
}

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

map_pacman_package_name() {
    local pkg="$1"

    case "$pkg" in
        build-essential) echo "base-devel" ;;
        python3) echo "python" ;;
        python3-pip) echo "python-pip" ;;
        python3-venv) echo "__skip__" ;;
        software-properties-common) echo "__skip__" ;;
        fd-find) echo "fd" ;;
        gh) echo "github-cli" ;;
        docker.io) echo "docker" ;;
        docker-compose) echo "docker-compose" ;;
        fastfetch) echo "fastfetch" ;;
        btop) echo "btop" ;;
        vlc) echo "vlc" ;;
        swayosd) echo "swayosd" ;;
        polkit-gnome) echo "polkit-gnome" ;;
        *) echo "$pkg" ;;
    esac
}

refresh_tool_path() {
    local tool="$1"
    case "$tool" in
        starship|uv)
            case ":$PATH:" in
                *":$HOME/.local/bin:"*) ;;
                *) export PATH="$HOME/.local/bin:$PATH" ;;
            esac
            ;;
        pnpm)
            export PNPM_HOME="${PNPM_HOME:-$HOME/.local/share/pnpm}"
            case ":$PATH:" in
                *":$PNPM_HOME:"*) ;;
                *) export PATH="$PNPM_HOME:$PATH" ;;
            esac
            ;;
        bun)
            export BUN_INSTALL="${BUN_INSTALL:-$HOME/.bun}"
            case ":$PATH:" in
                *":$BUN_INSTALL/bin:"*) ;;
                *) export PATH="$BUN_INSTALL/bin:$PATH" ;;
            esac
            ;;
        rustup)
            case ":$PATH:" in
                *":$HOME/.cargo/bin:"*) ;;
                *) export PATH="$HOME/.cargo/bin:$PATH" ;;
            esac
            ;;
        fnm)
            local fnm_dir="${FNM_DIR:-$HOME/.local/share/fnm}"
            case ":$PATH:" in
                *":$fnm_dir:"*) ;;
                *) export PATH="$fnm_dir:$PATH" ;;
            esac
            ;;
    esac
}

is_installed_apt() {
    local pkg="$1"
    dpkg -l 2>/dev/null | grep -q "^ii  $pkg "
}

is_installed_pacman() {
    local pkg="$1"
    pacman -Q "$pkg" >/dev/null 2>&1
}

install_apt() {
    local pkg="$1"
    local name="${2:-$pkg}"
    local package_manager
    package_manager="$(detect_package_manager)"

    case "$package_manager" in
        apt)
            if is_installed_apt "$pkg"; then
                log_success "$name already installed"
                return 0
            fi

            log_step "Installing $name..."
            if [[ "$DRY_RUN" == "true" ]]; then
                echo -e "\033[0;36m[DRY RUN]\033[0m Would run: sudo apt install -y $pkg"
            else
                set +e
                sudo apt install -y -qq "$pkg" 2>&1 | grep -v "^Reading" | grep -v "^Building" | grep -v "^0 upgraded" | grep -v "already the newest" | grep -v "set to manually" | grep -v "no longer required" | grep -v "autoremove" | grep -v "WARNING" | grep -v "nvidia-firmware" | grep -v "ocl-icd"
                local install_status=${PIPESTATUS[0]}
                set -e
                if ((install_status != 0)); then
                    log_error "Failed to install $name ($pkg) via apt"
                    return 1
                fi
            fi
            log_success "$name installed"
            ;;
        pacman)
            local mapped_pkg
            mapped_pkg="$(map_pacman_package_name "$pkg")"

            if [[ "$mapped_pkg" == "__skip__" ]]; then
                log_info "Skipping $name on pacman-based systems"
                return 0
            fi

            if is_installed_pacman "$mapped_pkg"; then
                log_success "$name already installed"
                return 0
            fi

            log_step "Installing $name..."
            if [[ "$DRY_RUN" == "true" ]]; then
                echo -e "\033[0;36m[DRY RUN]\033[0m Would run: sudo pacman -S --noconfirm --needed $mapped_pkg"
            else
                sudo pacman -S --noconfirm --needed "$mapped_pkg" >/dev/null 2>&1 || {
                    log_error "Failed to install $name ($mapped_pkg) via pacman"
                    return 1
                }
            fi
            log_success "$name installed"
            ;;
        *)
            log_error "No supported package manager found (apt/pacman)"
            return 1
            ;;
    esac
}

install_snap() {
    local pkg="$1"
    local name="${2:-$pkg}"
    local flags="${3:-}"
    
    if snap list 2>/dev/null | grep -q "^$pkg "; then
        log_success "$name already installed"
        return 0
    fi
    
    log_step "Installing $name..."
    if [[ "$DRY_RUN" == "true" ]]; then
        echo -e "\033[0;36m[DRY RUN]\033[0m Would run: sudo snap install $flags $pkg"
    else
        set +e
        sudo snap install $flags "$pkg" 2>&1 | grep -v "Spawned"
        local install_status=${PIPESTATUS[0]}
        set -e
        if ((install_status != 0)); then
            log_error "Failed to install $name via snap"
            return 1
        fi
    fi
    log_success "$name installed"
}

install_npm() {
    local pkg="$1"
    local name="${2:-$pkg}"
    
    if npm list -g "$pkg" &>/dev/null; then
        log_success "$name already installed"
        return 0
    fi
    
    log_step "Installing $name..."
    if [[ "$DRY_RUN" == "true" ]]; then
        echo -e "\033[0;36m[DRY RUN]\033[0m Would run: npm install -g $pkg"
    else
        set +e
        sudo npm install -g "$pkg" --silent 2>&1 | grep -v "npm warn"
        local install_status=${PIPESTATUS[0]}
        set -e
        if ((install_status != 0)); then
            log_error "Failed to install $name via npm"
            return 1
        fi
    fi
    log_success "$name installed"
}

install_curl() {
    local url="$1"
    local name="$2"
    local shell="${3:-bash}"
    local shell_flags="${4:-}"
    local -a installer_args=()

    if [[ -n "$shell_flags" ]]; then
        read -r -a installer_args <<< "$shell_flags"
    fi

    refresh_tool_path "$name"
    
    if exists "$name"; then
        log_success "$name already installed"
        return 0
    fi
    
    log_step "Installing $name..."
    if [[ "$DRY_RUN" == "true" ]]; then
        if ((${#installer_args[@]})); then
            echo -e "\033[0;36m[DRY RUN]\033[0m Would run: curl -fsSL $url | $shell -s -- ${installer_args[*]}"
        else
            echo -e "\033[0;36m[DRY RUN]\033[0m Would run: curl -fsSL $url | $shell"
        fi
        return 0
    else
        if [[ "$VERBOSE" == "true" ]]; then
            if ((${#installer_args[@]})); then
                if ! curl -fsSL "$url" | "$shell" -s -- "${installer_args[@]}"; then
                    log_error "Failed to install $name from $url"
                    return 1
                fi
            else
                if ! curl -fsSL "$url" | "$shell"; then
                    log_error "Failed to install $name from $url"
                    return 1
                fi
            fi
        else
            if ((${#installer_args[@]})); then
                if ! curl -fsSL "$url" 2>/dev/null | "$shell" -s -- "${installer_args[@]}" 2>/dev/null; then
                    log_error "Failed to install $name from $url"
                    return 1
                fi
            else
                if ! curl -fsSL "$url" 2>/dev/null | "$shell" 2>/dev/null; then
                    log_error "Failed to install $name from $url"
                    return 1
                fi
            fi
        fi
    fi
    
    refresh_tool_path "$name"
    if exists "$name"; then
        log_success "$name installed"
    else
        log_warn "$name failed to install"
        return 1
    fi
}

setup_starship_config() {
    local starship_config_src="$SCRIPT_DIR/../configs/starship/starship.toml"
    local starship_config_dst="$HOME/.config/starship.toml"
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] Would link starship.toml from the repo"
        return 0
    fi
    ensure_setup_backup_root
    ensure_symlink "$starship_config_src" "$starship_config_dst" "$SETUP_BACKUP_ROOT"
}

setup_runtime_permissions() {
    local runtime_dirs=(
        "$SCRIPT_DIR/../bin"
        "$SCRIPT_DIR/../scripts"
    )

    local runtime_dir=""
    for runtime_dir in "${runtime_dirs[@]}"; do
        if [[ -d "$runtime_dir" ]]; then
            find "$runtime_dir" -maxdepth 1 -type f -exec chmod +x {} + 2>/dev/null || true
        fi
    done
}

ensure_setup_backup_root() {
    if [[ -n "${SETUP_BACKUP_ROOT:-}" ]]; then
        return 0
    fi

    local timestamp
    timestamp="$(date +%Y%m%d-%H%M%S)-$$"
    SETUP_BACKUP_ROOT="$SCRIPT_DIR/../.dotfiles/setup-backups/$timestamp"
    mkdir -p "$SETUP_BACKUP_ROOT"
}

backup_existing_target() {
    local dst_path="$1"
    local backup_root="$2"
    local relative_path backup_path

    case "$dst_path" in
        "$HOME"/*)
            relative_path="${dst_path#"$HOME"/}"
            ;;
        *)
            relative_path="$(basename "$dst_path")"
            ;;
    esac

    backup_path="$backup_root/$relative_path"
    mkdir -p "$(dirname "$backup_path")"
    mv "$dst_path" "$backup_path"
}

ensure_symlink() {
    local src_path="$1"
    local dst_path="$2"
    local backup_root="${3:-}"
    local dst_dir

    dst_dir="$(dirname "$dst_path")"
    mkdir -p "$dst_dir"

    if [[ -L "$dst_path" ]]; then
        local current_target
        current_target="$(readlink "$dst_path" 2>/dev/null || true)"
        if [[ "$current_target" == "$src_path" ]]; then
            return 0
        fi
        rm -f "$dst_path"
    elif [[ -e "$dst_path" ]]; then
        if [[ -n "$backup_root" ]]; then
            backup_existing_target "$dst_path" "$backup_root"
        else
            rm -rf "$dst_path"
        fi
    fi

    ln -s "$src_path" "$dst_path" 2>/dev/null || {
        log_error "Failed to link $dst_path -> $src_path"
        return 1
    }
}

setup_config_symlinks() {
    local configs_dir="$SCRIPT_DIR/../configs"
    local home_config_dir="$HOME/.config"
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] Would link desktop and shell config directories from the repo"
        return 0
    fi
    ensure_setup_backup_root

    mkdir -p "$home_config_dir"
    
    local configs=(
        "nvim:$home_config_dir/nvim"
        "starship/starship.toml:$home_config_dir/starship.toml"
        "fastfetch:$home_config_dir/fastfetch"
        "ghostty:$home_config_dir/ghostty"
        "rofi:$home_config_dir/rofi"
        "fish/config.fish:$home_config_dir/fish/config.fish"
        "fish/conf.d:$home_config_dir/fish/conf.d"
        "zsh:$HOME/.config/zsh"
        "bash:$HOME/.config/bash"
        "zed:$HOME/.config/zed"
        "cursor:$HOME/.config/cursor"
        "hypr:$home_config_dir/hypr"
        "waybar:$home_config_dir/waybar"
        "dunst:$home_config_dir/dunst"
        "swayosd:$home_config_dir/swayosd"
        "git/ignore:$home_config_dir/git/ignore"
    )
    
    for item in "${configs[@]}"; do
        local src="${item%%:*}"
        local dst="${item##*:}"
        local src_path="$configs_dir/$src"
        local dst_path="$dst"
        
        if [[ -e "$src_path" ]]; then
            ensure_symlink "$src_path" "$dst_path" "$SETUP_BACKUP_ROOT"
        fi
    done

    local git_src="$configs_dir/git/.gitconfig"
    local git_dst="$HOME/.gitconfig"
    if [[ -f "$git_src" ]]; then
        ensure_symlink "$git_src" "$git_dst" "$SETUP_BACKUP_ROOT"
    fi

    link_editor_configs_recursive "$configs_dir" "$home_config_dir"

    local gpg_sync_script="$SCRIPT_DIR/../scripts/gpg-sync.sh"
    if [[ -x "$gpg_sync_script" && -d "$HOME/.config/dotfiles/env-private/.gnupg" ]]; then
        if [[ "$DRY_RUN" == "true" ]]; then
            echo -e "${YELLOW}[DRY RUN]${NC} Would restore GPG keys from env-private"
        else
            "$gpg_sync_script" restore >/dev/null 2>&1 || true
        fi
    fi

    setup_runtime_permissions
    
    log_success "Config symlinks created"

install_editor_extensions
    
}

link_editor_configs_recursive() {
    local configs_dir="$1"
    local home_config_dir="$2"
    local vscode_config="$configs_dir/vscode"
    local ide_config="$configs_dir/ide"

    SETUP_BACKUP_ROOT="${SETUP_BACKUP_ROOT:-$HOME/.config/dotfiles/setup_backup}"

    if [[ ! -d "$vscode_config" ]]; then
        return
    fi

    mkdir -p "$ide_config"

    local all_editors_dir="$ide_config/all-editors"
    mkdir -p "$all_editors_dir"

    for file in "$vscode_config"/*; do
        if [[ -f "$file" ]]; then
            local filename=$(basename "$file")
            ensure_symlink "$file" "$all_editors_dir/$filename" "$SETUP_BACKUP_ROOT"
        fi
    done

    local editors=("cursor:$home_config_dir/Cursor" "windsurf:$home_config_dir/Windsurf" "zed:$home_config_dir/zed")

    for item in "${editors[@]}"; do
        local editor="${item%%:*}"
        local dst_dir="${item##*:}"
        local editor_config_dir="$ide_config/$editor"

        mkdir -p "$dst_dir"
        mkdir -p "$editor_config_dir"

        for file in "$all_editors_dir"/*; do
            if [[ -f "$file" ]]; then
                local filename=$(basename "$file")
                ensure_symlink "$file" "$editor_config_dir/$filename" "$SETUP_BACKUP_ROOT"
                ensure_symlink "$file" "$dst_dir/$filename" "$SETUP_BACKUP_ROOT"
            fi
        done
    done
}

install_editor_extensions() {
    local repo_root="${SCRIPT_DIR:-$HOME/.config/dotfiles/setup}/.."
    local vscode_config="$repo_root/configs/vscode"
    local ide_config="$repo_root/configs/ide"
    local extensions_file="$vscode_config/extensions.json"
    local antigravity_extensions="$ide_config/antigravity/extensions.json"

    install_extensions_for_editors() {
        local file="$1"
        local editors="$2"

        [[ ! -f "$file" ]] && return

        local ext_ids=()
        while IFS= read -r line; do
            line=$(echo "$line" | tr -d '", ' | xargs)
            [[ -n "$line" ]] && ext_ids+=("$line")
        done < <(grep -v '^\[' "$file" | grep -v '\]')

        for ext_id in "${ext_ids[@]}"; do
            [[ -z "$ext_id" ]] && continue
            
            for editor in $editors; do
                local install_cmd=""
                case "$editor" in
                    code) install_cmd="code --install-extension" ;;
                    cursor) install_cmd="cursor --install-extension" ;;
                    windsurf) install_cmd="windsurf --install-extension" ;;
                esac

                if command -v "$editor" &>/dev/null; then
                    if [[ "$DRY_RUN" == "true" ]]; then
                        log_info "[DRY RUN] Would install: $ext_id for $editor"
                    else
                        $install_cmd "$ext_id" 2>/dev/null || true
                    fi
                fi
            done
        done
    }

    install_extensions_for_editors "$extensions_file" "code cursor windsurf"

    if [[ -f "$antigravity_extensions" ]] && command -v code &>/dev/null; then
        install_extensions_for_editors "$antigravity_extensions" "code"
    fi
}

install_github() {
    local repo="$1"
    local name="${2:-${repo##*/}}"
    local target_dir="${3:-$name}"
    
    if command -v "$name" &>/dev/null; then
        log_success "$name already installed"
        return 0
    fi
    
    if [[ -d "$target_dir" ]]; then
        log_info "$name directory exists, pulling latest..."
        if [[ "$DRY_RUN" == "true" ]]; then
            echo -e "\033[0;36m[DRY RUN]\033[0m Would pull latest $name"
        else
            (cd "$target_dir" && git pull) 2>/dev/null || true
            log_success "$name updated"
        fi
        return 0
    fi
    
    log_step "Installing $name..."
    if [[ "$DRY_RUN" == "true" ]]; then
        echo -e "\033[0;36m[DRY RUN]\033[0m Would run: gh repo clone $repo $target_dir"
        return 0
    else
        set +e
        gh repo clone "$repo" "$target_dir" 2>&1 | grep -v "Cloning" | grep -v "warning:"
        local install_status=${PIPESTATUS[0]}
        set -e
        if ((install_status != 0)); then
            log_error "Failed to install $name from GitHub repo $repo"
            return 1
        fi
    fi
    log_success "$name installed"
}

install_nerd_font() {
    local font="$1"
    local font_dir="$HOME/.local/share/fonts/NerdFonts"
    
    if fc-list | grep -qi "$font"; then
        log_success "$font already installed"
        return 0
    fi
    
    log_step "Installing Nerd Font: $font..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        echo -e "\033[0;36m[DRY RUN]\033[0m Would download and install $font Nerd Font"
    else
        mkdir -p "$font_dir"
        local zip_path="/tmp/${font}.zip"
        curl -fL "https://github.com/ryanoasis/nerd-fonts/releases/latest/download/${font}.zip" -o "$zip_path" 2>/dev/null
        unzip -o "$zip_path" -d "$font_dir" 2>/dev/null
        rm -f "$zip_path"
    fi
    
    log_success "$font Nerd Font installed"
}

install_geist_all() {
    local font_dir="$HOME/.local/share/fonts"
    
    if fc-list | grep -qi "Geist"; then
        log_success "Geist fonts already installed"
        return 0
    fi
    
    log_step "Installing Geist fonts..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        echo -e "\033[0;36m[DRY RUN]\033[0m Would download and install Geist fonts"
        return 0
    fi
    
    local zip_path="/tmp/geist-font.zip"
    mkdir -p "$font_dir"
    curl -fL "https://github.com/vercel/geist-font/releases/download/1.8.0/geist-font-1.8.0.zip" -o "$zip_path" 2>/dev/null
    unzip -o "$zip_path" -d "$font_dir" 2>/dev/null
    rm -f "$zip_path"
    
    log_success "Geist fonts installed (Sans, Mono, Pixel)"
}

install_inter() {
    local font_dir="$HOME/.local/share/fonts"
    
    if fc-list | grep -qi "Inter"; then
        log_success "Inter already installed"
        return 0
    fi
    
    log_step "Installing Inter..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        echo -e "\033[0;36m[DRY RUN]\033[0m Would download Inter font"
        return 0
    fi
    
    local zip_path="/tmp/Inter.zip"
    mkdir -p "$font_dir"
    curl -fL "https://github.com/rsms/inter/releases/download/v4.1/Inter-4.1.zip" -o "$zip_path" 2>/dev/null
    unzip -o "$zip_path" -d "$font_dir" 2>/dev/null
    rm -f "$zip_path"
    
    log_success "Inter installed"
}

install_jetbrains_mono() {
    if fc-list | grep -qi "JetBrains Mono"; then
        log_success "JetBrains Mono already installed"
        return 0
    fi
    
    log_step "Installing JetBrains Mono..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        echo -e "\033[0;36m[DRY RUN]\033[0m Would install JetBrains Mono"
        return 0
    fi
    
    local font_dir="$HOME/.local/share/fonts"
    local zip_path="/tmp/jetbrains-mono.zip"
    mkdir -p "$font_dir"
    curl -fL "https://github.com/JetBrains/JetBrainsMono/releases/download/v2.304/JetBrainsMono-2.304.zip" -o "$zip_path" 2>/dev/null
    unzip -o "$zip_path" -d "$font_dir" 2>/dev/null
    rm -f "$zip_path"
    
    log_success "JetBrains Mono installed"
}

install_ibm_plex_mono() {
    local font_dir="$HOME/.local/share/fonts"
    
    if fc-list | grep -qi "IBM Plex Mono"; then
        log_success "IBM Plex Mono already installed"
        return 0
    fi
    
    log_step "Installing IBM Plex Mono..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        echo -e "\033[0;36m[DRY RUN]\033[0m Would install IBM Plex Mono"
        return 0
    fi
    
    local zip_path="/tmp/ibm-plex-mono.zip"
    mkdir -p "$font_dir"
    curl -fL "https://github.com/IBM/plex/releases/download/%40ibm/plex-mono%401.1.0/ibm-plex-mono.zip" -o "$zip_path" 2>/dev/null
    unzip -o "$zip_path" -d "$font_dir" 2>/dev/null
    rm -f "$zip_path"
    
    log_success "IBM Plex Mono installed"
}

install_all_fonts() {
    if [[ "$DRY_RUN" == "true" ]]; then
        echo -e "\033[0;36m[DRY RUN]\033[0m Would install all fonts in parallel"
        return 0
    fi
    
    local font_dir="$HOME/.local/share/fonts"
    mkdir -p "$font_dir"
    mkdir -p "$font_dir/NerdFonts"
    
    local fonts_to_install=()
    local fonts_skipped=()
    
    declare -A font_checks=(
        ["ComicShannsMono"]="ComicShannsMono"
        ["Geist"]="Geist"
        ["Inter"]="Inter"
        ["JetBrains Mono"]="JetBrainsMono"
        ["IBM Plex Mono"]="ibm-plex-mono"
        ["Hack"]="Hack"
    )
    
    echo -e "${CYAN}━━━ Font Check ━━━${NC}"
    
    for font_name in "${!font_checks[@]}"; do
        if fc-list | grep -qi "$font_name"; then
            fonts_skipped+=("$font_name")
            echo -e "  ${GREEN}✓${NC} $font_name (exists)"
        else
            fonts_to_install+=("$font_name")
            echo -e "  ${YELLOW}↓${NC} $font_name (will install)"
        fi
    done
    
    if [[ ${#fonts_to_install[@]} -eq 0 ]]; then
        echo ""
        log_success "All fonts already installed"
        install_emoji_fonts
        return 0
    fi
    
    echo ""
    log_step "Installing ${#fonts_to_install[@]} missing font(s)..."
    spinner_start "Downloading fonts..."
    
    local pids=()
    
    if ! fc-list | grep -qi "ComicShannsMono"; then
        (
            local zip_path="/tmp/ComicShannsMono.zip"
            curl -fL "https://github.com/ryanoasis/nerd-fonts/releases/latest/download/ComicShannsMono.zip" -o "$zip_path" 2>/dev/null
            unzip -o "$zip_path" -d "$font_dir/NerdFonts" 2>/dev/null
            rm -f "$zip_path"
        ) &
        pids+=($!)
    fi
    
    if ! fc-list | grep -qi "Geist"; then
        (
            local zip_path="/tmp/geist-font.zip"
            curl -fL "https://github.com/vercel/geist-font/releases/download/1.8.0/geist-font-1.8.0.zip" -o "$zip_path" 2>/dev/null
            unzip -o "$zip_path" -d "$font_dir" 2>/dev/null
            rm -f "$zip_path"
        ) &
        pids+=($!)
    fi
    
    if ! fc-list | grep -qi "Inter"; then
        (
            local zip_path="/tmp/Inter.zip"
            curl -fL "https://github.com/rsms/inter/releases/download/v4.1/Inter-4.1.zip" -o "$zip_path" 2>/dev/null
            unzip -o "$zip_path" -d "$font_dir" 2>/dev/null
            rm -f "$zip_path"
        ) &
        pids+=($!)
    fi
    
    if ! fc-list | grep -qi "JetBrains Mono"; then
        (
            local zip_path="/tmp/jetbrains-mono.zip"
            curl -fL "https://github.com/JetBrains/JetBrainsMono/releases/download/v2.304/JetBrainsMono-2.304.zip" -o "$zip_path" 2>/dev/null
            unzip -o "$zip_path" -d "$font_dir" 2>/dev/null
            rm -f "$zip_path"
        ) &
        pids+=($!)
    fi
    
    if ! fc-list | grep -qi "IBM Plex Mono"; then
        (
            local zip_path="/tmp/ibm-plex-mono.zip"
            curl -fL "https://github.com/IBM/plex/releases/download/%40ibm/plex-mono%401.1.0/ibm-plex-mono.zip" -o "$zip_path" 2>/dev/null
            unzip -o "$zip_path" -d "$font_dir" 2>/dev/null
            rm -f "$zip_path"
        ) &
        pids+=($!)
    fi
    
    if ! fc-list | grep -qi "Hack"; then
        (
            local zip_path="/tmp/Hack.zip"
            curl -fL "https://github.com/ryanoasis/nerd-fonts/releases/latest/download/Hack.zip" -o "$zip_path" 2>/dev/null
            unzip -o "$zip_path" -d "$font_dir/NerdFonts" 2>/dev/null
            rm -f "$zip_path"
        ) &
        pids+=($!)
    fi
    
    for pid in "${pids[@]}"; do
        wait "$pid" 2>/dev/null || true
    done

    spinner_stop
    fc-cache -f 2>/dev/null
    
    install_emoji_fonts
    
    echo ""
    log_success "Fonts installed (${#fonts_to_install[@]} new, ${#fonts_skipped[@]} skipped)"
}

install_emoji_fonts() {
    local font_dir="$HOME/.local/share/fonts"
    mkdir -p "$font_dir"

    log_step "Installing emoji fonts..."

    if fc-list | grep -qi "noto"; then
        log_success "Noto emoji fonts already installed"
    else
        if command -v apt &>/dev/null; then
            sudo apt install -y -qq fonts-noto-color-emoji 2>/dev/null || true
        elif command -v pacman &>/dev/null; then
            sudo pacman -S --noconfirm --needed noto-fonts-emoji 2>/dev/null || true
        fi
    fi

    local emoji_config_dir="$HOME/.config/fontconfig"
    mkdir -p "$emoji_config_dir/conf.d"

    if [[ ! -f "$emoji_config_dir/conf.d/01-emoji.conf" ]]; then
        cat > "$emoji_config_dir/conf.d/01-emoji.conf" << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE fontconfig SYSTEM "urn:fontconfig:fonts.dtd">
<fontconfig>
    <match target="scan">
        <test name="family">
            <string>Segoe UI Emoji</string>
        </test>
        <edit name="antialias">
            <bool>true</bool>
        </edit>
    </match>
    <alias binding="strong">
        <family>emoji</family>
        <prefer>
            <family>Noto Color Emoji</family>
            <family>Segoe UI Emoji</family>
            <family>Apple Color Emoji</family>
        </prefer>
    </alias>
</fontconfig>
EOF
        log_success "Emoji font config created"
    fi

    fc-cache -f 2>/dev/null
}

install_ghostty() {
    if command -v ghostty &> /dev/null; then
        log_success "Ghostty already installed"
        return 0
    fi
    
    log_step "Installing Ghostty terminal..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        echo -e "\033[0;36m[DRY RUN]\033[0m Would install Ghostty via .deb"
        return 0
    fi

    local package_manager
    package_manager="$(detect_package_manager)"

    case "$package_manager" in
        apt)
            local tmp_deb="/tmp/ghostty.deb"
            local ubuntu_version
            ubuntu_version=$(lsb_release -rs 2>/dev/null || echo "24.04")
            local deb_name="ghostty_1.3.1-0.ppa1_amd64_${ubuntu_version}.deb"
            local download_url="https://github.com/mkasberg/ghostty-ubuntu/releases/download/1.3.1-0-ppa1/${deb_name}"
            curl -fsSL "$download_url" -o "$tmp_deb"
            sudo apt install -y -qq "$tmp_deb" 2>/dev/null
            rm -f "$tmp_deb"
            ;;
        pacman)
            sudo pacman -S --noconfirm --needed ghostty >/dev/null 2>&1
            ;;
        *)
            log_error "No supported package manager found for Ghostty installation"
            return 1
            ;;
    esac
    
    log_success "Ghostty installed"
}

install_zed() {
    if command -v zed &> /dev/null; then
        log_success "Zed already installed"
        return 0
    fi
    
    log_step "Installing Zed editor..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        echo -e "\033[0;36m[DRY RUN]\033[0m Would install Zed editor"
        return 0
    fi
    
    curl -f https://zed.dev/install.sh 2>/dev/null | sh
    
    log_success "Zed editor installed"
}

install_vscode() {
    if command -v code &> /dev/null; then
        log_success "VS Code already installed"
        return 0
    fi
    
    log_step "Installing VS Code..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        echo -e "\033[0;36m[DRY RUN]\033[0m Would install VS Code"
        return 0
    fi

    local package_manager
    package_manager="$(detect_package_manager)"

    case "$package_manager" in
        apt)
            sudo apt install -y -qq wget gpg 2>/dev/null
            wget -qO- https://packages.microsoft.com/keys/microsoft.asc | sudo gpg --dearmor -o /usr/share/keyrings/microsoft.gpg
            echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/microsoft.gpg] https://packages.microsoft.com/repos/vscode stable main" | sudo tee /etc/apt/sources.list.d/vscode.list >/dev/null
            sudo apt update -qq 2>/dev/null
            sudo apt install -y -qq code 2>/dev/null
            ;;
        pacman)
            sudo pacman -S --noconfirm --needed code >/dev/null 2>&1
            ;;
        *)
            log_error "No supported package manager found for VS Code installation"
            return 1
            ;;
    esac
    
    log_success "VS Code installed"
}

install_opencode() {
    if command -v opencode &> /dev/null; then
        log_success "OpenCode already installed"
        return 0
    fi
    
    log_step "Installing OpenCode CLI..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        echo -e "\033[0;36m[DRY RUN]\033[0m Would install OpenCode CLI"
    else
        curl -fsSL https://opencode.ai/install | bash
    fi
    log_success "OpenCode CLI installed"
    
    log_step "Installing OpenCode Desktop..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        echo -e "\033[0;36m[DRY RUN]\033[0m Would install OpenCode Desktop"
    else
        local package_manager
        package_manager="$(detect_package_manager)"

        case "$package_manager" in
            apt)
                local tmp_deb="/tmp/opencode.deb"
                curl -fsSL https://opencode.ai/download/stable/linux-x64-deb -o "$tmp_deb"
                sudo apt install -y "$tmp_deb"
                rm -f "$tmp_deb"
                ;;
            pacman)
                log_info "Skipping OpenCode Desktop on pacman-based systems (no .deb support)"
                ;;
            *)
                log_warn "Skipping OpenCode Desktop: unsupported package manager"
                ;;
        esac
    fi
    log_success "OpenCode Desktop installed"
}

install_nvidia() {
    log_step "Installing NVIDIA drivers..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        echo -e "\033[0;36m[DRY RUN]\033[0m Would install NVIDIA drivers"
        return 0
    fi
    
    sudo apt install -y -qq nvidia-driver-535 nvidia-settings 2>/dev/null || sudo apt install -y -qq nvidia-driver-550 2>/dev/null || true
    
    log_success "NVIDIA drivers installed"
}

install_openrgb() {
    log_step "Installing OpenRGB..."
    
    if command -v openrgb &>/dev/null; then
        log_success "OpenRGB already installed"
        return 0
    fi
    
    if [[ "$DRY_RUN" == "true" ]]; then
        echo -e "\033[0;36m[DRY RUN]\033[0m Would install OpenRGB"
        return 0
    fi
    
    sudo add-apt-repository -y ppa:thopiekar/openrgb 2>&1 | grep -v "^Hit:" | grep -v "^Get:" | grep -v "^Ign:" | grep -v "^Reading" || true
    sudo apt update -qq 2>&1 | grep -v "^Hit:" | grep -v "^Get:" | grep -v "^Reading" || true
    sudo apt install -y -qq openrgb 2>&1 | grep -v "^Selecting" | grep -v "^Preparing" | grep -v "^Unpacking" | grep -v "^Setting up" || true
    
    log_success "OpenRGB installed"
}

install_dotnet() {
    if command -v dotnet &>/dev/null; then
        log_success ".NET already installed"
        return 0
    fi
    
    log_step "Installing .NET SDK..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        echo -e "\033[0;36m[DRY RUN]\033[0m Would install .NET SDK"
        return 0
    fi
    
    local dotnet_install_script="$HOME/.dotnet/dotnet-install.sh"
    mkdir -p "$(dirname "$dotnet_install_script")"
    curl -sSL https://dot.net/v1/dotnet-install.sh -o "$dotnet_install_script"
    chmod +x "$dotnet_install_script"
    "$dotnet_install_script" --channel 9.0
    
    log_success ".NET SDK installed"
}

set_fish_default_shell() {
    if [[ "$SHELL" == *"fish"* ]]; then
        log_success "Fish is already the default shell"
        return 0
    fi
    
    if ! command -v fish &>/dev/null; then
        log_warn "Fish is not installed, skipping default shell setup"
        return 0
    fi
    
    local fish_path
    fish_path="$(which fish)"
    
    log_step "Setting fish as default shell..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        echo -e "\033[0;36m[DRY RUN]\033[0m Would set fish as default shell"
        return 0
    fi
    
    if grep -q "^$fish_path$" /etc/shells; then
        chsh -s "$fish_path" 2>/dev/null || true
        log_success "Fish set as default shell (restart terminal to apply)"
    else
        echo "$fish_path" | sudo tee -a /etc/shells >/dev/null
        chsh -s "$fish_path" 2>/dev/null || true
        log_success "Fish set as default shell (restart terminal to apply)"
    fi
}

ensure_fish_config() {
    local fish_config_dir="$HOME/.config/fish"
    local fish_config_src="$SCRIPT_DIR/../configs/fish"
    
    mkdir -p "$fish_config_dir"
    mkdir -p "$fish_config_dir/conf.d"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        echo -e "\033[0;36m[DRY RUN]\033[0m Would ensure fish config is linked"
        return 0
    fi
    
    ensure_setup_backup_root
    
    if [[ -d "$fish_config_src" ]]; then
        ensure_symlink "$fish_config_src/config.fish" "$fish_config_dir/config.fish" "$SETUP_BACKUP_ROOT"
        ensure_symlink "$fish_config_src/conf.d" "$fish_config_dir/conf.d" "$SETUP_BACKUP_ROOT"
        log_success "Fish config linked"
    fi
}

install_arch_audio() {
    local os_family
    os_family="$(detect_os_family)"

    if [[ "$os_family" != "arch" ]]; then
        return 0
    fi

    log_info "Fixing audio stack for Arch (PipeWire migration)..."

    if [[ "$DRY_RUN" == "true" ]]; then
        echo -e "\033[0;36m[DRY RUN]\033[0m Would install PipeWire stack and fix audio"
        return 0
    fi

    log_step "Installing PipeWire stack (replaces PulseAudio)..."
    sudo pacman -S --noconfirm --needed \
        pipewire pipewire-pulse wireplumber pavucontrol \
        pipewire-alsa pipewire-jack 2>/dev/null || true

    log_step "Installing browser codec packages..."
    sudo pacman -S --noconfirm --needed \
        ffmpeg gst-libav gst-plugins-good gst-plugins-bad gst-plugins-ugly 2>/dev/null || true

    log_step "Disabling old PulseAudio..."
    systemctl --user --disable --now pulseaudio.service pulseaudio.socket 2>/dev/null || true

    log_step "Enabling PipeWire..."
    systemctl --user enable --now pipewire pipewire-pulse wireplumber 2>/dev/null || true

    log_step "Checking NVIDIA HDMI audio..."
    if lsmod | grep -q nvidia; then
        if ! lsmod | grep -q snd_hda_intel; then
            log_info "Loading snd_hda_intel for NVIDIA HDMI audio..."
            sudo modprobe snd_hda_intel 2>/dev/null || true
        fi
    fi

    log_success "Audio stack fixed - please reboot to apply changes"
    log_warn "After reboot, verify with: pactl info (should show 'PulseAudio (on PipeWire ...)')"
    log_warn "Then run pavucontrol to select correct output device (not the NZXT mic!)"
}
