function dotfiles-alias-help
    # Check if interactive mode is requested
    if test "$argv[1]" = "--interactive" -o "$argv[1]" = "-i"
        dotfiles-alias-help-interactive
        return
    end
    
    # Regular colored help mode
    dotfiles-alias-help-colored
end

function dotfiles-alias-help-colored
    # Color definitions
    set -l header_color (set_color -o blue)
    set -l section_color (set_color -o cyan)
    set -l alias_color (set_color green)
    set -l command_color (set_color yellow)
    set -l info_color (set_color magenta)
    set -l reset_color (set_color normal)
    
    echo $header_color"🐚 Dotfiles Aliases Help"$reset_color
    echo $header_color"========================"$reset_color
    echo ""

    set script_dir (status --current-filename | xargs dirname)

    for file in $script_dir/*
        set file_basename (basename $file)

        # Skip the loader, helper, and sorter files
        if test $file_basename = "loader.fish" -o $file_basename = "helper.fish" -o $file_basename = "sorter"
            continue
        end

        echo $section_color"📁 " (string upper $file_basename) "Aliases:"$reset_color
        echo $section_color"─────────────────────────────────────────────────────────────"$reset_color

        # Read the file line by line and extract aliases
        set -l alias_count 0
        while read -l line
            if string match -q "alias *" $line
                # Extract alias name and command
                set -l alias_name (echo $line | sed -E 's/alias ([^=]+)=.*/\1/')
                set -l alias_command (echo $line | sed -E 's/alias [^=]+=(.*)/\1/')
                
                # Remove quotes if present
                set alias_command (string replace -r '^["'\'']|["'\'']$' '' $alias_command)
                
                echo "  🔸 " $alias_color$alias_name$reset_color " → " $command_color$alias_command$reset_color
                set alias_count (math $alias_count + 1)
            end
        end < $file
        
        if test $alias_count -eq 0
            echo "  (no aliases found)"
        end
        echo ""
    end

    echo $info_color"💡 Usage:"$reset_color
    echo "  " $alias_color"help"$reset_color", " $alias_color"--help"$reset_color", " $alias_color"--h"$reset_color"  → Show this help"
    echo "  " $alias_color"help -i"$reset_color" or " $alias_color"help --interactive"$reset_color"  → Interactive mode"
    echo "  " $alias_color"alias-help"$reset_color"                      → Show this help (explicit)"
    echo ""
    echo $info_color"📚 Total alias files: " (count (ls $script_dir/* | grep -v "loader.fish\|helper.fish\|sorter"))$reset_color
    echo ""
end

function dotfiles-alias-help-interactive
    # Check if fzf is available
    if not command -q fzf
        echo "Interactive mode requires 'fzf'. Install it first:"
        echo "  Ubuntu/Debian: sudo apt install fzf"
        echo "  macOS: brew install fzf"
        echo "  Or run without -i flag for regular mode"
        return 1
    end
    
    # Color definitions for interactive mode
    set -l header_color (set_color -o blue)
    set -l info_color (set_color magenta)
    set -l reset_color (set_color normal)
    
    echo $header_color"🐚 Interactive Alias Browser"$reset_color
    echo $header_color"============================="$reset_color
    echo $info_color"Use ↑↓ arrows to navigate, Enter to select, Ctrl+C to exit"$reset_color
    echo ""
    
    set script_dir (status --current-filename | xargs dirname)
    set -l temp_file (mktemp)
    
    # Build the interactive menu
    for file in $script_dir/*
        set file_basename (basename $file)
        
        # Skip system files
        if test $file_basename = "loader.fish" -o $file_basename = "helper.fish" -o $file_basename = "sorter"
            continue
        end
        
        echo "📁 $file_basename" >> $temp_file
        
        # Add aliases from this file
        while read -l line
            if string match -q "alias *" $line
                set -l alias_name (echo $line | sed -E 's/alias ([^=]+)=.*/\1/')
                set -l alias_command (echo $line | sed -E 's/alias [^=]+=(.*)/\1/')
                set alias_command (string replace -r '^["'\'']|["'\'']$' '' $alias_command)
                echo "  🔸 $alias_name → $alias_command" >> $temp_file
            end
        end < $file
        
        echo "" >> $temp_file
    end
    
    # Show interactive menu
    cat $temp_file | fzf --height=20 --preview="echo 'Selected: {}'" --preview-window=up:3
    
    # Cleanup
    rm $temp_file
end

# Create convenient aliases for the helper function
alias alias-help='dotfiles-alias-help'
alias help='dotfiles-alias-help'
alias --help='dotfiles-alias-help'
alias --h='dotfiles-alias-help'