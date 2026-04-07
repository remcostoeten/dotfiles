#!/bin/bash
set -euo pipefail

run() {
    if [[ "$VERBOSE" == "true" ]]; then
        "$@"
    else
        "$@" 2>&1 | grep -v "^Reading" | grep -v "^Building" | grep -v "^0 upgraded" | grep -v "already the newest" | grep -v "set to manually" | grep -v "no longer required" | grep -v "autoremove" | grep -v "WARNING" || true
    fi
}

exists() {
    command -v "$1" &>/dev/null
}
