#!/usr/bin/env fish

if not set -q PNPM_HOME
    set -gx PNPM_HOME $HOME/.local/share/pnpm
end

add_to_path $PNPM_HOME
