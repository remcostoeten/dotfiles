function create
    # Wrapper for the create script to work in fish
    # The actual implementation is in scripts/create
    # Use DOTFILES_DIR if set, otherwise default to ~/.config/dotfiles
    set -l dotfiles_dir (test -n "$DOTFILES_DIR" && echo "$DOTFILES_DIR" || echo ~/.config/dotfiles)
    set -l script_path "$dotfiles_dir/scripts/create"

    if test -f "$script_path"
        # Execute the script with all arguments
        sh "$script_path" $argv
    else
        echo "Error: create script not found at $script_path"
        return 1
    end
end
