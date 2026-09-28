package app

import (
	tea "charm.land/bubbletea/v2"

	"pc/internal/tui/command"
	"pc/internal/tui/core/registry"
	"pc/internal/tui/focus"
	"pc/internal/tui/input"
	"pc/internal/tui/layout"
	navigation "pc/internal/tui/navigation"
	"pc/internal/tui/shell/overlay"
)

// registerGlobals installs the verbs and keys that belong to the shell rather
// than to any module. It is the only place global bindings are declared.
func registerGlobals(r *registry.Registrar) {
	commands := []command.Command{
		{
			ID: "app.quit", Title: "Quit", Category: "Application",
			Description: "Leave the application",
			Run:         func(command.Scope) tea.Cmd { return tea.Quit },
		},
		{
			ID: "app.palette", Title: "Command Palette", Category: "Application",
			Description: "Search every available command",
			Keywords:    []string{"search", "run", "find"},
			Run:         func(command.Scope) tea.Cmd { return registry.Open(overlay.NewPalette()) },
		},
		{
			ID: "app.help", Title: "Help", Category: "Application",
			Description: "List the keys and commands available here",
			Run:         func(command.Scope) tea.Cmd { return registry.Open(overlay.NewHelp()) },
		},
		{
			ID: "app.theme.next", Title: "Next Theme", Category: "View",
			Description: "Cycle through the installed palettes",
			Keywords:    []string{"colour", "color", "dark", "light", "contrast"},
			Run:         func(command.Scope) tea.Cmd { return registry.NextTheme() },
		},
		{
			ID: "view.focus.next", Title: "Focus Next Region", Category: "View",
			Run: func(command.Scope) tea.Cmd { return focus.Next() },
		},
		{
			ID: "view.focus.prev", Title: "Focus Previous Region", Category: "View",
			Run: func(command.Scope) tea.Cmd { return focus.Prev() },
		},
		{
			ID: "view.jump", Title: "Jump to Region", Category: "View",
			Description: "Badge every region and focus the one you press",
			Run: func(command.Scope) tea.Cmd {
				return registry.OpenWith(func(f focus.State, frame layout.Frame) registry.Overlay {
					return overlay.NewJump(f, frame)
				})
			},
		},
		{
			ID: "view.focus.left", Title: "Focus Left", Category: "View",
			Run: func(command.Scope) tea.Cmd { return focus.Move(focus.Left) },
		},
		{
			ID: "view.focus.right", Title: "Focus Right", Category: "View",
			Run: func(command.Scope) tea.Cmd { return focus.Move(focus.Right) },
		},
		{
			ID: "view.focus.up", Title: "Focus Up", Category: "View",
			Run: func(command.Scope) tea.Cmd { return focus.Move(focus.Up) },
		},
		{
			ID: "view.focus.down", Title: "Focus Down", Category: "View",
			Run: func(command.Scope) tea.Cmd { return focus.Move(focus.Down) },
		},
		{
			ID: "nav.next", Title: "Next Section", Category: "Navigation",
			Run: func(command.Scope) tea.Cmd { return registry.CycleRoute(1) },
		},
		{
			ID: "nav.prev", Title: "Previous Section", Category: "Navigation",
			Run: func(command.Scope) tea.Cmd { return registry.CycleRoute(-1) },
		},
		{
			ID: "nav.back", Title: "Back", Category: "Navigation",
			Run: func(command.Scope) tea.Cmd { return navigation.Back() },
		},
		{
			ID: "nav.forward", Title: "Forward", Category: "Navigation",
			Run: func(command.Scope) tea.Cmd { return navigation.Forward() },
		},
		{
			ID: "nav.up", Title: "Leave This Screen", Category: "Navigation",
			Description: "Unwind one level of drill-in",
			When:        command.WhenNested(),
			Run:         func(command.Scope) tea.Cmd { return navigation.Pop() },
		},
		{
			ID: "overlay.close", Title: "Close Overlay", Category: "Application",
			When: command.WhenOverlay(),
			Run:  func(command.Scope) tea.Cmd { return registry.Close() },
		},
	}
	for _, c := range commands {
		r.Command(c)
	}

	global := []input.Binding{
		{Keys: []string{"ctrl+k"}, Command: "app.palette", Hint: "palette", Priority: 100},
		{Keys: []string{"?"}, Command: "app.help", Hint: "Help", Priority: 20},
		{Keys: []string{"ctrl+c"}, Command: "app.quit"},
		{Keys: []string{"q"}, Command: "app.quit", Hint: "Quit", Priority: 10},
		{Keys: []string{"tab"}, Command: "view.focus.next", Hint: "Focus", Priority: 90},
		{Keys: []string{"shift+tab"}, Command: "view.focus.prev"},
		{Keys: []string{"v"}, Command: "view.jump", Hint: "Jump", Priority: 80},
		{Keys: []string{"alt+h"}, Command: "view.focus.left"},
		{Keys: []string{"alt+l"}, Command: "view.focus.right"},
		{Keys: []string{"alt+j"}, Command: "view.focus.down"},
		{Keys: []string{"alt+k"}, Command: "view.focus.up"},
		{Keys: []string{"]"}, Command: "nav.next", Hint: "Section", Priority: 70},
		{Keys: []string{"["}, Command: "nav.prev"},
		{Keys: []string{"alt+left"}, Command: "nav.back"},
		{Keys: []string{"alt+right"}, Command: "nav.forward"},
		{Keys: []string{"esc"}, Command: "nav.up", When: command.WhenNested()},
		{Keys: []string{"ctrl+t"}, Command: "app.theme.next", Hint: "Theme", Priority: 30},
	}
	for _, b := range global {
		r.Bind(input.LayerGlobal, b)
	}

	r.Bind(input.LayerOverlay, input.Binding{
		Keys: []string{"esc"}, Command: "overlay.close", When: command.WhenOverlay(),
	})
}
