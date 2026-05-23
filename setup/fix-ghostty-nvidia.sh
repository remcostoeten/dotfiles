#!/usr/bin/env bash
set -euo pipefail

log() {
    printf '[fix-ghostty] %s\n' "$*"
}

if ! command -v pacman >/dev/null 2>&1; then
    log "This fix script is for Arch/pacman systems."
    exit 1
fi

enable_multilib() {
    if pacman -Sl multilib >/dev/null 2>&1; then
        log "multilib repository is already enabled."
        return 0
    fi

    log "Enabling multilib repository for Steam/Wine 32-bit graphics libraries..."
    sudo cp /etc/pacman.conf /etc/pacman.conf.bak.$(date +%Y%m%d%H%M%S)
    sudo sed -i \
        -e '/^#\[multilib\]/,/^#Include = \/etc\/pacman.d\/mirrorlist/ s/^#//' \
        /etc/pacman.conf
}

enable_multilib

log "Syncing package databases and upgrading system packages..."
sudo pacman -Syu --noconfirm

packages=(
    nvidia-open
    nvidia-utils
    lib32-nvidia-utils
    nvidia-settings
    vulkan-icd-loader
    lib32-vulkan-icd-loader
    vulkan-tools
    mesa-demos
    steam
    lutris
    gamemode
    lib32-gamemode
    mangohud
    lib32-mangohud
    goverlay
    gamescope
    wine
    winetricks
    protontricks
)

log "Installing NVIDIA drivers, Vulkan support, and gaming packages..."
sudo pacman -S --needed --noconfirm "${packages[@]}"

log "Validating Ghostty config..."
if command -v ghostty >/dev/null 2>&1; then
    ghostty +validate-config
else
    log "Ghostty is not installed or not on PATH."
fi

log "Done. Reboot now so Xorg loads the NVIDIA driver:"
printf '\n'
printf '  reboot\n'
printf '\n'
log "After reboot, verify with:"
printf '\n'
printf '  lspci -k | grep -A4 -i vga\n'
printf '  glxinfo -B\n'
printf '  ghostty\n'
printf '\n'
log "Expected: lspci shows 'Kernel driver in use: nvidia' and glxinfo does not show llvmpipe."
