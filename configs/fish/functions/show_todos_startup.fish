function show_todos_startup -d "Display pending todos with timestamps on shell startup"
    set -l todo_script "$HOME/.config/dotfiles/scripts/todo.mjs"

    if test -f "$todo_script"
        if command -v bun >/dev/null 2>&1
            bun "$todo_script" shell-display $argv 2>/dev/null
        end
    end
end
