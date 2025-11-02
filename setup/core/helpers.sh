#!/bin/bash

# Helper functions for output and utilities

print_status() { 
    [ "$QUIET" = true ] && return 0
    echo -e "${BLUE}→${NC} $1"
}

print_success() { 
    [ "$QUIET" = true ] && return 0
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() { 
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() { 
    echo -e "${RED}✗${NC} $1" >&2
}

print_info() { 
    [ "$QUIET" = true ] && return 0
    echo -e "${CYAN}ℹ${NC} $1"
}

print_header() { 
    [ "$QUIET" = true ] && return 0
    echo -e "\n${BOLD}${MAGENTA}$1${NC}"
}

print_dry_run() { 
    echo -e "${YELLOW}[DRY RUN]${NC} $1"
}

print_verbose() {
    [ "$VERBOSE" = true ] && echo -e "${CYAN}[VERBOSE]${NC} $1"
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Track installation results
track_result() {
    local result=$1
    if [ $result -eq 0 ]; then
        ((TOTAL_SUCCESS++))
    else
        ((TOTAL_FAILED++))
    fi
}
