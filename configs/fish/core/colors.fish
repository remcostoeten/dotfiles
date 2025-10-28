#!/usr/bin/env fish

# Core color variables using set_color
set -g fish_color_reset (set_color normal)
set -g fish_color_black (set_color black)
set -g fish_color_red (set_color red)
set -g fish_color_green (set_color green)
set -g fish_color_yellow (set_color yellow)
set -g fish_color_blue (set_color blue)
set -g fish_color_magenta (set_color magenta)
set -g fish_color_cyan (set_color cyan)
set -g fish_color_white (set_color white)

# Bright colors
set -g fish_color_bright_black (set_color brblack)
set -g fish_color_bright_red (set_color brred)
set -g fish_color_bright_green (set_color brgreen)
set -g fish_color_bright_yellow (set_color bryellow)
set -g fish_color_bright_blue (set_color brblue)
set -g fish_color_bright_magenta (set_color brmagenta)
set -g fish_color_bright_cyan (set_color brcyan)
set -g fish_color_bright_white (set_color brwhite)

# Text styles
set -g fish_color_bold (set_color --bold)
set -g fish_color_dim (set_color --dim)
set -g fish_color_italic (set_color --italics)
set -g fish_color_underline (set_color --underline)

# Color shorthand functions
function r -d "Print text in red"
    echo -e "$fish_color_red$argv$fish_color_reset"
end

function g -d "Print text in green"
    echo -e "$fish_color_green$argv$fish_color_reset"
end

function y -d "Print text in yellow"
    echo -e "$fish_color_yellow$argv$fish_color_reset"
end

function bl -d "Print text in blue"
    echo -e "$fish_color_blue$argv$fish_color_reset"
end

function p -d "Print text in magenta"
    echo -e "$fish_color_magenta$argv$fish_color_reset"
end

function cyan_text -d "Print text in cyan"
    echo -e "$fish_color_cyan$argv$fish_color_reset"
end

function w -d "Print text in white"
    echo -e "$fish_color_white$argv$fish_color_reset"
end

# Text formatting functions
function b -d "Print text in bold"
    echo -e "$fish_color_bold$argv$fish_color_reset"
end

function d -d "Print text in dim"
    echo -e "$fish_color_dim$argv$fish_color_reset"
end

function i -d "Print text in italic"
    echo -e "$fish_color_italic$argv$fish_color_reset"
end

function u -d "Print text in underline"
    echo -e "$fish_color_underline$argv$fish_color_reset"
end

# Status message functions
function print_error -d "Print error message"
    printf "%s%s[ERROR]%s %s\n" "$fish_color_red" "$fish_color_bold" "$fish_color_reset" (string join " " $argv)
end

function print_warning -d "Print warning message"
    printf "%s%s[WARNING]%s %s\n" "$fish_color_yellow" "$fish_color_bold" "$fish_color_reset" (string join " " $argv)
end

function print_success -d "Print success message"
    printf "%s%s[SUCCESS]%s %s\n" "$fish_color_green" "$fish_color_bold" "$fish_color_reset" (string join " " $argv)
end

function print_info -d "Print info message"
    printf "%s%s[INFO]%s %s\n" "$fish_color_blue" "$fish_color_bold" "$fish_color_reset" (string join " " $argv)
end

function print_debug -d "Print debug message"
    printf "%s%s[DEBUG]%s %s\n" "$fish_color_bright_black" "$fish_color_bold" "$fish_color_reset" (string join " " $argv)
end
