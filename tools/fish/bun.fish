#!/usr/bin/env fish

if not set -q BUN_INSTALL
    set -gx BUN_INSTALL $HOME/.bun
end

add_to_path $BUN_INSTALL/bin
