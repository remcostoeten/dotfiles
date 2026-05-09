#!/usr/bin/env bash
# Run a GitHub-hosted tool from an auto-updated local checkout.
set -euo pipefail

repo_url="${1:?repo url required}"
tool_name="${2:?tool name required}"
entrypoint="${3:?entrypoint required}"
shift 3

cache_root="${DOTFILES_GITHUB_TOOLS_DIR:-$HOME/.local/share/dotfiles/github-tools}"
tool_dir="$cache_root/$tool_name"

log() {
    printf '[%s] %s\n' "$tool_name" "$*" >&2
}

ensure_git() {
    if ! command -v git >/dev/null 2>&1; then
        log "git is required"
        exit 1
    fi
}

default_branch() {
    git -C "$tool_dir" remote show origin 2>/dev/null \
        | awk '/HEAD branch/ { print $NF; exit }'
}

sync_repo() {
    mkdir -p "$cache_root"

    if [[ ! -d "$tool_dir/.git" ]]; then
        if [[ -e "$tool_dir" ]]; then
            log "$tool_dir exists but is not a git checkout"
            log "move it away or set DOTFILES_GITHUB_TOOLS_DIR to another location"
            exit 1
        fi

        log "cloning latest from $repo_url"
        git clone --depth 1 "$repo_url" "$tool_dir"
        return
    fi

    if ! git -C "$tool_dir" fetch --prune origin; then
        log "fetch failed; using cached checkout"
        return
    fi

    local branch
    branch="$(default_branch)"
    if [[ -z "$branch" ]]; then
        branch="master"
    fi

    git -C "$tool_dir" reset --hard "origin/$branch" >/dev/null
}

run_entrypoint() {
    local target="$tool_dir/$entrypoint"

    if [[ ! -e "$target" ]]; then
        log "entrypoint not found: $entrypoint"
        log "repo checkout: $tool_dir"
        exit 1
    fi

    case "$target" in
        *.py)
            exec python3 "$target" "$@"
            ;;
        *.sh)
            exec bash "$target" "$@"
            ;;
        *.js)
            if command -v node >/dev/null 2>&1; then
                exec node "$target" "$@"
            fi
            log "node is required for $entrypoint"
            exit 1
            ;;
        *.ts)
            if command -v bun >/dev/null 2>&1; then
                exec bun "$target" "$@"
            fi
            log "bun is required for $entrypoint"
            exit 1
            ;;
        *)
            if [[ -x "$target" ]]; then
                exec "$target" "$@"
            fi
            log "unsupported entrypoint: $entrypoint"
            exit 1
            ;;
    esac
}

ensure_git
sync_repo
run_entrypoint "$@"
