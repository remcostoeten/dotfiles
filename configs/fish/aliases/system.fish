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

# DOCSTRING: Quick access to dotfiles interactive menu
alias df 'dotfiles'

# DOCSTRING: Todo/task manager - interactive CLI todo manager
alias todo '$HOME/.config/dotfiles/bin/todo'

# DOCSTRING: Scripts selector - interactive script selector
alias scripts '$HOME/.config/dotfiles/bin/scripts'

# DOCSTRING: Dotfiles command - main interface
function dotfiles
    # Check if interactive mode is requested
    if test (count $argv) -eq 0
        # No arguments - show help instead of interactive mode
        echo "⚠️  Use 'dotfiles -i' or 'dotfiles i' for interactive mode. Showing help instead:"
        echo ""
        command bun ~/.config/dotfiles/scripts/dotfiles.ts --help
        echo ""
        echo "💡 You can use these specific commands:"
        echo "   • dotfiles -i / dotfiles i          - Interactive menu (when terminal supports it)"
        echo "   • dotfiles list                    - Show all available tools"
        echo "   • dotfiles search <term>           - Search for tools"
        echo "   • dotfiles run <tool_name>         - Execute a specific tool"
        echo "   • dotfiles categories              - Show all categories"
    else if contains -- --i $argv[1]; or contains -- -i $argv[1]; or contains -- i $argv[1]
        # Interactive mode requested - try it with error handling
        if test -t 1; and status --is-interactive
            echo "🚀 Launching interactive dotfiles menu..."
            command bun ~/.config/dotfiles/scripts/dotfiles.ts interactive
            if test $status -ne 0
                echo ""
                echo "❌ Interactive mode failed. Falling back to help:"
                command bun ~/.config/dotfiles/scripts/dotfiles.ts --help
            end
        else
            echo "⚠️  Interactive mode requires a proper terminal. Showing help instead:"
            echo ""
            command bun ~/.config/dotfiles/scripts/dotfiles.ts --help
            echo ""
            echo "💡 To use interactive mode, run this in a proper terminal:"
            echo "   bun ~/.config/dotfiles/scripts/dotfiles.ts"
        end
    else
        # Other arguments provided, pass them through
        command bun ~/.config/dotfiles/scripts/dotfiles.ts $argv
    end
end

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
    if set -q argv[1]; and string match -q -- "-h" "--help" $argv[1]
        set_color cyan
        echo "╔══════════════════════════════════════════════════════════════════════════════╗"
        echo "║                         L - DIRECTORY LISTER                                 ║"
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
        echo "  🎨 Directory listing with colors and icons"
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

    set -l exa_args
    set -l path_arg
    for arg in $argv
        switch $arg
            case -a --all
                set -a exa_args --all
            case '-*'
                echo "Unknown option: $arg" >&2
                return 1
            case '*'
                set path_arg $arg
        end
    end

    if not set -q path_arg
        set path_arg .
    end

    exa -l --icons --color=always --group-directories-first $exa_args $path_arg
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
