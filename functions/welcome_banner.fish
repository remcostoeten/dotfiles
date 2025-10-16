function welcome_banner -d "Display welcome banner with ASCII art and last update info"
    # Define pastel colors matching the fish prompt
    set -l pastel_pink (set_color faa2c1)
    set -l pastel_purple (set_color d4bbf8)
    set -l pastel_blue (set_color a5d8ff)
    set -l pastel_green (set_color b2f2bb)
    set -l pastel_yellow (set_color ffec99)
    set -l pastel_orange (set_color ffd8a8)
    set -l pastel_red (set_color ff8787)
    set -l pastel_cyan (set_color 89dceb)
    set -l pastel_magenta (set_color f5c2e7)
    set -l normal (set_color normal)

    printf "%s%s\n" "$pastel_cyan" "╔═══════════════════════════════════════════════════╗"
    printf "%s%s\n" "$pastel_pink" "║  ██████╗ ███████╗███╗   ███╗ ██████╗ ██████╗    ║"
    printf "%s%s\n" "$pastel_magenta" "║  ██╔══██╗██╔════╝████╗ ████║██╔════╝██╔═══██╗   ║"
    printf "%s%s\n" "$pastel_purple" "║  ██████╔╝█████╗  ██╔████╔██║██║     ██║   ██║   ║"
    printf "%s%s\n" "$pastel_blue" "║  ██╔══██╗██╔══╝  ██║╚██╔╝██║██║     ██║   ██║   ║"
    printf "%s%s\n" "$pastel_cyan" "║  ██║  ██║███████╗██║ ╚═╝ ██║╚██████╗╚██████╔╝   ║"
    printf "%s%s\n" "$pastel_green" "║  ╚═╝  ╚═╝╚══════╝╚═╝     ╚═╝ ╚═════╝ ╚═════╝    ║"
    printf "%s%s\n" "$pastel_orange" "╠═══════════════════════════════════════════════════╣"
    
    set -l dotfiles_dir "$HOME/.config/dotfiles"
    if test -d "$dotfiles_dir/.git"
        set -l last_commit (git --no-pager -C "$dotfiles_dir" log -1 --format="%ci" 2>/dev/null)
        if test -n "$last_commit"
            set -l formatted_date (date -d "$last_commit" "+%Y-%m-%d %H:%M" 2>/dev/null)
            if test -n "$formatted_date"
                printf "%s%s%s\n" "$pastel_yellow" "║  Last updated: $formatted_date                   ║" "$normal"
            else
                printf "%s%s%s\n" "$pastel_yellow" "║  Last updated: $last_commit              ║" "$normal"
            end
        else
            printf "%s%s%s\n" "$pastel_yellow" "║  Last updated: Unknown                            ║" "$normal"
        end
    else
        printf "%s%s%s\n" "$pastel_yellow" "║  Last updated: Not a git repository               ║" "$normal"
    end

    printf "%s%s%s\n" "$pastel_red" "╚═══════════════════════════════════════════════════╝" "$normal"
end
