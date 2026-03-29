#!/usr/bin/env fish

set -gx PREFERRED_HOME_DIR ~
set -gx EDITOR nvim
set -gx SUDO_EDITOR $EDITOR
set fish_greeting

function _override_dir_reset --on-event fish_prompt
    functions --erase _override_dir_reset

    if test (pwd) = ~/.config/dotfiles; and test -d "$PREFERRED_HOME_DIR"
        cd "$PREFERRED_HOME_DIR"
    end
end

function _show_welcome_banner --on-event fish_prompt
    functions --erase _show_welcome_banner

    if functions -q welcome_banner
        welcome_banner
    end
end

if test -f $HOME/.secrets
    source $HOME/.secrets
end

starship init fish | source
zoxide init fish | source

if test -f ~/.local/state/quickshell/user/generated/terminal/sequences.txt
    cat ~/.local/state/quickshell/user/generated/terminal/sequences.txt
end
