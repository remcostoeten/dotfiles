#!/usr/bin/env bash
set -euo pipefail

log() {
    printf '[fix-kde-alttab] %s\n' "$*"
}

if ! command -v kwriteconfig6 >/dev/null 2>&1; then
    log "kwriteconfig6 not found. This script targets KDE Plasma 6."
    exit 1
fi

# Makes KDE's Alt+Tab feel instant by removing the per-step desktop-dim
# highlight animation and shrinking the global animation duration.
ANIMATION_FACTOR="${KDE_ANIMATION_FACTOR:-0.1}"

reconfigure_kwin() {
    if command -v qdbus6 >/dev/null 2>&1; then
        qdbus6 org.kde.KWin /KWin reconfigure >/dev/null 2>&1 && return 0
    fi
    if command -v qdbus >/dev/null 2>&1; then
        qdbus org.kde.KWin /KWin reconfigure >/dev/null 2>&1 && return 0
    fi
    return 1
}

log "Disabling Alt+Tab window-highlight animation (the main lag source)..."
kwriteconfig6 --file kwinrc --group TabBox --key HighlightWindows false
kwriteconfig6 --file kwinrc --group TabBoxAlternative --key HighlightWindows false

install_recent_desktops_layout() {
    local src dest
    src="$(cd "$(dirname "${BASH_SOURCE[0]}")/../configs/kde/tabbox/recent_desktops" && pwd)"
    dest="$HOME/.local/share/kwin/tabbox/recent_desktops"
    mkdir -p "$(dirname "$dest")"
    ln -sfn "$src" "$dest"
}

log "Alt+Tab lists every desktop, Meta+Tab lists the current and last visited desktop..."
install_recent_desktops_layout
kwriteconfig6 --file kwinrc --group TabBoxAlternative --key LayoutName recent_desktops
kwriteconfig6 --file kwinrc --group TabBox --key DesktopMode 0
kwriteconfig6 --file kwinrc --group TabBoxAlternative --key DesktopMode 0
kwriteconfig6 --file kwinrc --group Windows --key ActivationDesktopPolicy 0

set_kwin_shortcut() {
    local action="$1"
    shift
    # flags 6 = SetPresent | NoAutoloading, otherwise the daemon keeps the saved keys
    busctl --user call org.kde.kglobalaccel /kglobalaccel org.kde.KGlobalAccel \
        setShortcut asaiu 4 kwin "$action" "" "" "$#" "$@" 6 >/dev/null 2>&1
}

bind_switcher_shortcuts() {
    local alt=134217728 meta=268435456 shift=33554432 tab=16777217
    set_kwin_shortcut "Walk Through Windows" $((alt + tab)) &&
        set_kwin_shortcut "Walk Through Windows (Reverse)" $((alt + shift + tab)) &&
        set_kwin_shortcut "Walk Through Windows Alternative" $((meta + tab)) &&
        set_kwin_shortcut "Walk Through Windows Alternative (Reverse)" $((meta + shift + tab))
}

log "Binding Alt+Tab to the all desktops switcher and Meta+Tab to the recent desktops switcher..."
if bind_switcher_shortcuts; then
    log "Switcher shortcuts registered live."
else
    log "Could not reach kglobalaccel over D-Bus. Switcher shortcuts not bound."
fi

bind_desktop_shortcuts() {
    local n alt keys
    for n in 1 2 3 4 5 6 7 8 9; do
        # Qt key code: Alt modifier (0x08000000) plus the ASCII digit
        alt=$((134217728 + 48 + n))
        mapfile -t keys < <(busctl --user call org.kde.kglobalaccel /kglobalaccel org.kde.KGlobalAccel \
            shortcutKeys as 4 kwin "Switch to Desktop $n" "" "" 2>/dev/null \
            | awk '{for (i = 4; i <= NF; i += 5) if ($(i) != 0) print $(i)}')
        keys=("$alt" "${keys[@]/#$alt/}")
        keys=("${keys[@]//[^0-9]/}")
        keys=($(printf '%s\n' "${keys[@]}" | awk 'NF && !seen[$0]++'))
        set_kwin_shortcut "Switch to Desktop $n" "${keys[@]}" || return 1
    done
}

log "Binding Alt+1..9 to Switch to Desktop 1..9..."
if bind_desktop_shortcuts; then
    log "Desktop shortcuts registered live."
else
    log "Could not reach kglobalaccel over D-Bus. Desktop shortcuts not bound."
fi

log "Setting global animation duration factor to ${ANIMATION_FACTOR}..."
kwriteconfig6 --file kdeglobals --group KDE --key AnimationDurationFactor "$ANIMATION_FACTOR"

install_move_follow_script() {
    local src dest
    src="$(cd "$(dirname "${BASH_SOURCE[0]}")/../configs/kde/kwin-scripts/movetodesktopfollow" && pwd)"
    dest="$HOME/.local/share/kwin/scripts/movetodesktopfollow"
    mkdir -p "$(dirname "$dest")"
    if [ ! -L "$dest" ] || [ "$(readlink -f "$dest")" != "$src" ]; then
        rm -rf "$dest"
        ln -s "$src" "$dest"
    fi
    kwriteconfig6 --file kwinrc --group Plugins --key movetodesktopfollowEnabled true
    if command -v qdbus6 >/dev/null 2>&1; then
        qdbus6 org.kde.KWin /Scripting org.kde.kwin.Scripting.unloadScript movetodesktopfollow >/dev/null 2>&1 || true
        qdbus6 org.kde.KWin /Scripting org.kde.kwin.Scripting.loadScript "$dest/contents/code/main.js" movetodesktopfollow >/dev/null 2>&1 || return 1
        qdbus6 org.kde.KWin /Scripting org.kde.kwin.Scripting.start >/dev/null 2>&1 || return 1
    fi
}

log "Installing KWin script: Alt+Shift+1..9 moves the window to that desktop and follows it..."
if install_move_follow_script; then
    log "Move-and-follow script installed and loaded."
else
    log "Move-and-follow script installed. Could not load it live, it starts on next login."
fi

install_run_or_raise_script() {
    local src dest unit
    src="$(cd "$(dirname "${BASH_SOURCE[0]}")/../configs/kde/kwin-scripts/runorraise" && pwd)"
    dest="$HOME/.local/share/kwin/scripts/runorraise"
    unit="$HOME/.config/systemd/user/runorraise-launch@.service"
    mkdir -p "$(dirname "$dest")" "$(dirname "$unit")"
    ln -sfn "$src" "$dest"
    ln -sfn "$src/runorraise-launch@.service" "$unit"
    systemctl --user daemon-reload >/dev/null 2>&1 || true
    kwriteconfig6 --file kwinrc --group Plugins --key runorraiseEnabled true
    if command -v qdbus6 >/dev/null 2>&1; then
        qdbus6 org.kde.KWin /Scripting org.kde.kwin.Scripting.unloadScript runorraise >/dev/null 2>&1 || true
        qdbus6 org.kde.KWin /Scripting org.kde.kwin.Scripting.loadScript "$dest/contents/code/main.js" runorraise >/dev/null 2>&1 || return 1
        qdbus6 org.kde.KWin /Scripting org.kde.kwin.Scripting.start >/dev/null 2>&1 || return 1
    fi
}

log "Installing KWin script: Alt+B focuses Brave, cycles its windows, or launches it..."
if install_run_or_raise_script; then
    log "Run-or-raise script installed and loaded."
else
    log "Run-or-raise script installed. Could not load it live, it starts on next login."
fi

log "Reloading KWin..."
if reconfigure_kwin; then
    log "KWin reloaded live. Alt+Tab is now instant."
else
    log "Could not reach KWin over D-Bus. Changes apply on next login."
fi

log "Applied:"
printf '\n'
printf '  kwinrc    [TabBox]  HighlightWindows      = false\n'
printf '  kwinrc    [TabBoxAlternative] LayoutName  = recent_desktops (current + last visited desktop)\n'
printf '  kwinrc    [TabBox]  DesktopMode           = 0 (all desktops)\n'
printf '  kwinrc    [TabBoxAlternative] DesktopMode = 0 (the layout filters desktops)\n'
printf '  kwinrc    [Windows] ActivationDesktopPolicy = 0 (switch to desktop)\n'
printf '  kglobalshortcutsrc [kwin] Walk Through Windows             = Alt+Tab (all desktops)\n'
printf '  kglobalshortcutsrc [kwin] Walk Through Windows Alternative = Meta+Tab (current + last visited desktop)\n'
printf '  kglobalshortcutsrc [kwin] Switch to Desktop N  = Alt+N (1..9)\n'
printf '  kwin script  movetodesktopfollow           = Alt+Shift+N moves window and follows (1..9)\n'
printf '  kwin script  runorraise                    = Alt+B focuses, cycles or launches Brave\n'
printf '  kdeglobals[KDE]     AnimationDurationFactor = %s\n' "$ANIMATION_FACTOR"
printf '\n'
log "Override the factor with: KDE_ANIMATION_FACTOR=0.25 ./setup/fix-kde-alttab.sh"
