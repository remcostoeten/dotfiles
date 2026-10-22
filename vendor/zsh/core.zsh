#!/usr/bin/env zsh

function dotfiles_add_path() {
    local directory

    for directory in "$@"; do
        [[ -d "$directory" ]] || continue
        [[ ":$PATH:" == *":$directory:"* ]] || PATH="$directory:$PATH"
    done

    export PATH
}

function dotfiles_source_dir() {
    setopt local_options null_glob
    local directory="$1"
    local extension="${2:-zsh}"
    local file

    [[ -d "$directory" ]] || return 0

    for file in "$directory"/*."$extension"; do
        [[ -f "$file" ]] || continue
        source "$file"
    done
}
