package app

import (
	"todo-tui/internal/modules/board"
	"todo-tui/internal/todo"
	"todo-tui/internal/tui/core/config"
	"todo-tui/internal/tui/core/registry"
)

// Deps are the services a module needs, wired here rather than resolved from a
// container: constructor arguments, checked by the compiler.
type Deps struct {
	Config config.Config
}

// Modules is the whole module list.
func Modules(deps Deps) []registry.Module {
	return []registry.Module{
		board.New(todo.NewStore(), todo.NewBoardStore(), todo.NewCLI()),
	}
}
