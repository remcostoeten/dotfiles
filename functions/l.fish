function l --description 'Enhanced eza listing with better alignment and metrics'
    set -l target_dir "."
    if test (count $argv) -gt 0
        set target_dir $argv[1]
    end
    
    eza -lah \
        --group-directories-first \
        --icons \
        --git \
        --time-style=relative \
        --sort=name \
        --color=always \
        --classify \
        $target_dir | while read -l line
        
        set -l line_trimmed (echo $line | string trim)
        
        if test -z "$line_trimmed"
            continue
        end
        
        set -l parts (echo $line_trimmed | string split -r -m1 ' ')
        if test (count $parts) -lt 2
            echo $line
            continue
        end
        
        set -l filename $parts[-1]
        set -l full_path "$target_dir/$filename"
        
        if test -L "$full_path"
            set -l link_target (readlink "$full_path")
            set -l link_info (printf "🔗 -> %s" $link_target)
            echo $line | string replace -r "($filename)\$" "\$1 $link_info"
        else if test -d "$full_path"
            set -l folder_count (find "$full_path" -maxdepth 1 -type d 2>/dev/null | tail -n +2 | wc -l | string trim)
            set -l file_count (find "$full_path" -maxdepth 1 -type f 2>/dev/null | wc -l | string trim)
            
            set -l count_str ""
            if test $folder_count -gt 0 -a $file_count -gt 0
                set count_str (printf "(📁%-2s 📄%-2s)" $folder_count $file_count)
            else if test $folder_count -gt 0
                set count_str (printf "(📁%-2s)     " $folder_count)
            else if test $file_count -gt 0
                set count_str (printf "(📄%-2s)     " $file_count)
            else
                set count_str "(empty)    "
            end
            
            echo $line | string replace -r "($filename)\$" "$count_str \$1"
        else
            echo $line
        end
    end
end
