#!/usr/bin/env fish

# ==============================================================================
# SECTION 1: CLIPBOARD UTILITIES
# Dependencies: xclip/xsel (Linux), pbcopy (macOS)
# ==============================================================================

# Cross-platform clipboard helper for Fish shell (Ubuntu & Mac)
# Adds `copy`, `copypwd`, and a built-in colorized help menu

# Function to detect clipboard command based on OS
function _get_clipboard_cmd
    switch (uname)
        case Darwin
            echo pbcopy
        case Linux
            if command -v xclip >/dev/null
                echo "xclip -selection clipboard"
            else if command -v xsel >/dev/null
                echo "xsel --clipboard --input"
            else
                echo ""
            end
        case '*'
            echo ""
    end
end

# Function to check if clipboard is available
function _check_clipboard
    set -l clip_cmd (_get_clipboard_cmd)
    if test -z "$clip_cmd"
        echo -e (set_color red)"✗ No clipboard utility found."
        echo -e (set_color yellow)"  On Mac: pbcopy should be available by default"
        echo -e (set_color yellow)"  On Linux: install xclip or xsel"
        echo -e (set_color normal)"    Ubuntu/Debian: sudo apt install xclip"
        echo -e (set_color normal)"    Fedora/RHEL: sudo dnf install xclip"
        echo -e (set_color normal)"    Arch: sudo pacman -S xclip"
        return 1
    end
    return 0
end

function copy
    set -l arg1 $argv[1]
    set -l arg2 $argv[2]

    if test (count $argv) -eq 0
        echo -e (set_color yellow)"✦ No arguments provided. Type "(set_color cyan)"copy --help"(set_color yellow)" for usage."
        return 1
    end

    switch $arg1
        case help -h --h -help --help
            echo ""
            echo -e (set_color cyan)"╔═══════════════════════════════════════════════════════════════╗"
            echo -e (set_color cyan)"║                                                               ║"
            echo -e (set_color cyan)"║         Cross-Platform Clipboard Helper - v2.0               ║"
            echo -e (set_color cyan)"║                     by @remcostoeten                         ║"
            echo -e (set_color cyan)"║                                                               ║"
            echo -e (set_color cyan)"╚═══════════════════════════════════════════════════════════════╝"
            echo ""
            echo -e (set_color cyan)"Commands:"
            echo -e (set_color green)"  copy [file]"(set_color normal)"         → Copies the contents of a file"
            echo -e (set_color green)"  copypwd"(set_color normal)"            → Copies the current working directory"
            echo -e (set_color green)"  copypwd [file]"(set_color normal)"     → Copies full absolute path to file"
            echo ""
            echo -e (set_color cyan)"Help Aliases:"
            echo -e (set_color yellow)"  help, -h, --h, -help, --help"
            echo ""
            echo -e (set_color cyan)"Compatibility:"
            echo -e (set_color normal)"  macOS: Uses pbcopy (built-in)"
            echo -e (set_color normal)"  Linux: Uses xclip or xsel"
            echo ""
            echo -e (set_color cyan)"Current system:"
            echo -e (set_color normal)"  OS: "(uname)
            set -l clip_cmd (_get_clipboard_cmd)
            if test -n "$clip_cmd"
                echo -e (set_color normal)"  Clipboard: "(set_color green)"✓ Available"(set_color normal)" ($clip_cmd)"
            else
                echo -e (set_color normal)"  Clipboard: "(set_color red)"✗ Not available"
            end
            echo ""
            return 0

        case pwd
            if not _check_clipboard
                return 1
            end

            set -l clip_cmd (_get_clipboard_cmd)

            if test -n "$arg2"
                set -l abs (realpath "$arg2" 2>/dev/null)
                if test -e "$abs"
                    echo -n "$abs" | eval $clip_cmd
                    echo -e (set_color green)"✓ Copied:"(set_color normal)" $abs"
                else
                    echo -e (set_color red)"✗ File not found:"(set_color normal)" $arg2"
                    return 1
                end
            else
                echo -n (pwd) | eval $clip_cmd
                echo -e (set_color green)"✓ Copied current directory to clipboard."
            end
            return 0

        case '*'
            if not _check_clipboard
                return 1
            end

            set -l clip_cmd (_get_clipboard_cmd)

            if test -f "$arg1"
                cat "$arg1" | eval $clip_cmd
                echo -e (set_color green)"✓ Copied contents of file:"(set_color normal)" $arg1"
            else
                echo -e (set_color red)"✗ File not found:"(set_color normal)" $arg1"
                return 1
            end
    end
end

function copypwd
    if not _check_clipboard
        return 1
    end

    set -l clip_cmd (_get_clipboard_cmd)

    if test (count $argv) -eq 0
        echo -n (pwd) | eval $clip_cmd
        echo -e (set_color green)"✓ Copied current directory."
    else
        set -l abs (realpath "$argv[1]" 2>/dev/null)
        if test -e "$abs"
            echo -n "$abs" | eval $clip_cmd
            echo -e (set_color green)"✓ Copied full path to:"(set_color normal)" $abs"
        else
            echo -e (set_color red)"✗ File not found:"(set_color normal)" $argv[1]"
            return 1
        end
    end
end
