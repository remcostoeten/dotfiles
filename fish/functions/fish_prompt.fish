# Helper function to get system memory usage
function __fish_prompt_get_memory
    set -l used (free -m | awk 'NR==2 {print $3}')
    set -l total (free -m | awk 'NR==2 {print $2}')
    set -l percentage (math "round(($used / $total) * 100)")
    echo "$percentage%"
end

# Helper function to get CPU usage
function __fish_prompt_get_cpu
    set -l cpu (top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d. -f1)
    echo "$cpu%"
end

# Helper function to get current background jobs
function __fish_prompt_get_jobs
    set -l jobs_count (jobs | wc -l)
    if test $jobs_count -gt 0
        echo "⚙ $jobs_count"
    end
end

function fish_prompt
    # Save the status of the last command
    set -l last_status $status

    # Define our pastel colors and symbols
    # Nerd Font symbols (make sure you have a Nerd Font installed)
    set -l symbol_git "\ue725"  # Git symbol
    set -l symbol_folder "\uf115" # Folder symbol
    set -l symbol_branch "\uf418" # Branch symbol
    set -l symbol_clock "\uf64f"  # Clock symbol
    set -l symbol_node "\ue718"   # Node.js symbol
    set -l symbol_cpu "\uf4bc"    # CPU symbol
    set -l symbol_ram "\uf85a"    # RAM symbol
    set -l symbol_user "\uf007"   # User symbol
    set -l symbol_host "\uf015"   # Host symbol
    
    # Separators
    set -l separator_right "\ue0b0" # Right arrow separator
    set -l separator_right_thin "\ue0b1"
    set -l separator_left "\ue0b2"  # Left arrow separator
    set -l separator_left_thin "\ue0b3"

    # Define our pastel colors
    set -l pastel_pink (set_color faa2c1)
    set -l pastel_purple (set_color d4bbf8)
    set -l pastel_blue (set_color a5d8ff)
    set -l pastel_green (set_color b2f2bb)
    set -l pastel_yellow (set_color ffec99)
    set -l pastel_orange (set_color ffd8a8)
    set -l pastel_red (set_color ff8787)
    set -l pastel_cyan (set_color 89dceb)
    set -l pastel_magenta (set_color f5c2e7)
    set -l bg_pink (set_color -b faa2c1)
    set -l bg_purple (set_color -b d4bbf8)
    set -l bg_blue (set_color -b a5d8ff)
    set -l bg_green (set_color -b b2f2bb)
    set -l bg_yellow (set_color -b ffec99)
    set -l bg_orange (set_color -b ffd8a8)
    set -l bg_red (set_color -b ff8787)
    set -l bg_cyan (set_color -b 89dceb)
    set -l bg_magenta (set_color -b f5c2e7)
    set -l normal (set_color normal)
    set -l black (set_color 000000)

    # Git information
    set -l git_info
    if command -sq git
        and test -d (git rev-parse --git-dir 2>/dev/null)
        set -l git_branch (git symbolic-ref --short HEAD 2>/dev/null; or git rev-parse --short HEAD 2>/dev/null)
        set -l git_dirty (git status -s)
        
        if test -n "$git_branch"
            set git_info "$pastel_purple($git_branch"
            if test -n "$git_dirty"
                set git_info "$git_info ✗"
            else
                set git_info "$git_info ✓"
            end
            set git_info "$git_info)"
        end
    end

    # Current working directory
    set -l cwd
    if test "$PWD" = "$HOME"
        set cwd "~"
    else
        set cwd (basename $PWD)
    end

    # Time
    set -l current_time (date "+%H:%M")

    # Determine arrow color based on last command status
    set -l arrow_color
    if test $last_status -eq 0
        set arrow_color $pastel_green
    else
        set arrow_color $red
    end

    # Node.js version if in a JavaScript project
    set -l node_version
    if test -f package.json
        or test -f yarn.lock
        or test -f pnpm-lock.yaml
        or test -f bun.lockb
        set node_version "$pastel_orange($(node -v | sed 's/v//')"
    end

    # Get system info
    set -l cpu_usage (__fish_prompt_get_cpu)
    set -l mem_usage (__fish_prompt_get_memory)
    set -l jobs_info (__fish_prompt_get_jobs)

    # Build the prompt based on layout preference
    if test "$prompt_two_line" = true
        # First line - System info
        echo
        
        # Username and hostname
        echo -n "$bg_purple$black $symbol_user $USER "
        echo -n "$pastel_purple$separator_right$bg_blue$black $symbol_host $hostname "
        
        # System resources
        echo -n "$pastel_blue$separator_right$bg_cyan$black $symbol_cpu $cpu_usage "
        echo -n "$pastel_cyan$separator_right$bg_magenta$black $symbol_ram $mem_usage "
        
        # Time
        echo -n "$pastel_magenta$separator_right$bg_orange$black $symbol_clock $current_time"
        echo -n "$pastel_orange$separator_right$normal "
        
        # Background jobs if any
        if test -n "$jobs_info"
            echo -n "$pastel_yellow$jobs_info "
        end
        echo

        # Second line - Directory and git info
        echo -n "$bg_green$black $symbol_folder "
        echo -n "$cwd "
        
        if test -n "$git_info"
            echo -n "$pastel_green$separator_right$bg_pink$black $symbol_git "
            echo -n (string replace -a '(' '' (string replace -a ')' '' $git_info))
            echo -n "$pastel_pink$separator_right "
        else
            echo -n "$pastel_green$separator_right "
        end

        if test -n "$node_version"
            echo -n "$pastel_blue$symbol_node "
            echo -n (string replace -a '(' '' (string replace -a ')' '' $node_version))
            echo -n " "
        end

        # Command status indicator
        echo -e "\n$arrow_color➜ $normal"
    else
        # Single-line compact version
        echo -n "$bg_purple$black $symbol_folder "
        echo -n "$cwd "
        echo -n "$pastel_purple$separator_right "
        
        if test -n "$git_info"
            echo -n "$pastel_pink$symbol_git "
            echo -n (string replace -a '(' '' (string replace -a ')' '' $git_info))
            echo -n " "
        end

        if test -n "$node_version"
            echo -n "$pastel_blue$symbol_node "
            echo -n (string replace -a '(' '' (string replace -a ')' '' $node_version))
            echo -n " "
        end

        echo -n "$pastel_yellow$symbol_clock $current_time "
        echo -n "$arrow_color➜ $normal"
    end
end

# Function to quickly switch between one and two lines
function prompt_mode
    if count $argv > /dev/null
        switch $argv[1]
            case "1" "single" "one"
                set -g prompt_two_line false
            case "2" "double" "two"
                set -g prompt_two_line true
            case "*"
                echo "Usage: prompt_mode [1|2|single|double|one|two]"
                return 1
        end
    end
    # Display current mode
    if test "$prompt_two_line" = true
        echo "Current prompt mode: Two-line"
    else
        echo "Current prompt mode: Single-line"
    end
end
