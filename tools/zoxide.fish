#!/usr/bin/env fish

if dotfiles_shell_is_interactive; and command -v zoxide >/dev/null 2>&1
    zoxide init fish | source
end
