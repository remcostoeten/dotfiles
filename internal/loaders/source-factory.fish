#!/usr/bin/env fish

# ==============================================================================\n# GENERIC FILE SOURCING FACTORY\n# Loads files from specified directories with flexible patterns\n# ==============================================================================\n
function source_files
    set -l description $argv[1]
    set -l base_dir $argv[2]
    set -l pattern $argv[3]
    set -l silent $argv[4]
    
    if test -z "$description" -o -z "$base_dir" -o -z "$pattern"
        echo "Usage: source_files <description> <base_dir> <pattern> [silent]"
        return 1
    end
    
    if not test -d $base_dir
        if test "$silent" != "silent"
            echo "📁 Directory not found: $base_dir"
        end
        return 1
    end
    
    set -l files_found 0
    
    for file in $base_dir/$pattern
        if test -f $file
            source $file
            set files_found (math $files_found + 1)
            if test "$silent" != "silent"
                echo "✓ Loaded $description: $(basename $file)"
            end
        end
    end
    
    if test $files_found -eq 0
        if test "$silent" != "silent"
            echo "⚠ No $description files found in $base_dir"
        end
        return 1
    end
    
    return 0
end

# Convenience functions for common use cases
function source_category
    set -l category $argv[1]
    set -l base_dir $argv[2]
    set -l silent $argv[3]
    
    if test -z "$base_dir"
        set base_dir "$HOME/.config/fish"
    end
    
    source_files "$category" "$base_dir/$category" "*.fish" $silent
end

function source_dotfiles
    set -l category $argv[1]
    set -l silent $argv[2]
    
    source_files "$category" "$DOTFILES_DIR/$category" "*.fish" $silent
end
