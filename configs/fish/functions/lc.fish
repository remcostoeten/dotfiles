function lc --description 'List with sizes, icons, and item count for directories'
    # First list directories
    for item in (ls -1)
        if test -d $item
            set -l count (count (command ls -A $item 2>/dev/null))
            set -l size (du -sh $item 2>/dev/null | cut -f1)
            printf "%-6s   %-30s (%d items)\n" $size $item $count
        end
    end
    
    # Then list files
    for item in (ls -1)
        if test -f $item
            set -l size (du -h $item 2>/dev/null | cut -f1)
            set -l icon_output (exa --icons $item)
            printf "%-6s %s\n" $size $icon_output
        end
    end
end
