#!/usr/bin/env fish

# ==============================================================================
# SECTION 2: FILE CREATION UTILITIES  
# Dependencies: mkdir, touch, chmod
# ==============================================================================

# Enhanced mkdir and touch functions for Fish shell
# Provides recursive directory creation and auto-executable file creation

function mkdir
    set -l help_shown false

    # Check for help flags
    for arg in $argv
        switch $arg
            case help -h --h -help --help
                echo ""
                echo -e (set_color cyan)"╔═══════════════════════════════════════════════════════════════╗"
                echo -e (set_color cyan)"║                                                               ║"
                echo -e (set_color cyan)"║            Enhanced mkdir & touch - v1.0                     ║"
                echo -e (set_color cyan)"║                     by @remcostoeten                         ║"
                echo -e (set_color cyan)"║                                                               ║"
                echo -e (set_color cyan)"╚═══════════════════════════════════════════════════════════════╝"
                echo ""
                echo -e (set_color cyan)"Enhanced mkdir:"
                echo -e (set_color green)"  mkdir [path]"(set_color normal)"           → Creates directories recursively (like mkdir -p)"
                echo -e (set_color green)"  mkdir [path1] [path2]"(set_color normal)"  → Creates multiple directories"
                echo ""
                echo -e (set_color cyan)"Enhanced touch:"
                echo -e (set_color green)"  touch [file]"(set_color normal)"           → Creates file with parent dirs + chmod +x"
                echo -e (set_color green)"  touch [file1] [file2]"(set_color normal)"  → Creates multiple files"
                echo ""
                echo -e (set_color yellow)"Examples:"
                echo -e (set_color normal)"  mkdir some/deep/folder/structure"
                echo -e (set_color normal)"  touch some/folder/script.sh"
                echo ""
                set help_shown true
                break
        end
    end

    if test $help_shown = true
        return 0
    end

    # If no arguments provided
    if test (count $argv) -eq 0
        echo -e (set_color yellow)"✦ No path provided. Type "(set_color cyan)"mkdir --help"(set_color yellow)" for usage."
        return 1
    end

    # Create directories recursively
    for dir_path in $argv
        if command mkdir -p "$dir_path" 2>/dev/null
            echo -e (set_color green)"✓ Created directory:"(set_color normal)" $dir_path"
        else
            echo -e (set_color red)"✗ Failed to create directory:"(set_color normal)" $dir_path"
            return 1
        end
    end
end

function touch
    set -l help_shown false

    # Check for help flags
    for arg in $argv
        switch $arg
            case help -h --h -help --help
                echo ""
                echo -e (set_color cyan)"╔═══════════════════════════════════════════════════════════════╗"
                echo -e (set_color cyan)"║                                                               ║"
                echo -e (set_color cyan)"║            Enhanced mkdir & touch - v1.0                     ║"
                echo -e (set_color cyan)"║                     by @remcostoeten                         ║"
                echo -e (set_color cyan)"║                                                               ║"
                echo -e (set_color cyan)"╚═══════════════════════════════════════════════════════════════╝"
                echo ""
                echo -e (set_color cyan)"Enhanced touch:"
                echo -e (set_color green)"  touch [file]"(set_color normal)"           → Creates file with parent dirs + chmod +x"
                echo -e (set_color green)"  touch [file1] [file2]"(set_color normal)"  → Creates multiple files"
                echo -e (set_color green)"  touch --no-exec [file]"(set_color normal)" → Creates file without executable permission"
                echo ""
                echo -e (set_color cyan)"Enhanced mkdir:"
                echo -e (set_color green)"  mkdir [path]"(set_color normal)"           → Creates directories recursively (like mkdir -p)"
                echo ""
                echo -e (set_color yellow)"Examples:"
                echo -e (set_color normal)"  touch some/folder/script.sh"
                echo -e (set_color normal)"  touch --no-exec config.txt"
                echo -e (set_color normal)"  mkdir some/deep/folder/structure"
                echo ""
                set help_shown true
                break
        end
    end

    if test $help_shown = true
        return 0
    end

    # If no arguments provided
    if test (count $argv) -eq 0
        echo -e (set_color yellow)"✦ No file provided. Type "(set_color cyan)"touch --help"(set_color yellow)" for usage."
        return 1
    end

    set -l no_exec false
    set -l files

    # Parse arguments
    for arg in $argv
        switch $arg
            case --no-exec
                set no_exec true
            case '*'
                set files $files $arg
        end
    end

    # Create files with recursive directory creation
    for file_path in $files
        # Get the directory part of the path
        set -l dir_path (dirname "$file_path")

        # Create parent directories if they don't exist
        if test "$dir_path" != "." -a "$dir_path" != /
            if not test -d "$dir_path"
                if command mkdir -p "$dir_path" 2>/dev/null
                    echo -e (set_color blue)"✓ Created parent directories for:"(set_color normal)" $file_path"
                else
                    echo -e (set_color red)"✗ Failed to create parent directories for:"(set_color normal)" $file_path"
                    continue
                end
            end
        end

        # Create the file
        if command touch "$file_path" 2>/dev/null
            echo -e (set_color green)"✓ Created file:"(set_color normal)" $file_path"

            # Make executable by default (unless --no-exec flag is used)
            if test $no_exec = false
                if chmod +x "$file_path" 2>/dev/null
                    echo -e (set_color cyan)"✓ Made executable:"(set_color normal)" $file_path"
                else
                    echo -e (set_color yellow)"⚠ Created file but failed to make executable:"(set_color normal)" $file_path"
                end
            end
        else
            echo -e (set_color red)"✗ Failed to create file:"(set_color normal)" $file_path"
        end
    end
end

# Optional: Create alias for the original commands if you want to access them
function original_mkdir
    command mkdir $argv
end

function original_touch
    command touch $argv
end
