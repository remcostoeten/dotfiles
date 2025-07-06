#!/usr/bin/env fish

# Helper registration for kill-ports script using the central factory
source (dirname (status --current-filename))/../helper-factory.fish

# Register helper for kill-ports script
create_helper "kill-ports" \
    "Interactive Port & Process Manager" \
    "View and kill processes by port with interactive selection using fzf" \
    "usage|USAGE|ports|pkillport|backup|View ports, kill processes, or backup files" \
    "examples|EXAMPLES|List ports:ports|Kill port interactively:pkillport|Backup file:backup myfile.txt" \
    "features|FEATURES|Interactive port selection|Cross-platform port listing|Process killing with confirmation|File backup utility" \
    "commands|COMMANDS|ports:List all listening ports and processes|pkillport:Interactively select and kill a process|backup [file]:Create timestamped backup of file"
