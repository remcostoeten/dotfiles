#!/bin/bash
set -euo pipefail

install_apt() {
    local pkg="$1"
    local name="${2:-$pkg}"
    
    if dpkg -l 2>/dev/null | grep -q "^ii  $pkg "; then
        log_success "$name already installed"
        return 0
    fi
    
    log_step "Installing $name..."
    if [[ "$DRY_RUN" == "true" ]]; then
        echo -e "\033[0;36m[DRY RUN]\033[0m Would run: sudo apt install -y $pkg"
    else
        sudo apt install -y -qq "$pkg" 2>&1 | grep -v "^Reading" | grep -v "^Building" | grep -v "^0 upgraded" | grep -v "already the newest" | grep -v "set to manually" | grep -v "no longer required" | grep -v "autoremove" | grep -v "WARNING" | grep -v "nvidia-firmware" | grep -v "ocl-icd" || true
    fi
    log_success "$name installed"
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
        sudo snap install $flags "$pkg" 2>&1 | grep -v "Spawned" || true
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
        sudo npm install -g "$pkg" --silent 2>&1 | grep -v "npm warn" || true
    fi
    log_success "$name installed"
}

install_curl() {
    local url="$1"
    local name="$2"
    local shell="${3:-bash}"
    local shell_flags="${4:-}"
    
    if exists "$name"; then
        log_success "$name already installed"
        return 0
    fi
    
    log_step "Installing $name..."
    if [[ "$DRY_RUN" == "true" ]]; then
        echo -e "\033[0;36m[DRY RUN]\033[0m Would run: curl -fsSL $url | $shell $shell_flags"
    else
        if [[ "$VERBOSE" == "true" ]]; then
            curl -fsSL "$url" | $shell $shell_flags
        else
            curl -fsSL "$url" 2>/dev/null | $shell $shell_flags 2>/dev/null || log_warn "$name may not have installed correctly"
        fi
    fi
    
    if exists "$name"; then
        log_success "$name installed"
    else
        log_success "$name installed"
    fi
}

setup_starship_config() {
    local starship_config_src="$SCRIPT_DIR/../configs/starship/starship.toml"
    local starship_config_dst="$HOME/.config/starship.toml"
    
    if [[ -L "$starship_config_dst" ]]; then
        return 0
    fi
    
    if [[ -f "$starship_config_src" ]]; then
        ln -sf "$starship_config_src" "$starship_config_dst" 2>/dev/null || true
    fi
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

setup_config_symlinks() {
    local configs_dir="$SCRIPT_DIR/../configs"
    local home_config_dir="$HOME/.config"
    
    mkdir -p "$home_config_dir"
    
    local configs=(
        "nvim:$home_config_dir/nvim"
        "starship/starship.toml:$home_config_dir/starship.toml"
        "ghostty:$home_config_dir/ghostty"
        "fish:$HOME/.config/fish"
        "zsh:$HOME/.config/zsh"
        "bash:$HOME/.config/bash"
        "zed:$HOME/.config/zed"
        "cursor:$HOME/.config/cursor"
    )
    
    for item in "${configs[@]}"; do
        local src="${item%%:*}"
        local dst="${item##*:}"
        local src_path="$configs_dir/$src"
        local dst_path="$dst"
        
        if [[ -e "$src_path" ]] && [[ ! -L "$dst_path" ]]; then
            ln -sf "$src_path" "$dst_path" 2>/dev/null || true
        fi
    done

    # Ghostty loads themes from ~/.config/ghostty/themes (not from the main config file path).
    local ghostty_themes_src="$configs_dir/ghostty/themes"
    local ghostty_themes_dst="$home_config_dir/ghostty/themes"
    if [[ -d "$ghostty_themes_src" ]]; then
        mkdir -p "$home_config_dir/ghostty"
        if [[ ! -e "$ghostty_themes_dst" || -L "$ghostty_themes_dst" ]]; then
            ln -sf "$ghostty_themes_src" "$ghostty_themes_dst" 2>/dev/null || true
        else
            cp -n "$ghostty_themes_src"/* "$ghostty_themes_dst"/ 2>/dev/null || true
        fi
    fi
    
    local git_src="$configs_dir/git/.gitconfig"
    local git_dst="$HOME/.gitconfig"
    if [[ -f "$git_src" ]] && [[ ! -L "$git_dst" ]]; then
        ln -sf "$git_src" "$git_dst" 2>/dev/null || true
    fi

    setup_runtime_permissions
    
    log_success "Config symlinks created"
}

install_github() {
    local repo="$1"
    local name="${2:-${repo##*/}}"
    local target_dir="${3:-$name}"
    
    if command -v "$name" &>/dev/null; then
        log_success "$name already installed"
        return 0
    fi
    
    log_step "Installing $name..."
    if [[ "$DRY_RUN" == "true" ]]; then
        echo -e "\033[0;36m[DRY RUN]\033[0m Would run: gh repo clone $repo $target_dir"
    else
        gh repo clone "$repo" "$target_dir" 2>&1 | grep -v "Cloning" | grep -v "warning:" || true
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
    
    spinner_start "Downloading fonts..."
    
    local pids=()
    
    (
        local zip_path="/tmp/ComicShannsMono.zip"
        curl -fL "https://github.com/ryanoasis/nerd-fonts/releases/latest/download/ComicShannsMono.zip" -o "$zip_path" 2>/dev/null
        unzip -o "$zip_path" -d "$font_dir/NerdFonts" 2>/dev/null
        rm -f "$zip_path"
    ) &
    pids+=($!)
    
    (
        local zip_path="/tmp/geist-font.zip"
        curl -fL "https://github.com/vercel/geist-font/releases/download/1.8.0/geist-font-1.8.0.zip" -o "$zip_path" 2>/dev/null
        unzip -o "$zip_path" -d "$font_dir" 2>/dev/null
        rm -f "$zip_path"
    ) &
    pids+=($!)
    
    (
        local zip_path="/tmp/Inter.zip"
        curl -fL "https://github.com/rsms/inter/releases/download/v4.1/Inter-4.1.zip" -o "$zip_path" 2>/dev/null
        unzip -o "$zip_path" -d "$font_dir" 2>/dev/null
        rm -f "$zip_path"
    ) &
    pids+=($!)
    
    (
        local zip_path="/tmp/jetbrains-mono.zip"
        curl -fL "https://github.com/JetBrains/JetBrainsMono/releases/download/v2.304/JetBrainsMono-2.304.zip" -o "$zip_path" 2>/dev/null
        unzip -o "$zip_path" -d "$font_dir" 2>/dev/null
        rm -f "$zip_path"
    ) &
    pids+=($!)
    
    (
        local zip_path="/tmp/ibm-plex-mono.zip"
        curl -fL "https://github.com/IBM/plex/releases/download/%40ibm/plex-mono%401.1.0/ibm-plex-mono.zip" -o "$zip_path" 2>/dev/null
        unzip -o "$zip_path" -d "$font_dir" 2>/dev/null
        rm -f "$zip_path"
    ) &
    pids+=($!)
    
    (
        local zip_path="/tmp/Hack.zip"
        curl -fL "https://github.com/ryanoasis/nerd-fonts/releases/latest/download/Hack.zip" -o "$zip_path" 2>/dev/null
        unzip -o "$zip_path" -d "$font_dir/NerdFonts" 2>/dev/null
        rm -f "$zip_path"
    ) &
    pids+=($!)
    
    for pid in "${pids[@]}"; do
        wait "$pid" 2>/dev/null || true
    done
    
    spinner_stop
    fc-cache -f 2>/dev/null
    
    log_success "All fonts installed"
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
    
    local tmp_deb="/tmp/ghostty.deb"
    local ubuntu_version=$(lsb_release -rs 2>/dev/null || echo "24.04")
    local deb_name="ghostty_1.3.1-0.ppa1_amd64_${ubuntu_version}.deb"
    local download_url="https://github.com/mkasberg/ghostty-ubuntu/releases/download/1.3.1-0-ppa1/${deb_name}"
    curl -fsSL "$download_url" -o "$tmp_deb"
    sudo apt install -y -qq "$tmp_deb" 2>/dev/null
    rm -f "$tmp_deb"
    
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
    
    sudo apt install -y -qq wget gpg 2>/dev/null
    wget -qO- https://packages.microsoft.com/keys/microsoft.asc | sudo gpg --dearmor -o /usr/share/keyrings/microsoft.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/microsoft.gpg] https://packages.microsoft.com/repos/vscode stable main" | sudo tee /etc/apt/sources.list.d/vscode.list
    sudo apt update -qq 2>/dev/null
    sudo apt install -y -qq code 2>/dev/null
    
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
        local tmp_deb="/tmp/opencode.deb"
        curl -fsSL https://opencode.ai/download/stable/linux-x64-deb -o "$tmp_deb"
        sudo apt install -y "$tmp_deb"
        rm -f "$tmp_deb"
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
    curl -sSL https://dot.net/v1/dotnet-install.sh -o "$dotnet_install_script"
    chmod +x "$dotnet_install_script"
    "$dotnet_install_script" --channel 9.0
    
    log_success ".NET SDK installed"
}
