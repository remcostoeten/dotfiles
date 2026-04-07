#!/usr/bin/env fish

# DOCSTRING: Open current directory in file manager
function .
    xdg-open .
end

# DOCSTRING: Go back one directory
alias ..='cd ..'

# DOCSTRING: Go back two directories
alias ...='cd ../..'

# DOCSTRING: Go back three directories
alias ....='cd ../../..'

# DOCSTRING: Replace ls with exa
alias ls='eza --icons'

# DOCSTRING: Better find replacement
if type -q fd
    alias find='fd'
else
    alias find='find'
end

# DOCSTRING: Custom list command showing size and name with ricer styling
function l
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
        echo "  l              # List current directory"
        echo "  l -a           # Include hidden files"
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
    set -l ignore_patterns '.git|node_modules|.next|.nuxt|dist|build|tmp|temp|.tmp|.temp|*.log|.DS_Store|.vscode|.idea|coverage|.nyc_output|.cache|.parcel-cache|.turbo|.vercel|.netlify|__pycache__|*.pyc|.pytest_cache|target|Cargo.lock|vendor|.bundle|.sass-cache|.env.local|.env.*.local'
    set -l default_opts -C -a -F --dirsfirst -I $ignore_patterns
    set -x LS_COLORS 'di=01;34:fi=00:ex=01;32:ln=01;36:*.md=01;33:*.json=01;35:*.js=01;31:*.ts=01;31:*.tsx=01;31:*.jsx=01;31:*.py=01;36:*.go=01;32:*.rs=01;33:*.php=01;35:*.css=01;36:*.scss=01;36:*.html=01;33:*.vue=01;32:*.svelte=01;32:*.yaml=01;35:*.yml=01;35:*.toml=01;35:*.xml=01;33:*.sql=01;36:*.sh=01;32:*.fish=01;32:*.zsh=01;32:*.bash=01;32'

    if test (count $argv) -eq 0
        command tree $default_opts -L 3
    else
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
    set -l ignore_git '--ignore-glob=.git'
    set -l ignore_node '--ignore-glob=node_modules'
    set -l ignore_build '--ignore-glob={dist,build,tmp,temp,.tmp,.temp,target}'
    set -l ignore_cache '--ignore-glob={.cache,.parcel-cache,.turbo,.vercel,.netlify,__pycache__,.pytest_cache}'
    set -l ignore_dot '--ignore-glob=.{next,nuxt,vscode,idea,DS_Store,sass-cache,nyc_output,bundle}'
    set -l ignore_env '--ignore-glob=.env*.local'
    set -l ignore_logs '--ignore-glob=*.log'
    set -l all_ignores $ignore_git $ignore_node $ignore_build $ignore_cache $ignore_dot $ignore_env $ignore_logs
    set -l depth 3
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

    exa --tree --level=$depth --color=always --icons --git-ignore $all_ignores $custom_path
end
