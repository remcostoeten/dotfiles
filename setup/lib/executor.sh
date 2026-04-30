#!/bin/bash
set -euo pipefail

run() {
    if [[ "$VERBOSE" == "true" ]]; then
        "$@"
    else
        set +e
        "$@" 2>&1 | grep -v "^Reading" | grep -v "^Building" | grep -v "^0 upgraded" | grep -v "already the newest" | grep -v "set to manually" | grep -v "no longer required" | grep -v "autoremove" | grep -v "WARNING"
        local command_status=${PIPESTATUS[0]}
        set -e
        return "$command_status"
    fi
}

exists() {
    local name="$1"

    case "$name" in
        rustup)
            command -v rustup >/dev/null 2>&1 || command -v cargo >/dev/null 2>&1
            ;;
        *)
            command -v "$name" >/dev/null 2>&1
            ;;
    esac
}
