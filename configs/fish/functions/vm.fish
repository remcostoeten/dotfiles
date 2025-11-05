# VM Manager - Interactive Virtual Machine Management
# Launch the VM Manager interface

function vm --description "Launch VM Manager for interactive virtual machine management"
    if test -f "$HOME/.config/dotfiles/bin/vm"
        $HOME/.config/dotfiles/bin/vm $argv
    else
        echo "Error: VM Manager not found. Please ensure dotfiles are properly installed."
        return 1
    end
end

# Add completion for vm command
complete -c vm -f -a "(__fish_print_help vm)"
complete -c vm -f -l help -d "Show help message"
complete -c vm -f -l version -d "Show version information"
complete -c vm -f -l quick -d "Quick VM creation"
