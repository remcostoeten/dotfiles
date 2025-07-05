#!/usr/bin/env fish

# Helper registration for file-creator script using the central factory
source (dirname (status --current-filename))/../helper-factory.fish

# Register helper for file-creator script
create_helper "file-creator" \
    "Enhanced File & Directory Creator" \
    "Create files and directories with enhanced mkdir and touch functionality" \
    "usage|USAGE|mkdir|touch|[paths]|Create directories and files with parent support" \
    "examples|EXAMPLES|Create directory:mkdir -p path/to/dir|Create file:touch path/to/file.txt|Create executable:touch -x script.sh" \
    "features|FEATURES|Recursive directory creation|Enhanced file creation|Executable permission setting|Parent directory creation" \
    "commands|COMMANDS|mkdir [path]:Create directory with parents|touch [file]:Create file with parent dirs|touch -x [file]:Create executable file"
