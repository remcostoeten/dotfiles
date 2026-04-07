#!/usr/bin/env fish

add_to_path $HOME/.local/share/fnm

if dotfiles_shell_is_interactive; and command -v fnm >/dev/null 2>&1
    fnm env --use-on-cd --shell fish | source
end
