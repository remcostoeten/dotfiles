#!/usr/bin/env fish

# Shared path helpers for Fish loaders.
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
