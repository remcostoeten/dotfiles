function show_todos_startup -d "Display pending todos with timestamps on shell startup"
    set -l todo_script "$HOME/.config/dotfiles/scripts/todo.js"

    # Check if todo script exists
    if test -f "$todo_script"
        # Run todo script in shell display mode (non-interactive)
        if command -v bun >/dev/null 2>&1
            bun "$todo_script" shell-display 2>/dev/null
        else if command -v node >/dev/null 2>&1
            node "$todo_script" shell-display 2>/dev/null
        end
    end
end