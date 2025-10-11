# Main fish configuration file
alias x "exit"
if status is-interactive
    # Display welcome banner once per session
    if not set -q DOTFILES_WELCOME_SHOWN
        set -g DOTFILES_WELCOME_SHOWN 1
        welcome_banner
        echo ""
    end
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

# pnpm
set -gx PNPM_HOME "/home/remco-stoeten/.local/share/pnpm"
if not string match -q -- $PNPM_HOME $PATH
  set -gx PATH "$PNPM_HOME" $PATH
end
# pnpm end
