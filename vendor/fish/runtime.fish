#!/usr/bin/env fish

if not set -q PREFERRED_HOME_DIR
    set -gx PREFERRED_HOME_DIR $HOME
end

if not set -q EDITOR
    set -gx EDITOR nvim
end

if not set -q SUDO_EDITOR
    set -gx SUDO_EDITOR $EDITOR
end

set -g fish_greeting

add_to_path ~/.config/dotfiles/bin
add_to_path ~/.config/dotfiles/scripts
add_to_path ~/.local/bin
add_to_path ~/bin

function dotfiles_source_fish_function --argument name
    set -l function_file "$HOME/.config/dotfiles/configs/fish/functions/$name.fish"
    if not functions -q "$name"; and test -f "$function_file"
        source "$function_file"
    end
end

if dotfiles_shell_is_interactive
    if test -f $HOME/.secrets
        source $HOME/.secrets
    end

    function _override_dir_reset --on-event fish_prompt
        functions --erase _override_dir_reset

        if test (pwd) = ~/.config/dotfiles; and test -d "$PREFERRED_HOME_DIR"
            cd "$PREFERRED_HOME_DIR"
        end
    end

    if command -v fastfetch-startup >/dev/null 2>&1
        fastfetch-startup
    else if command -v fastfetch >/dev/null 2>&1
        fastfetch
    end

    dotfiles_source_fish_function show_todos_startup
    if functions -q show_todos_startup
        show_todos_startup
    end

    if test -f ~/.local/state/quickshell/user/generated/terminal/sequences.txt
        cat ~/.local/state/quickshell/user/generated/terminal/sequences.txt
    end
end
