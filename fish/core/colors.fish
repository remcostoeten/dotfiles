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

# Color shorthand functions - using 'color_' prefix to avoid conflicts
function color_red -d "Print text in red"
    echo -e "$fish_color_red$argv$fish_color_reset"
end

function color_green -d "Print text in green"
    echo -e "$fish_color_green$argv$fish_color_reset"
end

function color_yellow -d "Print text in yellow"
    echo -e "$fish_color_yellow$argv$fish_color_reset"
end

function color_blue -d "Print text in blue"
    echo -e "$fish_color_blue$argv$fish_color_reset"
end

function color_magenta -d "Print text in magenta"
    echo -e "$fish_color_magenta$argv$fish_color_reset"
end

function color_cyan -d "Print text in cyan"
    echo -e "$fish_color_cyan$argv$fish_color_reset"
end

function color_white -d "Print text in white"
    echo -e "$fish_color_white$argv$fish_color_reset"
end

# Text formatting functions - using 'text_' prefix to avoid conflicts
function text_bold -d "Print text in bold"
    echo -e "$fish_color_bold$argv$fish_color_reset"
end

function text_dim -d "Print text in dim"
    echo -e "$fish_color_dim$argv$fish_color_reset"
end

function text_italic -d "Print text in italic"
    echo -e "$fish_color_italic$argv$fish_color_reset"
end

function text_underline -d "Print text in underline"
    echo -e "$fish_color_underline$argv$fish_color_reset"
end

# Status message functions
function print_error -d "Print error message"
    echo -e "$fish_color_red$fish_color_bold[ERROR]$fish_color_reset $argv"
end

function print_warning -d "Print warning message"
    echo -e "$fish_color_yellow$fish_color_bold[WARNING]$fish_color_reset $argv"
end

function print_success -d "Print success message"
    echo -e "$fish_color_green$fish_color_bold[SUCCESS]$fish_color_reset $argv"
end

function print_info -d "Print info message"
    echo -e "$fish_color_blue$fish_color_bold[INFO]$fish_color_reset $argv"
end

function print_debug -d "Print debug message"
    echo -e "$fish_color_bright_black$fish_color_bold[DEBUG]$fish_color_reset $argv"
end