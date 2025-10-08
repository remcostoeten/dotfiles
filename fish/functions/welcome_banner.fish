function welcome_banner -d "Display welcome banner with ASCII art and last update info"
    set_color cyan --bold
    echo "╔═══════════════════════════════════════════════════╗"
    set_color brmagenta --bold
    echo "║  ██████╗ ███████╗███╗   ███╗ ██████╗ ██████╗    ║"
    echo "║  ██╔══██╗██╔════╝████╗ ████║██╔════╝██╔═══██╗   ║"
    echo "║  ██████╔╝█████╗  ██╔████╔██║██║     ██║   ██║   ║"
    echo "║  ██╔══██╗██╔══╝  ██║╚██╔╝██║██║     ██║   ██║   ║"
    echo "║  ██║  ██║███████╗██║ ╚═╝ ██║╚██████╗╚██████╔╝   ║"
    echo "║  ╚═╝  ╚═╝╚══════╝╚═╝     ╚═╝ ╚═════╝ ╚═════╝    ║"
    set_color cyan --bold
    echo "╠═══════════════════════════════════════════════════╣"
    set_color yellow
    
    set -l dotfiles_dir "$HOME/.config/dotfiles"
    if test -d "$dotfiles_dir/.git"
        set -l last_commit (git --no-pager -C "$dotfiles_dir" log -1 --format="%ci" 2>/dev/null)
        if test -n "$last_commit"
            set -l formatted_date (date -d "$last_commit" "+%Y-%m-%d %H:%M" 2>/dev/null)
            if test -n "$formatted_date"
                echo "║  Last updated: $formatted_date                   ║"
            else
                echo "║  Last updated: $last_commit              ║"
            end
        else
            echo "║  Last updated: Unknown                            ║"
        end
    else
        echo "║  Last updated: Not a git repository               ║"
    end
    
    set_color cyan --bold
    echo "╚═══════════════════════════════════════════════════╝"
    set_color normal
end
