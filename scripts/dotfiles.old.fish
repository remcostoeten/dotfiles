#!/usr/bin/env fish

# Dotfiles Menu - Interactive script manager
# Provides an interactive menu to select and run scripts

# Get the directory where this script is located
set DOTFILES_DIR (dirname (dirname (status --current-filename)))

# Source colors if available
if test -f $DOTFILES_DIR/core/colors.fish
    source $DOTFILES_DIR/core/colors.fish
end

function show_ascii_banner
    clear
    echo (set_color cyan)"
    ██████╗  ██████╗ ████████╗███████╗██╗██╗     ███████╗███████╗
    ██╔══██╗██╔═══██╗╚══██╔══╝██╔════╝██║██║     ██╔════╝██╔════╝
    ██║  ██║██║   ██║   ██║   █████╗  ██║██║     █████╗  ███████╗
    ██║  ██║██║   ██║   ██║   ██╔══╝  ██║██║     ██╔══╝  ╚════██║
    ██████╔╝╚██████╔╝   ██║   ██║     ██║███████╗███████╗███████║
    ╚═════╝  ╚═════╝    ╚═╝   ╚═╝     ╚═╝╚══════╝╚══════╝╚══════╝
    "(set_color normal)
    echo
end

function get_scripts
    set -l executable_scripts
    
    # Check bin directory
    if test -d $DOTFILES_DIR/bin
        for script in $DOTFILES_DIR/bin/*
            if test -f $script -a -x $script
                set executable_scripts $executable_scripts (basename $script)
            end
        end
    end
    
    # Check scripts directory
    if test -d $DOTFILES_DIR/scripts
        for script in $DOTFILES_DIR/scripts/*
            if test -f $script -a -x $script
                set executable_scripts $executable_scripts (basename $script)
            end
        end
    end
    
    printf '%s\n' $executable_scripts
end

function show_interactive_menu
    set -l scripts (get_scripts)
    set -l selected 1
    set -l num_scripts (count $scripts)
    
    if test $num_scripts -eq 0
        echo (set_color red)"No executable scripts found in bin/ or scripts/ directories!"(set_color normal)
        return 1
    end

    while true
        show_ascii_banner
        echo (set_color yellow)"Select a script to run:"(set_color normal)
        echo

        for i in (seq $num_scripts)
            set -l script $scripts[$i]
            if test $i -eq $selected
                echo (set_color -o green)"-> $script"(set_color normal)
            else
                echo "   $script"
            end
        end

        echo
        echo (set_color brblack)"Use arrow keys to navigate, Enter to select, 'q' to quit."(set_color normal)

        read -s -n 1 key
        
        if test "$key" = \e
            read -s -n 2 seq
            switch $seq
                case '[A' # Up arrow
                    if test $selected -gt 1
                        set selected (math $selected - 1)
                    end
                case '[B' # Down arrow
                    if test $selected -lt $num_scripts
                        set selected (math $selected + 1)
                    end
            end
        else
            switch $key
                case \r # Enter
                    if test $num_scripts -gt 0
                        set -l script_to_run $scripts[$selected]
                        run_script $script_to_run
                        return
                    end
                case 'q'
                    echo (set_color green)"Goodbye!"(set_color normal)
                    return
            end
        end
    end
end

function run_script
    set -l script_name $argv[1]
    set -l script_path_bin $DOTFILES_DIR/bin/$script_name
    set -l script_path_scripts $DOTFILES_DIR/scripts/$script_name

    if test -x $script_path_bin
        echo "Running $script_name from bin..."
        eval $script_path_bin
    else if test -x $script_path_scripts
        echo "Running $script_name from scripts..."
        eval $script_path_scripts
    else if test -f $script_path_bin
        echo "Script $script_name found in bin but not executable. Trying to run with fish..."
        fish $script_path_bin
    else if test -f $script_path_scripts
        echo "Script $script_name found in scripts but not executable. Trying to run with fish..."
        fish $script_path_scripts
    else
        echo "Error: Script '$script_name' not found in bin or scripts directory"
        return 1
    end
end

function show_usage
    echo "Usage: dotfiles [script-name]"
    echo ""
    echo "Available scripts:"
    for script in (get_scripts)
        echo "  $script"
    end
    echo ""
    echo "Examples:"
    echo "  dotfiles copy"
    echo "  dotfiles --help"
end

# Main function
function main
    # If no arguments provided, show interactive menu
    if test (count $argv) -eq 0
        show_interactive_menu
        return 0
    end

    set -l arg $argv[1]

    switch $arg
        case --help -h help
            show_usage
        case '*'
            run_script $arg
    end
end

main $argv