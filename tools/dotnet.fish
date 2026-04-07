#!/usr/bin/env fish

if not set -q DOTNET_ROOT
    set -gx DOTNET_ROOT $HOME/.dotnet
end

add_to_path $DOTNET_ROOT $DOTNET_ROOT/tools
