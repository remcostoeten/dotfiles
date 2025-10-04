# Main fish configuration file

if status is-interactive
    # Get the directory where this config file is located
    set -l fish_dir (dirname (status --current-filename))
    
    # Define paths relative to the fish directory
    set -l core_init $fish_dir/core/init.fish
    set -l aliases_init $fish_dir/aliases/init.fish

    # Source core initialization
    if test -f $core_init
        source $core_init
    else
        echo "Warning: Core initialization file not found: $core_init"
    end

    # Source aliases initialization
    if test -f $aliases_init
        source $aliases_init
    else
        echo "Warning: Aliases initialization file not found: $aliases_init"
    end

    # Initialize zoxide
    if type -q zoxide
        zoxide init fish | source
    end
end
