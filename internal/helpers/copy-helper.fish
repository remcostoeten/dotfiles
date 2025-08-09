#!/usr/bin/env fish

# Helper registration for copy script using the central factory
source (dirname (status --current-filename))/../helper-factory.fish

# Register helper for copy script
create_helper "copy" \
    "Cross-Platform Clipboard Helper" \
    "Copy file contents or paths to clipboard with cross-platform support" \
    "usage|USAGE|copy|[file]|Copy file contents or current directory path" \
    "examples|EXAMPLES|Copy file contents:copy myfile.txt|Copy current directory:copypwd|Copy file path:copypwd myfile.txt" \
    "features|FEATURES|Cross-platform clipboard support|File content copying|Directory path copying|Full file path copying" \
    "commands|COMMANDS|copy [file]:Copy file contents to clipboard|copypwd:Copy current directory path|copypwd [file]:Copy full file path"
