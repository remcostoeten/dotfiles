#!/bin/bash

# Progress tracking and data directory management

# Initialize data directory structure
init_data_directory() {
    if [ ! -d "$DOTFILES_DATA_DIR" ]; then
        mkdir -p "$DOTFILES_DATA_DIR"/{setup,logs,backups}
        print_verbose "Created data directory structure at $DOTFILES_DATA_DIR"
    fi

    update_gitignore
}

# Update .gitignore to exclude data directory
update_gitignore() {
    local gitignore="$DOTFILES_DIR/.gitignore"
    local ignore_pattern="# Data directory (logs, progress, backups)"
    local ignore_entry="/.dotfiles/"

    if [ ! -f "$gitignore" ]; then
        touch "$gitignore"
        print_verbose "Created .gitignore file"
    fi

    if grep -q "^/.dotfiles/" "$gitignore" 2>/dev/null; then
        print_verbose "Data directory already in .gitignore"
        return 0
    fi

    {
        echo ""
        echo "$ignore_pattern"
        echo "$ignore_entry"
    } >> "$gitignore"

    print_success "Added $DOTFILES_DATA_DIR to .gitignore"
    print_info "Data directory will not be version controlled"
}
