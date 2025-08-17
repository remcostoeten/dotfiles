function dotfiles-alias-help
    echo "Available Aliases:"
    echo "------------------"

    set script_dir (status --current-filename | xargs dirname)

    for file in $script_dir/*
        set file_basename (basename $file)

        # Skip the loader, helper, and sorter files
        if test $file_basename = "loader.fish" -o $file_basename = "helper.fish" -o $file_basename = "sorter"
            continue
        end

        echo ""
        echo (string upper $file_basename) "Aliases:"
        echo "--------------------"

        # Read the file line by line and extract aliases
        while read -l line
            if string match -q "alias *" $line
                # Extract alias name and command
                set -l alias_name (echo $line | sed -E 's/alias ([^=]+)=.*/\1/')
                set -l alias_command (echo $line | sed -E 's/alias [^=]+=(.*)/\1/')
                echo "  " $alias_name ": " $alias_command
            end
        end < $file
    end
    echo ""
    echo "To use, type 'dotfiles-alias-help' or 'alias-help'."
end

# Create a convenient alias for the helper function
alias alias-help dotfiles-alias-help