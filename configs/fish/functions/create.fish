function create
    # Wrapper for the create script to work in fish
    # The actual implementation is in scripts/create
    set -l script_path ~/.config/dotfiles/scripts/create
    
    if test -f "$script_path"
        # Execute the script with all arguments
        sh "$script_path" $argv
    else
        echo "Error: create script not found at $script_path"
        return 1
    end
end

