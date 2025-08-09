#!/usr/bin/env fish

# Helper registration for node-clean script using the central factory
source (dirname (status --current-filename))/../helper-factory.fish

# Register helper for node-clean script
create_helper "node-clean" \
    "Node.js Project Cleaner" \
    "Clean Node.js project by removing node_modules and lock files" \
    "usage|USAGE|rmnode|[options]|Remove node_modules and package locks" \
    "examples|EXAMPLES|Clean current project:rmnode|Clean with confirmation:rmnode --confirm" \
    "features|FEATURES|Remove node_modules directory|Remove package lock files|Safe cleanup with confirmation|Multiple lock file support" \
    "commands|COMMANDS|rmnode:Clean current Node.js project|rmnode --confirm:Clean with confirmation prompts"
