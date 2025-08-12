#!/usr/bin/env fish

# Helper registration for node-clean-dev script using the central factory
source (dirname (status --current-filename))/../helper-factory.fish

# Register helper for node-clean-dev script
create_helper "node-clean-dev" \
    "Node.js Clean & Dev Server" \
    "Clean Node.js project and start development server in one command" \
    "usage|USAGE|restartnode|[port]|Clean dependencies and start dev server" \
    "examples|EXAMPLES|Default restart:restartnode|Custom port:restartnode 8080" \
    "features|FEATURES|Automatic dependency cleanup|Development server startup|Port configuration|Process management" \
    "commands|COMMANDS|restartnode:Clean and start dev server|restartnode [port]:Start on specific port"
