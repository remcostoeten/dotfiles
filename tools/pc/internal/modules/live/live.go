// Package live drives periodic refresh and holds the helpers every pc screen
// shares: verb registration, off-loop actions and toasts.
package live

import (
	"strings"
	"time"

	tea "charm.land/bubbletea/v2"

	"pc/internal/tui/command"
	"pc/internal/tui/core/registry"
	"pc/internal/tui/input"
	navigation "pc/internal/tui/navigation"
	"pc/internal/tui/ui"
)

// Interval is how often the visible screen re-reads the machine.
const Interval = 2 * time.Second

// RefreshID is the command that re-reads the visible screen.
const RefreshID command.ID = "live.refresh"

// Tick asks the visible screen to re-read its source.
type Tick struct{}

// Module owns the refresh loop and the start route.
type Module struct {
	start navigation.RouteID
	due   time.Time
}

// New builds the module. A non-empty start route is switched to at boot.
func New(start navigation.RouteID) *Module {
	return &Module{start: start}
}

// ID names the module.
func (m *Module) ID() registry.ModuleID {
	return "live"
}

// Register installs the refresh command, its key and the loop.
//
// The loop re-arms through a dispatched command rather than a message to the
// view, because the runtime delivers plain messages only to the top overlay and
// a tick swallowed by the palette would end the loop.
func (m *Module) Register(r *registry.Registrar) {
	r.Command(command.Command{
		ID: RefreshID, Title: "Refresh Now", Category: "View",
		Description: "Re-read the machine for the visible screen",
		Keywords:    []string{"reload", "update", "rescan"},
		Run:         m.refresh,
	})
	r.Bind(input.LayerGlobal, input.Binding{Keys: []string{"ctrl+r"}, Command: RefreshID, Hint: "Refresh", Priority: 25})

	r.Subscribe(func(registry.Context) tea.Cmd {
		if m.start.IsZero() {
			return m.arm()
		}
		return tea.Batch(navigation.Switch(m.start, nil), m.arm())
	})
}

func (m *Module) arm() tea.Cmd {
	m.due = time.Now().Add(Interval)
	return tea.Tick(Interval, func(time.Time) tea.Msg { return command.ExecMsg{ID: RefreshID} })
}

func (m *Module) refresh(command.Scope) tea.Cmd {
	tick := Send(Tick{})
	if time.Now().Before(m.due.Add(-Interval / 4)) {
		return tick
	}
	return tea.Batch(tick, m.arm())
}

// Send wraps a message as a command.
func Send(msg tea.Msg) tea.Cmd {
	return func() tea.Msg { return msg }
}

// Action runs a change off the event loop, reports it as a toast and then runs
// the follow-up commands, typically a re-read.
func Action(label string, run func() error, follow ...tea.Cmd) tea.Cmd {
	report := func() tea.Msg {
		if err := run(); err != nil {
			return registry.ToastMsg{Toast: ui.Toast{Severity: ui.SeverityDanger, Text: label + " failed: " + err.Error()}}
		}
		return registry.ToastMsg{Toast: ui.Toast{Severity: ui.SeveritySuccess, Text: label}}
	}
	return tea.Sequence(append([]tea.Cmd{report}, follow...)...)
}

// Warn shows a warning toast.
func Warn(text string) tea.Cmd {
	return registry.Notify(ui.Toast{Severity: ui.SeverityWarning, Text: text})
}

// Verb is a screen command that forwards Msg to the screen's view, which owns
// the state needed to act on it. Each of Keys is an alternative binding. A
// Confirmed verb is the accept side of a confirmation dialog and stays out of
// the palette and help.
type Verb struct {
	ID          command.ID
	Title       string
	Description string
	Keys        []string
	Hint        string
	Priority    int
	Dangerous   bool
	Confirmed   bool
	Msg         tea.Msg
}

// Screen is a nav route plus its verbs.
type Screen struct {
	Route    navigation.Route
	Key      string
	Category string
	Build    registry.Constructor
	Verbs    []Verb
}

// RegisterScreen installs a route, a global key that switches to it and its
// verbs, each gated on the route. Verbs are not gated on focus regions: the
// palette and help evaluate availability with the overlay focused, so a
// region-gated verb would never be listed. Views act on their focused widget
// instead.
func RegisterScreen(r *registry.Registrar, s Screen) {
	route := string(s.Route.ID)
	r.Route(s.Route, s.Build)

	goID := command.ID(route + ".show")
	r.Command(command.Command{
		ID: goID, Title: "Go to " + s.Route.Title, Category: "Navigation",
		Run: func(command.Scope) tea.Cmd { return navigation.Switch(s.Route.ID, nil) },
	})
	r.Bind(input.LayerGlobal, input.Binding{Keys: []string{s.Key}, Command: goID})

	for _, v := range s.Verbs {
		when := command.OnRoute(route)
		if v.Confirmed {
			when = command.And(when, onScreen(route))
		}
		r.Command(command.Command{
			ID: v.ID, Title: v.Title, Category: s.Category, Description: v.Description,
			Dangerous: v.Dangerous, When: when, Run: func(command.Scope) tea.Cmd { return Send(v.Msg) },
		})
		for i, key := range v.Keys {
			b := input.Binding{Keys: []string{key}, Command: v.ID, When: when}
			if i == 0 {
				b.Hint, b.Priority = v.Hint, v.Priority
			}
			r.Bind(input.LayerScreen, b)
		}
	}
}

// onScreen passes while focus sits on the route's own regions rather than on
// an overlay, which is how accept-side commands stay out of the palette.
func onScreen(route string) command.Predicate {
	return func(s command.Scope) bool {
		return s.Region == "" || strings.HasPrefix(s.Region, route+".")
	}
}
