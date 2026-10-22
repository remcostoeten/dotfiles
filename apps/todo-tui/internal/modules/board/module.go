// Package board is the taskboard: a workspace sidebar and the task tree.
package board

import (
	tea "charm.land/bubbletea/v2"

	"todo-tui/internal/todo"
	"todo-tui/internal/tui/command"
	"todo-tui/internal/tui/core/registry"
	"todo-tui/internal/tui/input"
	navigation "todo-tui/internal/tui/navigation"
	"todo-tui/internal/tui/shell/overlay"
)

const route = "board"

type action string

// Module registers the board route and its verbs.
type Module struct {
	store  *todo.Store
	boards *todo.BoardStore
	cli    *todo.CLI
}

// New builds the module around the task file, the boards file it reads and
// the CLI that performs every mutation.
func New(store *todo.Store, boards *todo.BoardStore, cli *todo.CLI) *Module {
	return &Module{store: store, boards: boards, cli: cli}
}

// ID names the module.
func (m *Module) ID() registry.ModuleID {
	return "board"
}

type verb struct {
	id, title, description string
	keys                   [][]string
	hint                   string
	priority               int
	dangerous              bool
}

// Register installs the route plus one command and binding per verb.
func (m *Module) Register(r *registry.Registrar) {
	r.Route(navigation.Route{ID: route, Title: "Tasks", Order: 10},
		func(registry.Context) registry.View { return newView(m.store, m.boards, m.cli) })

	emit := func(a action) func() tea.Cmd {
		return func() tea.Cmd { return func() tea.Msg { return a } }
	}
	verbs := []verb{
		{id: "complete", title: "Complete Task", description: "Complete the selected task and its subtasks, or restore it in the archive", keys: [][]string{{"enter"}, {"space"}}, hint: "Done", priority: 65},
		{id: "add", title: "Add Task", description: "Comma separates several; CLI flags like --due work", keys: [][]string{{"a"}}, hint: "Add", priority: 60},
		{id: "add.sub", title: "Add Subtask", description: "Add a task under the selected one", keys: [][]string{{"A"}}},
		{id: "add.epic", title: "Add Epic", keys: [][]string{{"E"}}},
		{id: "edit", title: "Edit Task", keys: [][]string{{"e"}}, hint: "Edit", priority: 50},
		{id: "delete", title: "Delete Task", description: "Delete the selected task and its subtasks", keys: [][]string{{"d"}}, hint: "Delete", priority: 45, dangerous: true},
		{id: "undo", title: "Undo", description: "Undo the last complete, or restore the last delete", keys: [][]string{{"u"}, {"ctrl+z"}}},
		{id: "snooze", title: "Snooze Task", description: "Push the due date forward", keys: [][]string{{"s"}}},
		{id: "due", title: "Set Due Date", description: "todo due syntax, or none to clear", keys: [][]string{{"t"}}, hint: "Due", priority: 40},
		{id: "priority", title: "Cycle Priority", keys: [][]string{{"p"}}},
		{id: "mark", title: "Mark Task", description: "Mark for batch completion", keys: [][]string{{"x"}}},
		{id: "complete.marked", title: "Complete Marked Tasks", keys: [][]string{{"c"}}},
		{id: "search", title: "Search Tasks", keys: [][]string{{"/"}}, hint: "Search", priority: 35},
		{id: "archive", title: "Toggle Archive", keys: [][]string{{"v"}}},
		{id: "board.new", title: "New Timed Board", description: "Start a board that ends itself after at most 24h, e.g. 4h deploy day", keys: [][]string{{"F"}}, hint: "Board", priority: 42},
		{id: "board.switch", title: "Switch Board", description: "Activate the next board; after the last one, show all tasks", keys: [][]string{{"b"}}},
		{id: "board.off", title: "Board Off", description: "No active board: show all tasks; timers keep running", keys: [][]string{{"B"}}},
		{id: "board.toggle", title: "Put On Board", description: "Put the selected task on the board in view (or the active one), or take it off", keys: [][]string{{"f"}}},
		{id: "board.move", title: "Move To Board", description: "Move the selected task off the board in view onto another, keeping its lane", keys: [][]string{{"m"}}},
		{id: "board.lane", title: "Move Between Now and Later", description: "Move the selected task between the board's Now and Later lanes", keys: [][]string{{"L"}}},
		{id: "board.split", title: "Split View", description: "Open another board beside this one, up to three; with three open, keep only the focused one", keys: [][]string{{"|"}, {"S"}}},
		{id: "board.split.close", title: "Close Pane", description: "Close the focused pane of a split", keys: [][]string{{"ctrl+w"}}},
		{id: "board.end", title: "End Board", description: "Delete the board in view (or the active one); tasks stay", dangerous: true},
		{id: "refresh", title: "Refresh", keys: [][]string{{"r"}}},
		{id: "indent", title: "Nest Under Task Above", keys: [][]string{{">"}}},
		{id: "outdent", title: "Move Up One Level", keys: [][]string{{"<"}}},
	}

	onBoard := command.OnRoute(route)
	for _, v := range verbs {
		id := command.ID("todo." + v.id)
		run := emit(action(v.id))
		if v.dangerous {
			confirmed := id + ".confirmed"
			r.Command(command.Command{ID: confirmed, Title: v.title + " (confirmed)", Category: "Tasks", When: onBoard,
				Run: func(command.Scope) tea.Cmd { return run() }})
			r.Command(command.Command{ID: id, Title: v.title, Category: "Tasks", Description: v.description, Dangerous: true, When: onBoard,
				Run: func(command.Scope) tea.Cmd { return emit(action("confirm." + v.id))() }})
		} else {
			r.Command(command.Command{ID: id, Title: v.title, Category: "Tasks", Description: v.description, When: onBoard,
				Run: func(command.Scope) tea.Cmd { return run() }})
		}
		for i, keys := range v.keys {
			b := input.Binding{Keys: keys, Command: id, When: onBoard}
			if i == 0 {
				b.Hint, b.Priority = v.hint, v.priority
			}
			r.Bind(input.LayerScreen, b)
		}
	}
}

func ask(title, message string, accept command.ID) tea.Cmd {
	return overlay.Ask(title, message, accept, true)
}
