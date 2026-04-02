#!/usr/bin/env fish

if dotfiles_shell_is_interactive; and command -v starship >/dev/null 2>&1
    starship init fish | source
end
