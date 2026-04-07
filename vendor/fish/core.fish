#!/usr/bin/env fish

# Shared helper functions for Fish loaders.
function add_to_path
    for dir in $argv
        if test -d "$dir"
            if not contains "$dir" $PATH
                set -gx PATH "$dir" $PATH
            end
        end
    end
end

function dedupe_path
    set -l new_path
    for dir in $PATH
        if not contains "$dir" $new_path
            set new_path $new_path "$dir"
        end
    end
    set -gx PATH $new_path
end

function dotfiles_source_dir --argument dir
    if test -d "$dir"
        for file in $dir/*.fish
            if test -f "$file"
                source "$file"
            end
        end
    end
end

function dotfiles_load_all_recursive --argument dir mode extension
    if not test -d "$dir"
        return 0
    end

    set -l mode_name "$mode"
    set -l file_extension "$extension"

    if test -z "$mode_name"
        set mode_name source
    end

    if test -z "$file_extension"
        set file_extension fish
    end

    find "$dir" -type f -name "*.$file_extension" | sort | while read -l entry
        switch "$mode_name"
            case source
                source "$entry"
            case path
                set -l entry_dir (dirname "$entry")
                add_to_path "$entry_dir"
            case '*'
                printf "dotfiles_load_all_recursive: unsupported mode '%s'\n" "$mode_name" >&2
                return 1
        end
    end
end

function dotfiles_shell_is_interactive
    status is-interactive
end
