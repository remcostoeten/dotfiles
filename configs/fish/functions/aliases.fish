#!/usr/bin/env fish

# DOCSTRING: Compatibility shim for the modules command
function aliases --description "Compatibility shim for modules"
    modules $argv
end
