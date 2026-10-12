function show_todos_startup -d "Display pending todos with timestamps on shell startup"
    set -l todo_script "$HOME/.config/dotfiles/apps/todo-tui/cli/todo.ts"

    if not test -f "$todo_script"; or not command -q bun
        return 0
    end

    set -l cache_dir "$HOME/.cache/dotfiles"
    set -l cache_file "$cache_dir/todos-startup.txt"

    if test -s "$cache_file"
        cat "$cache_file"
    end

    mkdir -p "$cache_dir"
    FORCE_COLOR=1 command sh -c 'script=$1 cache=$2; shift 2; bun "$script" shell-display "$@" >"$cache.tmp" 2>/dev/null && mv "$cache.tmp" "$cache"' sh "$todo_script" "$cache_file" $argv </dev/null >/dev/null 2>&1 &
    disown 2>/dev/null
end
