#!/bin/bash
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
BLUE='\033[0;34m'
GRAY='\033[0;90m'
NC='\033[0m'
BOLD='\033[1m'

PROGRESS_TOTAL=0
PROGRESS_CURRENT=0
PROGRESS_START_TIME=0
PROGRESS_CATEGORY=""
SPINNER_PID=""
SETUP_LOG_STYLE="${SETUP_LOG_STYLE:-compact}"

is_compact_log() {
    [[ "$SETUP_LOG_STYLE" == "compact" && "${VERBOSE:-false}" != "true" ]]
}

log_info() { echo -e "${CYAN}i${NC} $*"; }
log_warn() { echo -e "${YELLOW}!${NC} $*"; }
log_error() { echo -e "${RED}x${NC} $*" >&2; }
log_step() { echo -e "  ${MAGENTA}›${NC} $*"; }

log_success() {
    if is_compact_log && [[ "$*" == *" already installed" ]]; then
        return 0
    fi
    echo -e "${GREEN}✓${NC} $*"
}

log_section() {
    local title="$1"
    echo ""
    echo -e "${BOLD}${title}${NC}"
}

log_dry_run() {
    echo -e "  ${CYAN}dry${NC} $*"
}

init_progress() {
    PROGRESS_TOTAL=$1
    PROGRESS_CURRENT=0
    PROGRESS_START_TIME=$(date +%s)
    if [[ -t 1 ]]; then
        echo ""
        render_progress "Starting setup..."
    fi
}

update_progress() {
    local status="${1:-Installing...}"
    ((PROGRESS_CURRENT++)) || true
    render_progress "$status"
}

render_progress() {
    local status="$1"
    if [[ ! -t 1 ]]; then
        if [[ "$PROGRESS_CURRENT" -gt 0 ]]; then
            echo -e "${GRAY}${PROGRESS_CURRENT}/${PROGRESS_TOTAL}${NC} $status"
        fi
        return 0
    fi

    local elapsed=$(($(date +%s) - PROGRESS_START_TIME))
    local percent=$((PROGRESS_CURRENT * 100 / PROGRESS_TOTAL))
    local bar_width=35
    local filled=$((bar_width * PROGRESS_CURRENT / PROGRESS_TOTAL))
    local empty=$((bar_width - filled))

    local bar=""
    for ((i=0; i<filled; i++)); do bar+="━"; done
    for ((i=0; i<empty; i++)); do bar+="─"; done

    local time_display=""
    if [ $elapsed -gt 60 ]; then
        time_display="$((elapsed / 60))m $((elapsed % 60))s"
    else
        time_display="${elapsed}s"
    fi

    printf '\r%b[%b%s%b]%b %3d%% %b(%s)%b %b▶%b %s' \
        "$GRAY" "$GREEN" "$bar" "$GRAY" "$NC" \
        "$percent" "$GRAY" "$time_display" "$NC" \
        "$MAGENTA" "$NC" "${BLUE}${PROGRESS_CATEGORY}${NC}"
    echo ""
}

set_progress_category() {
    PROGRESS_CATEGORY="$1"
}

spinner_start() {
    local message="${1:-Working...}"
    printf "${GRAY}⠋${NC} %s" "$message" >&2
    (
        local chars="⠁⠂⠄⢀⢀⢀⣀⣀⣄⣆⣖⣘⣙⣜⣝⣞⣟⣠⣢⣤⣦⣧⣨⣩⣪⣬⣮⣰⣲⣴⣶⣸⣹⣺⣻⣾⣿"
        local i=0
        while true; do
            printf "\r${chars:$((i % ${#chars})):1} %s" "$message" >&2
            sleep 0.1
            ((i++)) || true
        done
    ) &
    SPINNER_PID=$!
}

spinner_stop() {
    if [ -n "$SPINNER_PID" ]; then
        kill "$SPINNER_PID" 2>/dev/null || true
        wait "$SPINNER_PID" 2>/dev/null || true
        SPINNER_PID=""
        printf "\r\033[K" >&2
    fi
}

log_header() {
    local title="${1:-}"
    local term_width
    term_width=$(tput cols 2>/dev/null || echo 42)
    local inner_width=$((term_width - 4))
    [[ $inner_width -gt 72 ]] && inner_width=72
    local line
    line=$(printf '─%.0s' $(seq 1 "$inner_width"))

    echo ""
    printf '%b%s%b\n' "$CYAN" "$line" "$NC"
    printf '%b%s%b\n' "$BOLD" "$title" "$NC"
    printf '%b%s%b\n' "$CYAN" "$line" "$NC"
}
