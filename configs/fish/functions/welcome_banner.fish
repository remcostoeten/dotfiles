# Show dotfiles banner
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

    printf "%s%s\n" "$pastel_pink" "  ██████╗ ███████╗███╗   ███╗ ██████╗ ██████╗"
    printf "%s%s\n" "$pastel_magenta" "  ██╔══██╗██╔════╝████╗ ████║██╔════╝██╔═══██╗"
    printf "%s%s\n" "$pastel_purple" "  ██████╔╝█████╗  ██╔████╔██║██║     ██║   ██║"
    printf "%s%s\n" "$pastel_blue" "  ██╔══██╗██╔══╝  ██║╚██╔╝██║██║     ██║   ██║"
    printf "%s%s\n" "$pastel_cyan" "  ██║  ██║███████╗██║ ╚═╝ ██║╚██████╗╚██████╔╝"
    printf "%s%s\n" "$pastel_green" "  ╚═╝  ╚═╝╚══════╝╚═╝     ╚═╝ ╚═════╝ ╚═════╝"
    printf "%s\n" "$normal"

    if test -d ~/.config/dotfiles
        set -l git_date (cd ~/.config/dotfiles && git log -1 --format="%ar" 2>/dev/null)
        set -l git_ci (cd ~/.config/dotfiles && git log -1 --format="%ci" 2>/dev/null)
        set -l git_timestamp ""

        if test -n "$git_ci"
            set -l git_date_part (string split ' ' $git_ci)[1]
            if test -n "$git_date_part"
                set -l date_tokens (string split '-' $git_date_part)
                if test (count $date_tokens) -eq 3
                    set date_tokens[1] (string sub --start -2 $date_tokens[1])
                    set git_timestamp (string join '·' $date_tokens)
                else
                    # Fallback to replacing hyphens if unexpected format
                    set git_timestamp (string replace -a '-' '·' $git_date_part)
                end
            end
        end

        set -l todo_script "$HOME/.config/dotfiles/scripts/todo.js"
        set -l tasks_count ""

        if test -f "$todo_script"
            if command -v bun >/dev/null 2>&1
                set tasks_count (bun "$todo_script" count 2>/dev/null)
            else if command -v node >/dev/null 2>&1
                set tasks_count (node "$todo_script" count 2>/dev/null)
            end
        end

        if test -z "$tasks_count"
            set tasks_count 0
        end

        if test "$tasks_count" = 1
            set -l tasks_label "1 task"
        else
            set -l tasks_label "$tasks_count tasks"
        end

        if test -n "$git_date"
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

            echo -n "  "
            echo -n "$pastel_yellow" "updated "
            echo -n "$pastel_orange" "$git_date"
            echo -n "$pastel_pink" " · $git_timestamp"
            echo -n "$pastel_cyan" "  ├─ "
            echo -n "$pastel_magenta" "launch "
            echo -n "$pastel_blue" "[df]"
            echo -n "$pastel_magenta" " → dotfiles menu"
            echo -n "$pastel_green" " · "
            echo -n "$pastel_yellow" "$tasks_label"
            echo "$normal"
        end
    end

    # Show todos on startup
    show_todos_startup
end
