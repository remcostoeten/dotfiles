#!/usr/bin/env fish

# Compatibility shim: deprecated filename. Redirect to canonical helper-factory.fish
# This file will be removed in a future cleanup. Prefer sourcing helper-factory.fish directly.

set -l __dir (dirname (status --current-filename))
set -l __canonical "$__dir/helper-factory.fish"
if test -f "$__canonical"
    source "$__canonical"
else
    echo "Error: Canonical helper-factory.fish not found at $__canonical" 1>&2
end
