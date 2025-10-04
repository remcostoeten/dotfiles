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

# DOCSTRING: Quick access to dotfiles directory
function dotfiles
    # Check for help flag
    if test "$argv[1]" = "--help" -o "$argv[1]" = "-h"
        _show_dotfiles_help
        return 0
    end
    
    cd ~/.config/dotfiles
end

# Show help for dotfiles command
function _show_dotfiles_help
    set_color cyan
    echo "Dotfiles Management System"
    set_color normal
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

# DOCSTRING: Show disk free space
alias df='df -h'

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

# DOCSTRING: Replace ls with exa
alias ls='exa'

# DOCSTRING: Custom l alias with icons (backup - replaced by function)
alias l_orig='exa -l --no-permissions --no-user --no-time --group-directories-first --icons'
# alias l='exa -l --no-permissions --no-user --no-time --group-directories-first --icons'

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
