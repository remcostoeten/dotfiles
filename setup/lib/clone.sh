#!/bin/bash
set -euo pipefail

CLONE_STATE_DIR="$SCRIPT_DIR/state"
CLONE_KDE_FILES=(
    kdeglobals
    kglobalshortcutsrc
    kwinrc
    kwinrulesrc
    kcminputrc
    plasmarc
    krunnerrc
    kscreenlockerrc
    ksmserverrc
    dolphinrc
    spectaclerc
    konsolerc
)
CLONE_SKIP_PACKAGES=(webkit2gtk)
CLONE_NVIDIA_PACKAGES=(nvidia-open-dkms nvidia-utils nvidia-settings lib32-nvidia-utils cuda)
CLONE_RAZER_PACKAGES=(openrazer-daemon openrazer-driver-dkms python-openrazer polychromatic)
CLONE_BOARD_PACKAGES=(nct6687d-dkms-git)
CLONE_APP_PACKAGES=(
    go cmake qt6-base qt6-declarative qt6-multimedia layer-shell-qt gpu-screen-recorder ffmpeg libpulse
    webkit2gtk-4.1 gtk3 gtk-layer-shell libsoup3 pkgconf base-devel
)

board_name() {
    cat /sys/class/dmi/id/board_name 2>/dev/null || echo "unknown"
}

has_nvidia_gpu() {
    lspci 2>/dev/null | grep -qi nvidia
}

has_razer_device() {
    lsusb 2>/dev/null | grep -qi "ID 1532:"
}

cpu_vendor() {
    awk -F': ' '/^vendor_id/ { print $2; exit }' /proc/cpuinfo 2>/dev/null
}

same_board() {
    [[ -f "$CLONE_STATE_DIR/board" && "$(board_name)" == "$(cat "$CLONE_STATE_DIR/board")" ]]
}

in_list() {
    local needle="$1"
    shift
    local item
    for item in "$@"; do
        [[ "$item" == "$needle" ]] && return 0
    done
    return 1
}

package_fits_machine() {
    local pkg="$1"

    [[ "$pkg" == *-debug ]] && return 1
    in_list "$pkg" "${CLONE_SKIP_PACKAGES[@]}" && return 1
    if in_list "$pkg" "${CLONE_NVIDIA_PACKAGES[@]}"; then
        has_nvidia_gpu
        return
    fi
    if in_list "$pkg" "${CLONE_RAZER_PACKAGES[@]}"; then
        has_razer_device
        return
    fi
    if in_list "$pkg" "${CLONE_BOARD_PACKAGES[@]}"; then
        same_board
        return
    fi
    case "$pkg" in
        intel-ucode) [[ "$(cpu_vendor)" == "GenuineIntel" ]] ;;
        amd-ucode) [[ "$(cpu_vendor)" == "AuthenticAMD" ]] ;;
        *) return 0 ;;
    esac
}

exec_target() {
    local file="$1"
    local key="$2"
    local line
    line="$(grep -m1 "^$key=" "$file" 2>/dev/null)" || return 1
    line="${line#*=}"
    line="${line#-}"
    line="${line#/usr/bin/env }"
    while [[ "$line" =~ ^[A-Za-z_]+= ]]; do
        line="${line#* }"
    done
    line="${line%% *}"
    line="${line//\"/}"
    line="${line//%h/$HOME}"
    printf '%s\n' "$line"
}

target_exists() {
    local target="$1"
    [[ -z "$target" ]] && return 0
    if [[ "$target" == /* ]]; then
        [[ -x "$target" ]]
    else
        command -v "$target" >/dev/null 2>&1
    fi
}

snapshot_machine() {
    local dotfiles_root
    dotfiles_root="$(cd "$SCRIPT_DIR/.." && pwd)"

    log_info "Saving this machine's state to $CLONE_STATE_DIR"
    rm -rf "$CLONE_STATE_DIR"
    mkdir -p "$CLONE_STATE_DIR/kde" "$CLONE_STATE_DIR/autostart"

    board_name >"$CLONE_STATE_DIR/board"
    pacman -Qqen >"$CLONE_STATE_DIR/repo-packages.txt"
    pacman -Qqem >"$CLONE_STATE_DIR/aur-packages.txt"
    if grep -q '^\[chaotic-aur\]' /etc/pacman.conf 2>/dev/null; then
        touch "$CLONE_STATE_DIR/chaotic-aur"
    fi
    log_success "Package lists saved ($(wc -l <"$CLONE_STATE_DIR/repo-packages.txt") repo, $(wc -l <"$CLONE_STATE_DIR/aur-packages.txt") AUR)"

    local file
    for file in "${CLONE_KDE_FILES[@]}"; do
        [[ -f "$HOME/.config/$file" ]] || continue
        if [[ "$file" == "kwinrc" ]]; then
            # Drop [Tiling] groups: their UUIDs belong to this machine's monitors.
            awk '/^\[/ { skip = ($0 ~ /^\[Tiling\]/) } !skip' "$HOME/.config/$file" >"$CLONE_STATE_DIR/kde/$file"
        else
            cp "$HOME/.config/$file" "$CLONE_STATE_DIR/kde/$file"
        fi
    done
    log_success "KDE settings saved ($(ls "$CLONE_STATE_DIR/kde" | wc -l) files)"

    local entry
    for entry in "$HOME/.config/autostart"/*.desktop; do
        [[ -f "$entry" && ! -L "$entry" ]] || continue
        cp "$entry" "$CLONE_STATE_DIR/autostart/"
    done
    log_success "Autostart entries saved ($(ls "$CLONE_STATE_DIR/autostart" | wc -l) files)"

    systemctl --user list-unit-files --state=enabled --no-legend 2>/dev/null |
        awk '{ print $1 }' >"$CLONE_STATE_DIR/user-units.txt"
    log_success "User services saved ($(wc -l <"$CLONE_STATE_DIR/user-units.txt") enabled)"

    log_info "Review and commit: git -C $dotfiles_root status setup/state"
}

restore_chaotic_aur() {
    [[ -f "$CLONE_STATE_DIR/chaotic-aur" ]] || return 0
    if grep -q '^\[chaotic-aur\]' /etc/pacman.conf; then
        log_success "Chaotic-AUR already enabled"
        return 0
    fi

    log_step "Enabling Chaotic-AUR..."
    if [[ "$DRY_RUN" == "true" ]]; then
        log_dry_run "import Chaotic-AUR key, install keyring and mirrorlist, add [chaotic-aur] to /etc/pacman.conf"
        return 0
    fi

    sudo pacman-key --recv-key 3056513887B78AEB --keyserver keyserver.ubuntu.com >/dev/null 2>&1 || return 1
    sudo pacman-key --lsign-key 3056513887B78AEB >/dev/null 2>&1 || return 1
    sudo pacman -U --noconfirm \
        'https://cdn-mirror.chaotic.cx/chaotic-aur/chaotic-keyring.pkg.tar.zst' \
        'https://cdn-mirror.chaotic.cx/chaotic-aur/chaotic-mirrorlist.pkg.tar.zst' >/dev/null 2>&1 || return 1
    printf '\n[chaotic-aur]\nInclude = /etc/pacman.d/chaotic-mirrorlist\n' | sudo tee -a /etc/pacman.conf >/dev/null
    sudo pacman -Sy >/dev/null 2>&1 || return 1
    log_success "Chaotic-AUR enabled"
}

aur_helper() {
    if command -v yay >/dev/null 2>&1; then
        echo "yay"
    elif command -v paru >/dev/null 2>&1; then
        echo "paru"
    else
        return 1
    fi
}

restore_packages() {
    [[ -f "$CLONE_STATE_DIR/repo-packages.txt" ]] || return 0

    local available installed pkg
    available="$(pacman -Slq 2>/dev/null | sort -u)"
    installed="$(pacman -Qq 2>/dev/null | sort -u)"

    local repo_wanted=() aur_wanted=() skipped=()
    while read -r pkg; do
        [[ -n "$pkg" ]] || continue
        if ! package_fits_machine "$pkg"; then
            skipped+=("$pkg")
        elif grep -qxF "$pkg" <<<"$installed"; then
            continue
        elif grep -qxF "$pkg" <<<"$available"; then
            repo_wanted+=("$pkg")
        else
            aur_wanted+=("$pkg")
        fi
    done < <(cat "$CLONE_STATE_DIR/repo-packages.txt" "$CLONE_STATE_DIR/aur-packages.txt")

    if ((${#skipped[@]} > 0)); then
        log_info "Skipping ${#skipped[@]} package(s) that don't fit this machine: ${skipped[*]}"
    fi

    if ((${#repo_wanted[@]} > 0)); then
        log_step "Installing ${#repo_wanted[@]} repo package(s)..."
        if [[ "$DRY_RUN" == "true" ]]; then
            log_dry_run "sudo pacman -S --needed --noconfirm ${repo_wanted[*]}"
        elif ! sudo pacman -S --needed --noconfirm "${repo_wanted[@]}"; then
            log_warn "Batch install failed; retrying one package at a time"
            for pkg in "${repo_wanted[@]}"; do
                sudo pacman -S --needed --noconfirm "$pkg" >/dev/null 2>&1 || log_warn "Could not install $pkg"
            done
        fi
    else
        log_success "All repo packages already installed"
    fi

    ((${#aur_wanted[@]} > 0)) || {
        log_success "All AUR packages already installed"
        return 0
    }

    local helper
    if ! helper="$(aur_helper)"; then
        install_paru || return 1
        helper="paru"
    fi

    log_step "Building ${#aur_wanted[@]} AUR package(s) with $helper..."
    local failed=()
    for pkg in "${aur_wanted[@]}"; do
        if [[ "$DRY_RUN" == "true" ]]; then
            log_dry_run "$helper -S --needed --noconfirm $pkg"
        elif ! "$helper" -S --needed --noconfirm "$pkg"; then
            failed+=("$pkg")
        fi
    done
    if ((${#failed[@]} > 0)); then
        log_warn "AUR packages that failed: ${failed[*]}"
        return 1
    fi
    log_success "AUR packages installed"
}

restore_kde_state() {
    [[ -d "$CLONE_STATE_DIR/kde" ]] || return 0
    command -v plasmashell >/dev/null 2>&1 || {
        log_info "Plasma not installed; skipping KDE settings"
        return 0
    }

    ensure_setup_backup_root
    local src name dst changed=0
    for src in "$CLONE_STATE_DIR/kde"/*; do
        [[ -f "$src" ]] || continue
        name="$(basename "$src")"
        dst="$HOME/.config/$name"
        cmp -s "$src" "$dst" && continue
        changed=$((changed + 1))
        if [[ "$DRY_RUN" == "true" ]]; then
            log_dry_run "cp $src $dst"
            continue
        fi
        if [[ -e "$dst" ]]; then
            mkdir -p "$SETUP_BACKUP_ROOT/kde"
            cp -a "$dst" "$SETUP_BACKUP_ROOT/kde/$name"
        fi
        cp "$src" "$dst"
    done
    log_success "KDE settings restored ($changed changed)"
}

restore_autostart() {
    [[ -d "$CLONE_STATE_DIR/autostart" ]] || return 0
    mkdir -p "$HOME/.config/autostart"

    local src name target
    for src in "$CLONE_STATE_DIR/autostart"/*.desktop; do
        [[ -f "$src" ]] || continue
        name="$(basename "$src")"
        target="$(exec_target "$src" Exec || true)"
        if ! grep -q '^Hidden=true' "$src" && ! target_exists "$target"; then
            log_warn "Skipping autostart $name: $target is not installed"
            continue
        fi
        if [[ "$DRY_RUN" == "true" ]]; then
            log_dry_run "cp $src $HOME/.config/autostart/$name"
        else
            cp "$src" "$HOME/.config/autostart/$name"
        fi
    done
    log_success "Autostart entries restored"
}

restore_user_units() {
    [[ -f "$CLONE_STATE_DIR/user-units.txt" ]] || return 0
    [[ "$DRY_RUN" == "true" ]] || systemctl --user daemon-reload

    local unit fragment target service
    while read -r unit; do
        [[ -n "$unit" ]] || continue
        systemctl --user is-enabled "$unit" >/dev/null 2>&1 && continue
        fragment="$(systemctl --user show -P FragmentPath "$unit" 2>/dev/null || true)"
        [[ -n "$fragment" ]] || continue
        service="$fragment"
        [[ "$unit" == *.timer ]] && service="${fragment%.timer}.service"
        target="$(exec_target "$service" ExecStart || true)"
        if ! target_exists "$target"; then
            log_warn "Skipping $unit: $target is not installed"
            continue
        fi
        if [[ "$DRY_RUN" == "true" ]]; then
            log_dry_run "systemctl --user enable $unit"
        else
            systemctl --user enable "$unit" >/dev/null 2>&1 || log_warn "Could not enable $unit"
        fi
    done <"$CLONE_STATE_DIR/user-units.txt"
    log_success "User services restored"
}

ensure_github_login() {
    gh auth status >/dev/null 2>&1 && return 0
    if [[ ! -t 0 ]]; then
        log_warn "Not logged in to GitHub; run gh auth login and re-run setup"
        return 1
    fi
    log_step "Log in to GitHub to clone your private apps..."
    gh auth login --git-protocol https --web
}

clone_own_repo() {
    local repo="$1"
    local dir="$2"

    if [[ -d "$dir/.git" ]]; then
        log_success "$repo already cloned at $dir"
        return 0
    fi
    if [[ "$DRY_RUN" == "true" ]]; then
        log_dry_run "gh repo clone $repo $dir"
        return 0
    fi
    mkdir -p "$(dirname "$dir")"
    gh repo clone "$repo" "$dir" >/dev/null 2>&1 || {
        log_error "Could not clone $repo"
        return 1
    }
}

install_kearn() {
    local dir="$HOME/apps/kearn"
    if [[ -x "$HOME/.local/bin/kearnd" ]]; then
        log_success "Kearn already installed"
        return 0
    fi
    clone_own_repo remcostoeten/kearn "$dir" || return 1

    log_step "Building and installing Kearn..."
    if [[ "$DRY_RUN" == "true" ]]; then
        log_dry_run "cd $dir && bun install && bun run install:local --system"
        return 0
    fi
    (cd "$dir" && bun install && bun run install:local --system) || {
        log_error "Kearn install failed; see the output above"
        return 1
    }
    log_success "Kearn installed"
}

install_remcorder() {
    local dir="$HOME/experimens/remcorder"
    if [[ -x "$HOME/.local/bin/remcorderd" ]]; then
        log_success "Remcorder already installed"
        return 0
    fi
    clone_own_repo remcostoeten/remcorder "$dir" || return 1

    log_step "Building and installing Remcorder..."
    if [[ "$DRY_RUN" == "true" ]]; then
        log_dry_run "make -C $dir install"
        return 0
    fi
    make -C "$dir" install || {
        log_error "Remcorder install failed; see the output above"
        return 1
    }
    log_success "Remcorder installed"
}

install_kiekje() {
    if command -v kiekje >/dev/null 2>&1; then
        log_success "Kiekje already installed"
        return 0
    fi

    local helper
    if ! helper="$(aur_helper)"; then
        install_paru || return 1
        helper="paru"
    fi
    log_step "Installing Kiekje..."
    if [[ "$DRY_RUN" == "true" ]]; then
        log_dry_run "$helper -S --needed --noconfirm kiekje-bin"
        return 0
    fi
    "$helper" -S --needed --noconfirm kiekje-bin || return 1
    log_success "Kiekje installed"
}

install_own_apps() {
    local pkg
    for pkg in "${CLONE_APP_PACKAGES[@]}" github-cli; do
        install_apt "$pkg" || return 1
    done
    export PATH="$HOME/.cargo/bin:$HOME/.bun/bin:$HOME/.local/bin:$PATH"
    for tool in bun cargo; do
        command -v "$tool" >/dev/null 2>&1 || [[ "$DRY_RUN" == "true" ]] || {
            log_error "$tool not found; the langs step installs it"
            return 1
        }
    done

    try install_kiekje
    if [[ "$DRY_RUN" == "true" ]] || ensure_github_login; then
        try install_kearn
        try install_remcorder
    fi
}

apply_pocket_theme() {
    local apply="$SCRIPT_DIR/../configs/kde/pocket/apply.sh"
    [[ -x "$apply" ]] || return 0
    command -v plasmashell >/dev/null 2>&1 || return 0
    if [[ -z "${WAYLAND_DISPLAY:-}${DISPLAY:-}" ]]; then
        log_warn "Skipping Pocket theme: run setup from inside a Plasma session"
        return 0
    fi

    log_step "Applying Pocket theme..."
    if [[ "$DRY_RUN" == "true" ]]; then
        log_dry_run "$apply"
        return 0
    fi
    "$apply"
}

restore_machine() {
    if [[ "$(detect_os_family)" != "arch" ]]; then
        log_info "Skipping machine clone: only supported on Arch"
        return 0
    fi
    if [[ ! -f "$CLONE_STATE_DIR/repo-packages.txt" ]]; then
        log_info "No snapshot in $CLONE_STATE_DIR; run setup.sh --snapshot on the source machine first"
        return 0
    fi

    try restore_chaotic_aur
    try restore_packages
    try install_own_apps
    try restore_kde_state
    try restore_autostart
    try install_quickshell_bar
    try apply_pocket_theme
    try restore_user_units
}
