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
    set -l dim (set_color 555)
    set -l normal (set_color normal)

    # ASCII art
    printf "%s%s\n" "$pastel_pink" "  ██████╗ ███████╗███╗   ███╗ ██████╗ ██████╗"
    printf "%s%s\n" "$pastel_magenta" "  ██╔══██╗██╔════╝████╗ ████║██╔════╝██╔═══██╗"
    printf "%s%s\n" "$pastel_purple" "  ██████╔╝█████╗  ██╔████╔██║██║     ██║   ██║"
    printf "%s%s\n" "$pastel_blue" "  ██╔══██╗██╔══╝  ██║╚██╔╝██║██║     ██║   ██║"
    printf "%s%s\n" "$pastel_cyan" "  ██║  ██║███████╗██║ ╚═╝ ██║╚██████╗╚██████╔╝"
    printf "%s%s\n" "$pastel_green" "  ╚═╝  ╚═╝╚══════╝╚═╝     ╚═╝ ╚═════╝ ╚═════╝"
    printf "%s\n" "$normal"

    set -l banner_cache (_dotfiles_banner_cache_read)
    if test (count $banner_cache) -ge 3
        set -l git_date $banner_cache[1]
        set -l git_timestamp $banner_cache[2]
        set -l tasks_label $banner_cache[3]

        if test -n "$git_date"
            printf "%s  %s" "$pastel_cyan" "└─"
            printf "%s %s" "$pastel_cyan" "updated"
            printf "%s %s" "$pastel_orange" "$git_date"
            printf "%s %s" "$pastel_pink" "·"
            printf "%s%s" "$pastel_pink" "$git_timestamp"
            printf "%s  %s" "$pastel_cyan" "│"
            printf "%s %s" "$pastel_magenta" "launch"
            printf "%s%s%s" "$pastel_blue" "[df]" "$pastel_magenta"
            printf "%s %s" "$pastel_magenta" "→"
            printf "%s%s" "$pastel_blue" "dotfiles menu"
            printf "%s  %s" "$pastel_cyan" "│"
            printf "%s %s" "$pastel_green" "$tasks_label"
            printf "%s\n" "$normal"
        end
    end

    if not _dotfiles_banner_cache_is_fresh
        _dotfiles_refresh_banner_cache >/dev/null 2>&1 &
    end
end

function _dotfiles_banner_cache_file
    echo "$HOME/.dotfiles/banner-cache/current"
end

function _dotfiles_banner_cache_read
    set -l cache_file (_dotfiles_banner_cache_file)
    if not test -f "$cache_file"
        return 1
    end

    set -l cache_content (cat "$cache_file" 2>/dev/null)
    if test (count $cache_content) -lt 3
        return 1
    end

    echo $cache_content[1]
    echo $cache_content[2]
    echo $cache_content[3]
end

function _dotfiles_banner_cache_is_fresh
    set -l cache_file (_dotfiles_banner_cache_file)
    if not test -f "$cache_file"
        return 1
    end

    set -l cache_mtime (command stat -c %Y "$cache_file" 2>/dev/null)
    if test -z "$cache_mtime"
        return 1
    end

    set -l now (date +%s)
    set -l age (math "$now - $cache_mtime")
    test "$age" -lt 600
end

function _dotfiles_refresh_banner_cache
    set -l repo "$HOME/.config/dotfiles"
    set -l todo_script "$repo/scripts/todo.js"
    set -l git_date ""
    set -l git_timestamp ""
    set -l tasks_label "0 tasks"

    if test -d "$repo"
        set git_date (command git -C "$repo" log -1 --format="%ar" 2>/dev/null)
        set -l git_ci (command git -C "$repo" log -1 --format="%ci" 2>/dev/null)

        if test -n "$git_ci"
            set -l git_date_part (string split ' ' $git_ci)[1]
            if test -n "$git_date_part"
                set -l date_tokens (string split '-' $git_date_part)
                if test (count $date_tokens) -eq 3
                    set date_tokens[1] (string sub --start -2 $date_tokens[1])
                    set git_timestamp (string join '·' $date_tokens)
                else
                    set git_timestamp (string replace -a '-' '·' $git_date_part)
                end
            end
        end

        if test -f "$todo_script"
            set -l tasks_count ""
            if command -v bun >/dev/null 2>&1
                set tasks_count (command bun "$todo_script" count 2>/dev/null)
            else if command -v node >/dev/null 2>&1
                set tasks_count (command node "$todo_script" count 2>/dev/null)
            end

            if test -z "$tasks_count"
                set tasks_count 0
            end

            if test "$tasks_count" = 1
                set tasks_label "1 task"
            else
                set tasks_label "$tasks_count tasks"
            end
        end
    end

    set -l cache_file (_dotfiles_banner_cache_file)
    command mkdir -p (dirname "$cache_file")
    printf '%s\n%s\n%s\n' "$git_date" "$git_timestamp" "$tasks_label" > "$cache_file"
end
