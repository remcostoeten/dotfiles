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
kwriteconfig6 --file kwinrc --group TabBox --key LayoutName org.kde.breeze.desktop

log "Setting global animation duration factor to ${ANIMATION_FACTOR}..."
kwriteconfig6 --file kdeglobals --group KDE --key AnimationDurationFactor "$ANIMATION_FACTOR"

log "Reloading KWin..."
if reconfigure_kwin; then
    log "KWin reloaded live. Alt+Tab is now instant."
else
    log "Could not reach KWin over D-Bus. Changes apply on next login."
fi

log "Applied:"
printf '\n'
printf '  kwinrc    [TabBox]  HighlightWindows      = false\n'
printf '  kwinrc    [TabBox]  LayoutName            = org.kde.breeze.desktop\n'
printf '  kdeglobals[KDE]     AnimationDurationFactor = %s\n' "$ANIMATION_FACTOR"
printf '\n'
log "Override the factor with: KDE_ANIMATION_FACTOR=0.25 ./setup/fix-kde-alttab.sh"
