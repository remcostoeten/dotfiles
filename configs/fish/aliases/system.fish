#!/usr/bin/env fish

# System aliases

# DOCSTRING: Clear terminal screen
alias c 'clear'

# DOCSTRING: Exit terminal/shell
alias x 'exit'

# DOCSTRING: Open current directory in file manager
function .
    xdg-open .
end

# DOCSTRING: Reboot system
alias reboot 'sudo reboot now'

# DOCSTRING: Power off system
alias poweroff 'sudo poweroff'

# DOCSTRING: Boot into BIOS/UEFI
alias bios 'sudo systemctl reboot --firmware-setup'

# DOCSTRING: Use python3 as python
alias python 'python3'

# DOCSTRING: Use python3 as py
alias py 'python3'

# DOCSTRING: Use pip3 as pip
alias pip 'pip3'

# DOCSTRING: Reload fish configuration
function reload
    # Check for help flag
    if test "$argv[1]" = "--help" -o "$argv[1]" = "-h"
        echo "Reload fish configuration"
        echo ""
        echo "Usage: reload [OPTIONS]"
        echo ""
        echo "Options:"
        echo "  -h, --help    Show this help message"
        echo ""
        echo "Description:"
        echo "  Reloads the current fish shell configuration by starting"
        echo "  a new fish session. This applies all changes made to"
        echo "  configuration files without needing to restart the terminal."
        echo ""
        echo "Examples:"
        echo "  reload        # Reload fish configuration"
        echo "  reload -h     # Show this help"
        return 0
    end
    
    echo "Reloading fish configuration..."
    exec fish
end

# DOCSTRING: Comprehensive dotfiles management hub - your central command center
function dotfiles
    # Use the new comprehensive CLI system
    command dotfiles $argv
end

# Show help for dotfiles command
function _show_dotfiles_help
    c "Dotfiles Management System"
    echo ""
    echo "Usage: dotfiles [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -h, --help    Show this help message"
    echo ""
    echo "Examples:"
    echo "  dotfiles      # Navigate to dotfiles directory"
    echo "  dotfiles -h   # Show this help"
    echo ""
    echo "Related commands:"
    echo "  help --all    # Show all available aliases and functions"
    echo "  reload        # Reload fish configuration"
    echo "  aliases --help # Show alias management help"
end

# DOCSTRING: Show disk usage in human-readable format
alias du='du -h'

# DOCSTRING: Show disk free space (handled by df function in config.fish)
# alias df='df -h'  # Commented out to avoid conflict with df function

# DOCSTRING: Show running processes
alias ps='ps aux'

# DOCSTRING: Grep with color
alias grep='grep --color=auto'

# DOCSTRING: rm + folder removal
alias rm='rm -rf'

# DOCSTRING: Create parent directories as needed
alias mkdir='mkdir -p'

# DOCSTRING: Go back one directory
alias ..='cd ..'

# DOCSTRING: Go back two directories
alias ...='cd ../..'

# DOCSTRING: Go back three directories
alias ....='cd ../../..'

# DOCSTRING: zoxide directory jumping alias
# Note: zoxide init fish creates the 'z' command automatically

# DOCSTRING: Replace ls with exa
alias ls='exa'

# DOCSTRING: Custom list command showing size and name with ricer styling
function l
    # Check for help flag
    if test "$argv[1]" = "--help" -o "$argv[1]" = "-h"
        set_color cyan
        echo "╔══════════════════════════════════════════════════════════════════════════════╗"
        echo "║                         L - RICER DIRECTORY LISTER                         ║"
        echo "╚══════════════════════════════════════════════════════════════════════════════╝"
        set_color normal
        echo ""
        set_color yellow
        echo "Usage: l [OPTIONS] [PATH]"
        echo ""
        set_color green
        echo "Options:"
        printf "  %-20s %s\n" (set_color -o magenta)"-h, --help"(set_color green) (set_color normal)"Show this help message"
        printf "  %-20s %s\n" (set_color -o magenta)"-a, --all"(set_color green) (set_color normal)"Show hidden files"
        echo ""
        set_color blue
        echo "Description:"
        echo "  🎨 Ricer-style directory listing with colors and visual flair"
        echo "  📊 Shows: size • type indicators • styled names"
        echo "  🎯 Minimal output, maximum aesthetics"
        echo ""
        set_color purple
        echo "Examples:"
        echo "  l             # List current directory"
        echo "  l -a          # Include hidden files"
        echo "  l /path/to/dir # List specific directory"
        set_color normal
        return 0
    end

    set -l show_hidden false
    set -l target_path "."
    set -l use_grid false

    # Parse arguments
    for arg in $argv
        switch $arg
            case -a --all
                set show_hidden true
            case -g --grid
                set use_grid true
            case '-*'
                set_color red
                echo "❌ Unknown option: $arg" >&2
                set_color yellow
                echo "💡 Use 'l --help' for usage information." >&2
                set_color normal
                return 1
            case '*'
                if test -d $arg
                    set target_path $arg
                else
                    set_color red
                    echo "❌ Not a directory: $arg" >&2
                    set_color normal
                    return 1
                end
        end
    end

    # Set custom LS_COLORS for better visual distinction
    set -x LS_COLORS 'di=01;34:fi=00:ex=01;32:ln=01;36:*.md=01;33:*.json=01;35:*.js=01;31:*.ts=01;31:*.tsx=01;31:*.jsx=01;31:*.py=01;36:*.go=01;32:*.rs=01;33:*.php=01;35:*.css=01;36:*.scss=01;36:*.html=01;33:*.vue=01;32:*.svelte=01;32:*.yaml=01;35:*.yml=01;35:*.toml=01;35:*.xml=01;33:*.sql=01;36:*.sh=01;32:*.fish=01;32:*.zsh=01;32:*.bash=01;32:*.png=01;35:*.jpg=01;35:*.jpeg=01;35:*.gif=01;35:*.svg=01;35:*.ico=01;35'

    # Build exa command with enhanced options (no header to avoid conflicts)
    set -l exa_cmd exa -l --no-permissions --no-user --no-time --group-directories-first --binary --color=always --icons

    if test $show_hidden = true
        set exa_cmd $exa_cmd --all
    end


    # Run the command and post-process with colors and formatting
    set -l exa_output (eval $exa_cmd $target_path)

    # Add custom styling
    if test -n "$exa_output"
        # Print header with styling
        set_color -o cyan
        echo "╭─────────────────────────────────────────────────────────────────╮"
        echo "│ 📂 "(set_color -o yellow)(basename $target_path)(set_color -o cyan)" - Directory Contents           │"
        echo "╰─────────────────────────────────────────────────────────────────╯"
        set_color normal
        echo ""

        # Print column headers
        set_color -o cyan
        printf "%-10s %s\n" "Size" "Name"
        set_color -o white
        echo "─────────────────────────────────────────────────────────────────"
        set_color normal
        echo ""

          # Get clean exa output without color codes for parsing
    set -l clean_output (eval $exa_cmd $target_path | string replace -r '\x1b\[[0-9;]*m' '')

    # Process each line
    for line in $clean_output
        # Skip empty lines
        if test -z "$line"
            continue
        end

        # Parse the line format: "size name"
        set size_part (echo $line | awk '{print $1}')
        set name_part (echo $line | cut -d' ' -f2- | string trim)

        # Clean size_part from any remaining color codes
        set size_part (echo $size_part | string replace -r '\x1b\[[0-9;]*m' '')

        # Check if it's a directory
        if string match -q "*/" $name_part
            # Print directory entry
            printf "%-10s " $size_part
            set_color -o blue
            echo $name_part
            set_color normal
        else
            # Regular file with size coloring
            printf "%-10s " $size_part
            
            # Determine color based on size pattern
            if string match -q "*B" $size_part
                set_color -o green
            else if string match -q "*K" $size_part
                set_color -o yellow
            else if string match -q "*M" $size_part
                set_color -o orange
            else
                set_color -o red
            end

            echo $name_part
            set_color normal
        end
    end

        # Add footer with file count
        set -l total_count (eval $exa_cmd $target_path 2>/dev/null | wc -l)
        if test $total_count -gt 0
            echo ""
            set_color -o magenta
            echo "└─ 📊 "$total_count" items"
            set_color normal
        end
    else
        set_color red
        echo "❌ Directory empty or not accessible"
        set_color normal
    end

    # Reset LS_COLORS
    set -e LS_COLORS
end

# DOCSTRING: Colorized tree output with better colors and comprehensive ignore patterns
function tree
    # Comprehensive ignore patterns - always ignore these directories and files
    set -l ignore_patterns '.git|node_modules|.next|.nuxt|dist|build|tmp|temp|.tmp|.temp|*.log|.DS_Store|.vscode|.idea|coverage|.nyc_output|.cache|.parcel-cache|.turbo|.vercel|.netlify|__pycache__|*.pyc|.pytest_cache|target|Cargo.lock|vendor|.bundle|.sass-cache|.env.local|.env.*.local'
    
    # Enhanced default options with better colors and file info
    set -l default_opts -C -a -F --dirsfirst -I $ignore_patterns
    
    # Set custom colors for tree (using environment variables)
    # Directories: bold blue, files: white, executables: green, links: cyan
    set -x LS_COLORS 'di=01;34:fi=00:ex=01;32:ln=01;36:*.md=01;33:*.json=01;35:*.js=01;31:*.ts=01;31:*.tsx=01;31:*.jsx=01;31:*.py=01;36:*.go=01;32:*.rs=01;33:*.php=01;35:*.css=01;36:*.scss=01;36:*.html=01;33:*.vue=01;32:*.svelte=01;32:*.yaml=01;35:*.yml=01;35:*.toml=01;35:*.xml=01;33:*.sql=01;36:*.sh=01;32:*.fish=01;32:*.zsh=01;32:*.bash=01;32'
    
    # If no arguments provided, use default depth of 3
    if test (count $argv) -eq 0
        command tree $default_opts -L 3
    else
        # Check if user provided -L flag, if not add default depth
        set -l has_depth_flag false
        for arg in $argv
            if string match -q -- '-L*' $arg; or string match -q -- '--level*' $arg
                set has_depth_flag true
                break
            end
        end
        
        if test $has_depth_flag = false
            command tree $default_opts -L 3 $argv
        else
            command tree $default_opts $argv
        end
    end
end

# DOCSTRING: Alternative tree using exa with better colors (use 'etree' command)
function etree
    # Comprehensive ignore patterns
    set -l ignore_git '--ignore-glob=.git'
    set -l ignore_node '--ignore-glob=node_modules'
    set -l ignore_build '--ignore-glob={dist,build,tmp,temp,.tmp,.temp,target}'
    set -l ignore_cache '--ignore-glob={.cache,.parcel-cache,.turbo,.vercel,.netlify,__pycache__,.pytest_cache}'
    set -l ignore_dot '--ignore-glob=.{next,nuxt,vscode,idea,DS_Store,sass-cache,nyc_output,bundle}'
    set -l ignore_env '--ignore-glob=.env*.local'
    set -l ignore_logs '--ignore-glob=*.log'
    
    set -l all_ignores $ignore_git $ignore_node $ignore_build $ignore_cache $ignore_dot $ignore_env $ignore_logs
    
    # Default depth
    set -l depth 3
    
    # Check if user provided custom depth
    set -l custom_path '.'
    for i in (seq (count $argv))
        if test $argv[$i] = '-L'
            if test (count $argv) -gt $i
                set depth $argv[(math $i + 1)]
            end
        else if string match -q -- '-L*' $argv[$i]
            set depth (string sub -s 3 $argv[$i])
        else if test -d $argv[$i]
            set custom_path $argv[$i]
        end
    end
    
    # Run exa tree with colors, icons, and git status
    exa --tree --level=$depth --color=always --icons --git-ignore $all_ignores $custom_path
end
