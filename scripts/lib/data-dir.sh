#!/usr/bin/env bash
# DOCSTRING: Runtime helpers for script-specific data directories

get_script_data_dir() {
    local script_name="${1:-}"

    if [ -z "$script_name" ]; then
        echo "Error: script name required" >&2
        echo "Usage: get_script_data_dir <script-name>" >&2
        return 1
    fi

    script_name=$(basename "$script_name")
    local data_root="${DOTFILES_DATA_DIR:-$HOME/.dotfiles}"
    echo "$data_root/$script_name"
}

ensure_script_data_dir() {
    local script_name="${1:-}"
    local subpath="${2:-}"

    if [ -z "$script_name" ]; then
        echo "Error: script name required" >&2
        echo "Usage: ensure_script_data_dir <script-name> [subpath]" >&2
        return 1
    fi

    local base_dir
    base_dir="$(get_script_data_dir "$script_name")" || return 1

    local target_dir="$base_dir"
    if [ -n "$subpath" ]; then
        target_dir="$base_dir/$subpath"
    fi

    mkdir -p "$target_dir" || return 1
    echo "$target_dir"
}

script_data_file() {
    local script_name="${1:-}"
    local relative_path="${2:-}"

    if [ -z "$script_name" ] || [ -z "$relative_path" ]; then
        echo "Error: script_data_file requires <script-name> and <relative-path>" >&2
        return 1
    fi

    local dir
    dir="$(ensure_script_data_dir "$script_name")" || return 1
    echo "$dir/$relative_path"
}
