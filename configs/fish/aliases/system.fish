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

# DOCSTRING: Launch Android app by package name with toggle behavior
function launch_android_app
    set -l android_sdk "$HOME/Android/Sdk"
    set -l adb_path "$android_sdk/platform-tools/adb"
    set -l emulator_path "$android_sdk/emulator/emulator"
    
    if not test -f "$adb_path"
        set_color red
        echo "❌ ADB not found at: $adb_path"
        echo "💡 Please make sure Android SDK is installed correctly"
        set_color normal
        return 1
    end
    
    if test (count $argv) -ne 2
        set_color red
        echo "❌ Usage: launch_android_app <app_name> <package_name>"
        echo ""
        set_color yellow
        echo "Example: launch_android_app feeld co.feeld"
        set_color normal
        return 1
    end
    
    set -l app_name $argv[1]
    set -l package_name $argv[2]
    
    # Check if emulator is running
    set -l device_count (string trim ($adb_path devices | tail -n +2 | grep -v '^$' | wc -l))
    
    # If emulator is running, check if app is running and toggle
    if test "$device_count" -gt 0
        set -l app_running ($adb_path shell pidof $package_name 2>/dev/null)
        
        if test -n "$app_running"
            set_color yellow
            echo "🛑 $app_name is running, shutting down emulator..."
            set_color normal
            $adb_path emu kill >/dev/null 2>&1
            set_color green
            echo "✅ Emulator stopped"
            set_color normal
            return 0
        end
    end
    
    # Start emulator if not running
    if test "$device_count" -eq 0
        set_color yellow
        echo "🚀 Starting Android emulator (fast mode)..."
        set_color normal
        
        # Ultra-fast emulator startup with maximum optimizations
        nohup $emulator_path -avd Pixel_9_Pro \
            -no-snapshot-load \
            -no-boot-anim \
            -no-audio \
            -gpu host \
            -accel on \
            -memory 2048 \
            -cores 4 \
            >/dev/null 2>&1 &
        
        set_color cyan
        echo "⏳ Booting..."
        set_color normal
        
        # Wait for device to be online (with timeout)
        set -l timeout 90
        set -l elapsed 0
        while test $elapsed -lt $timeout
            set device_count (string trim ($adb_path devices | tail -n +2 | grep -v '^$' | wc -l))
            if test "$device_count" -gt 0
                # Device is listed, now wait for it to be fully booted
                set -l boot_complete ($adb_path shell getprop sys.boot_completed 2>/dev/null | string trim)
                if test "$boot_complete" = "1"
                    set_color green
                    echo "✅ Emulator ready!"
                    set_color normal
                    sleep 1
                    break
                end
            end
            sleep 1
            set elapsed (math $elapsed + 1)
            if test (math $elapsed % 5) -eq 0
                echo -n "."
            end
        end
        echo ""
        
        if test $elapsed -ge $timeout
            set_color red
            echo "❌ Emulator took too long to start"
            set_color normal
            return 1
        end
    end
    
    set_color yellow
    echo "📱 Launching $app_name..."
    set_color normal
    
    # Try to launch the app
    $adb_path shell monkey -p $package_name -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1
    
    if test $status -eq 0
        set_color green
        echo "✅ $app_name launched successfully!"
        set_color normal
    else
        set_color red
        echo "❌ Failed to launch $app_name"
        echo "💡 Searching for correct package name..."
        set_color normal
        
        # Try to find the package by searching
        set -l found_packages ($adb_path shell pm list packages | grep -i (echo $app_name | string lower) | cut -d: -f2)
        
        if test -n "$found_packages"
            set_color cyan
            echo "📦 Found possible packages:"
            for pkg in $found_packages
                echo "   • $pkg"
            end
            set_color yellow
            echo ""
            echo "💡 Update the function with the correct package name"
            set_color normal
        else
            set_color yellow
            echo "💡 App might not be installed. Install it first."
            set_color normal
        end
        return 1
    end
end

# DOCSTRING: Launch Feeld app in Android emulator (toggle to quit)
function feeld
    launch_android_app "Feeld" "co.feeld"
end

# DOCSTRING: Launch Govee app in Android emulator (toggle to quit)
function govee
    launch_android_app "Govee" "com.govee.home"
end

# DOCSTRING: List all installed packages on Android emulator
function android_packages
    set -l android_sdk "$HOME/Android/Sdk"
    set -l adb_path "$android_sdk/platform-tools/adb"
    
    if not test -f "$adb_path"
        set_color red
        echo "❌ ADB not found"
        set_color normal
        return 1
    end
    
    set -l device_count (string trim ($adb_path devices | tail -n +2 | grep -v '^$' | wc -l))
    
    if test "$device_count" -eq 0
        set_color red
        echo "❌ No emulator running"
        echo "💡 Start an emulator first with: android"
        set_color normal
        return 1
    end
    
    set_color cyan
    echo "📦 Installed packages on emulator:"
    set_color normal
    echo ""
    
    if test (count $argv) -gt 0
        # Search for specific package
        set_color yellow
        echo "Searching for: $argv[1]"
        set_color normal
        $adb_path shell pm list packages | grep -i $argv[1] | cut -d: -f2 | sort
    else
        # List all packages
        $adb_path shell pm list packages -3 | cut -d: -f2 | sort
    end
end

# DOCSTRING: Start Android emulator without Android Studio
function android
    # Check for help flag
    if test "$argv[1]" = "--help" -o "$argv[1]" = "-h"
        set_color cyan
        echo "╔══════════════════════════════════════════════════════════════════════════════╗"
        echo "║                    
         ANDROID EMULATOR LAUNCHER                              ║"
        echo "╚══════════════════════════════════════════════════════════════════════════════╝"
        set_color normal
        echo ""
        set_color yellow
        echo "Usage: android [OPTIONS]"
        echo ""
        set_color green
        echo "Options:"
        printf "  %-20s %s\n" (set_color -o magenta)"-h, --help"(set_color green) (set_color normal)"Show this help message"
        printf "  %-20s %s\n" (set_color -o magenta)"-l, --list"(set_color green) (set_color normal)"List available AVDs"
        printf "  %-20s %s\n" (set_color -o magenta)"-f, --fast"(set_color green) (set_color normal)"Start with performance optimizations"
        printf "  %-20s %s\n" (set_color -o magenta)"-n, --no-window"(set_color green) (set_color normal)"Start without GUI window"
        echo ""
        set_color blue
        echo "Description:"
        echo "  🚀 Launch Android emulator directly without Android Studio"
        echo "  💾 Uses less system resources than full Android Studio"
        echo "  📱 Starts your Pixel 9 Pro emulator by default"
        echo ""
        set_color purple
        echo "Examples:"
        echo "  android          # Start Pixel 9 Pro emulator"
        echo "  android -l       # List all available devices"
        echo "  android -f       # Start with performance optimizations"
        echo "  android -n       # Start without GUI (headless mode)"
        set_color normal
        return 0
    end

    # Set Android SDK path
    set -l android_sdk "$HOME/Android/Sdk"
    set -l emulator_path "$android_sdk/emulator/emulator"

    # Check if emulator exists
    if not test -f "$emulator_path"
        set_color red
        echo "❌ Android emulator not found at: $emulator_path"
        echo "💡 Please make sure Android SDK is installed correctly"
        set_color normal
        return 1
    end

    # Parse arguments
    set -l avd_name "Pixel_9_Pro"
    set -l show_list false
    set -l fast_mode false
    set -l no_window false

    for arg in $argv
        switch $arg
            case -l --list
                set show_list true
            case -f --fast
                set fast_mode true
            case -n --no-window
                set no_window true
            case '-*'
                set_color red
                echo "❌ Unknown option: $arg" >&2
                set_color yellow
                echo "💡 Use 'android --help' for usage information." >&2
                set_color normal
                return 1
        end
    end

    # Show list of available AVDs
    if test $show_list = true
        set_color cyan
        echo "📱 Available Android Virtual Devices:"
        set_color normal
        echo ""
        $emulator_path -list-avds
        echo ""
        return 0
    end

    # Build emulator command
    set -l emu_cmd "$emulator_path -avd $avd_name"

    if test $fast_mode = true
        set emu_cmd $emu_cmd " -no-snapshot -no-boot-anim -no-audio"
        set_color yellow
        echo "🚀 Starting emulator in fast mode..."
    else
        set_color yellow
        echo "🚀 Starting Android emulator..."
    end

    if test $no_window = true
        set emu_cmd $emu_cmd " -no-window"
        echo "🖥️  Starting in headless mode..."
    end

    echo "📱 Device: $avd_name"
    echo ""
    set_color normal

    # Launch emulator
    eval $emu_cmd
end
