#!/bin/bash
set -uo pipefail

FAILURES=0

pass() { printf '\033[1;32mPASS\033[0m %s\n' "$1"; }
fail() { printf '\033[1;31mFAIL\033[0m %s\n' "$1"; FAILURES=$((FAILURES + 1)); }
info() { printf '\033[1;34mINFO\033[0m %s\n' "$1"; }

check_keyd_binary() {
    if command -v keyd >/dev/null 2>&1; then
        local version
        version="$(keyd -v 2>&1 | head -n1 || true)"
        pass "keyd binary found (${version:-version unknown})"
    else
        fail "keyd binary not found on PATH"
    fi
}

check_keyd_service() {
    if ! command -v systemctl >/dev/null 2>&1; then
        fail "systemctl not available, cannot check keyd service"
        return
    fi
    if systemctl is-enabled --quiet keyd 2>/dev/null; then
        pass "keyd service enabled"
    else
        fail "keyd service not enabled"
    fi
    if systemctl is-active --quiet keyd 2>/dev/null; then
        pass "keyd service active"
    else
        fail "keyd service not active"
    fi
}

check_helper() {
    local path="/usr/bin/keybind-manager-helper"
    if [[ -x "$path" ]]; then
        pass "helper present and executable at $path"
    else
        fail "helper missing or not executable at $path"
    fi
}

check_polkit_policy() {
    local path="/usr/share/polkit-1/actions/org.remcostoeten.keybind-manager.policy"
    if [[ -f "$path" ]]; then
        pass "polkit policy present at $path"
    else
        fail "polkit policy missing at $path"
    fi
}

check_pkexec() {
    if command -v pkexec >/dev/null 2>&1; then
        pass "pkexec present"
    else
        fail "pkexec not found on PATH"
    fi
}

check_polkit_agent() {
    local agents=(
        "polkit-gnome-authentication-agent-1"
        "polkit-kde-authentication-agent-1"
        "polkit-mate-authentication-agent-1"
        "lxpolkit"
        "lxqt-policykit-agent"
        "xfce-polkit"
        "ksshaskpass"
    )
    local found=""
    for agent in "${agents[@]}"; do
        if pgrep -x "$agent" >/dev/null 2>&1; then
            found="$agent"
            break
        fi
    done
    if [[ -n "$found" ]]; then
        pass "polkit authentication agent running ($found)"
    else
        fail "no known polkit authentication agent running"
    fi
}

check_session_type() {
    local session_type="${XDG_SESSION_TYPE:-}"
    if [[ -z "$session_type" ]] && command -v loginctl >/dev/null 2>&1; then
        session_type="$(loginctl show-session "$(loginctl show-user "$(id -un)" -p Display --value 2>/dev/null)" -p Type --value 2>/dev/null || true)"
    fi
    if [[ -n "$session_type" ]]; then
        info "session type: $session_type"
    else
        fail "could not determine session type"
    fi
}

echo "keybind-manager doctor"
echo "======================"
check_keyd_binary
check_keyd_service
check_helper
check_polkit_policy
check_pkexec
check_polkit_agent
check_session_type
echo "======================"

if ((FAILURES > 0)); then
    echo "$FAILURES check(s) failed"
    exit 1
fi

echo "All checks passed"
exit 0
