function welcome_banner -d "Display welcome banner with ASCII art and last update info"
    printf "%s%s\n" "$fish_color_cyan$fish_color_bold" "╔═══════════════════════════════════════════════════╗"
    printf "%s%s\n" "$fish_color_bright_magenta$fish_color_bold" "║  ██████╗ ███████╗███╗   ███╗ ██████╗ ██████╗    ║"
    printf "%s%s\n" "$fish_color_bright_magenta$fish_color_bold" "║  ██╔══██╗██╔════╝████╗ ████║██╔════╝██╔═══██╗   ║"
    printf "%s%s\n" "$fish_color_bright_magenta$fish_color_bold" "║  ██████╔╝█████╗  ██╔████╔██║██║     ██║   ██║   ║"
    printf "%s%s\n" "$fish_color_bright_magenta$fish_color_bold" "║  ██╔══██╗██╔══╝  ██║╚██╔╝██║██║     ██║   ██║   ║"
    printf "%s%s\n" "$fish_color_bright_magenta$fish_color_bold" "║  ██║  ██║███████╗██║ ╚═╝ ██║╚██████╗╚██████╔╝   ║"
    printf "%s%s\n" "$fish_color_bright_magenta$fish_color_bold" "║  ╚═╝  ╚═╝╚══════╝╚═╝     ╚═╝ ╚═════╝ ╚═════╝    ║"
    printf "%s%s\n" "$fish_color_cyan$fish_color_bold" "╠═══════════════════════════════════════════════════╣"
    
    set -l dotfiles_dir "$HOME/.config/dotfiles"
    if test -d "$dotfiles_dir/.git"
        set -l last_commit (git --no-pager -C "$dotfiles_dir" log -1 --format="%ci" 2>/dev/null)
        if test -n "$last_commit"
            set -l formatted_date (date -d "$last_commit" "+%Y-%m-%d %H:%M" 2>/dev/null)
            if test -n "$formatted_date"
                printf "%s%s%s\n" "$fish_color_yellow" "║  Last updated: $formatted_date                   ║" "$fish_color_reset"
            else
                printf "%s%s%s\n" "$fish_color_yellow" "║  Last updated: $last_commit              ║" "$fish_color_reset"
            end
        else
            printf "%s%s%s\n" "$fish_color_yellow" "║  Last updated: Unknown                            ║" "$fish_color_reset"
        end
    else
        printf "%s%s%s\n" "$fish_color_yellow" "║  Last updated: Not a git repository               ║" "$fish_color_reset"
    end
    
    printf "%s%s%s\n" "$fish_color_cyan$fish_color_bold" "╚═══════════════════════════════════════════════════╝" "$fish_color_reset"
end
