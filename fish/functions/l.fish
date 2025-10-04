function l --description 'eza listing with folder/file counts for directories'
    # Get target directory
    set -l target_dir "."
    if test (count $argv) -gt 0
        set target_dir $argv[1]
    end
    
    # Get clean and colored eza output
    set -l clean_output (eza -l --no-permissions --no-user --no-time --group-directories-first --icons --color=never --classify $target_dir)
    set -l color_output (eza -l --no-permissions --no-user --no-time --group-directories-first --icons --color=always --classify $target_dir)
    
    # Convert to arrays properly
    set -l clean_lines
    set -l color_lines
    
    for line in $clean_output
        set -a clean_lines $line
    end
    
    for line in $color_output
        set -a color_lines $line
    end
    
    # Process each line
    for i in (seq 1 (count $clean_lines))
        set -l clean_line $clean_lines[$i]
        set -l color_line $color_lines[$i]
        
        # Extract filename
        set -l filename (echo $clean_line | string trim | string split -r ' ' | tail -1)
        
        # Build full path
        set -l full_path $filename
        if test "$target_dir" != "."
            set full_path "$target_dir/$filename"
        end
        
        # Check if directory and add counts
        if test -d $full_path
            # Count items
            set -l folder_count (find $full_path -maxdepth 1 -type d 2>/dev/null | tail -n +2 | wc -l | string trim)
            set -l file_count (find $full_path -maxdepth 1 -type f 2>/dev/null | wc -l | string trim)
            
            # Build count string
            set -l count_str ""
            if test $folder_count -gt 0
                set count_str "📁$folder_count"
            end
            if test $file_count -gt 0
                if test -n "$count_str"
                    set count_str "$count_str 📄$file_count"
                else
                    set count_str "📄$file_count"
                end
            end
            
            if test -n "$count_str"
                set count_str "($count_str)"
            else
                set count_str "(empty)"
            end
            
            # Output modified line
            echo $color_line | string replace $filename "$count_str $filename"
        else
            # Output original line
            echo $color_line
        end
    end
end
