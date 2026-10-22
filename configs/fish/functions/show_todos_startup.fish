function show_todos_startup -d "Display pending todos with timestamps on shell startup"
    set -l todo_bin "$HOME/.config/dotfiles/bin/todo"

    if test -x "$todo_bin"
        if command -v bun >/dev/null 2>&1
            "$todo_bin" panel $argv 2>/dev/null
        end
    end
end
