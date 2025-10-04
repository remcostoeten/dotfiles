function l --description 'eza listing with nested-item counts for directories'
    set -l eza_flags -l --no-permissions --no-user --no-time --group-directories-first --icons
    
    # Get the basic eza output
    set -l eza_output (eza $eza_flags $argv)
    
    # Process each line to add counts for directories
    for line in $eza_output
        # Extract the filename (last field) - handle icons by taking everything after the last space
        set -l filename (echo $line | string split ' ')[-1]
        
        # Check if this is a directory by testing the filesystem
        if test -d $filename
            # Count items in the directory
            set -l count (command ls -1A $filename 2>/dev/null | wc -l 2>/dev/null)
            if test $status -ne 0
                # If we can't read the directory, show a lock symbol
                set count "⛔"
            end
            
            # Replace the filename in the line with (count) filename
            echo $line | string replace $filename "($count) $filename"
        else
            # For files, just output the line as-is
            echo $line
        end
    end
end
