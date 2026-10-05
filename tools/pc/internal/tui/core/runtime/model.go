// Package runtime is the root reducer. Its Update is a fixed pipeline, not a
// switch statement: it never mentions a route, a module or a screen, and every
// stage delegates to a system that owns exactly one concern.
package runtime

import (
	"time"

	tea "charm.land/bubbletea/v2"

	"pc/internal/tui/core/config"
	"pc/internal/tui/core/registry"
	"pc/internal/tui/focus"
	"pc/internal/tui/kernel"
	"pc/internal/tui/layout"
	navigation "pc/internal/tui/navigation"
	"pc/internal/tui/theme"
	"pc/internal/tui/ui"
)

// ToastLifetime is how long a notification stays on screen.
const ToastLifetime = 4 * time.Second

// coreState is bucket one: the terminal, readiness, a fatal error and the
// pending chord prefix.
type coreState struct {
	Size  kernel.Size
	Ready bool
	// Fatal ends the program. Recovered does not: it is a module panic, shown
	// as an error panel in the workspace while the shell keeps running.
	Fatal      error
	Recovered  error
	Pending    []string
	PendingSeq int
	Quit       bool
}

type toast struct {
	seq   int
	toast ui.Toast
}

// uiState is bucket four: what is stacked over the frame, what is being
// announced, and how wide the terminal is in responsive terms.
type uiState struct {
	Overlays   []registry.Overlay
	Toasts     []toast
	Breakpoint layout.Breakpoint
	nextToast  int
}

// Model is the root. Four framework buckets of value types, one opaque bucket
// of domain state, a derived frame, and everything else immutable after boot.
type Model struct {
	core  coreState
	nav   navigation.State
	focus focus.State
	ui    uiState

	// views is the domain bucket. The shell holds each screen as an interface
	// and forwards messages to it; it never sees the shape of what is inside.
	views map[navigation.RouteID]registry.View

	frame layout.Frame

	reg     *registry.Registry
	themes  *theme.Registry
	chrome  registry.Chrome
	theme   theme.Theme
	cfg     config.Config
	log     kernel.Logger
	options layout.Options
}

// Options configures a runtime.
type Options struct {
	Registry *registry.Registry
	Themes   *theme.Registry
	Chrome   registry.Chrome
	Config   config.Config
	Log      kernel.Logger
	Layout   layout.Options
}

// New builds the root model. It selects the configured theme, opens the first
// registered route and leaves the model not-ready until the first resize.
func New(o Options) (Model, error) {
	if o.Registry == nil {
		return Model{}, kernel.Errorf(kernel.KindInternal, "runtime.New", "a runtime needs a registry")
	}
	if o.Chrome == nil {
		return Model{}, kernel.Errorf(kernel.KindInternal, "runtime.New", "a runtime needs chrome to draw with")
	}
	if o.Log == nil {
		o.Log = kernel.NopLogger()
	}
	if o.Layout == (layout.Options{}) {
		o.Layout = layout.DefaultOptions()
	}

	selected := o.Themes.Default()
	if t, err := o.Themes.Get(o.Config.Theme); err == nil {
		selected = t
	} else {
		o.Log.Warn("unknown theme, using the default", "requested", o.Config.Theme)
	}

	root := o.Registry.FirstRoute()
	m := Model{
		nav:     navigation.NewState(root),
		focus:   focus.NewState(scopeFor(root)),
		views:   map[navigation.RouteID]registry.View{},
		reg:     o.Registry,
		themes:  o.Themes,
		chrome:  o.Chrome,
		theme:   selected,
		cfg:     o.Config,
		log:     o.Log,
		options: o.Layout,
	}

	if root.IsZero() {
		return m, nil
	}
	view, err := m.reg.Build(root, m.Context())
	if err != nil {
		return m, err
	}
	m.views[root] = view
	return m.syncFocus(), nil
}

// Init starts the first view and every registered subscription.
func (m Model) Init() tea.Cmd {
	cmds := make([]tea.Cmd, 0, len(m.reg.Subscriptions())+1)
	if view := m.ActiveView(); view != nil {
		cmds = append(cmds, view.Init())
	}
	for _, sub := range m.reg.Subscriptions() {
		cmds = append(cmds, sub(m.Context()))
	}
	return tea.Batch(cmds...)
}

// Context builds the update-time context handed to views and commands.
func (m Model) Context() registry.Context {
	return registry.Context{
		Theme:    m.theme,
		Config:   m.cfg,
		Log:      m.log,
		Route:    m.nav.Current(),
		Depth:    m.nav.Depth(),
		Focus:    m.focus,
		Size:     m.core.Size,
		Dispatch: dispatch,
		Notify:   registry.Notify,
		Services: m.reg.Services(),
		Commands: m.reg.Commands(),
		Keymap:   m.reg.Keymap(),
	}
}

// Theme is the palette currently in use.
func (m Model) Theme() theme.Theme {
	return m.theme
}

// Frame is the solved geometry for the current terminal size.
func (m Model) Frame() layout.Frame {
	return m.frame
}

// Route is the entry currently on top of the navigation stack.
func (m Model) Route() navigation.Entry {
	return m.nav.Current()
}

// Focus is the focus machine's current state.
func (m Model) Focus() focus.State {
	return m.focus
}

// Overlay is the identifier of the topmost overlay, empty when none is open.
func (m Model) Overlay() registry.OverlayID {
	if len(m.ui.Overlays) == 0 {
		return ""
	}
	return m.ui.Overlays[len(m.ui.Overlays)-1].ID()
}

// ActiveView is the view for the current route.
func (m Model) ActiveView() registry.View {
	return m.views[m.nav.Current().Route]
}

func scopeFor(id navigation.RouteID) focus.ScopeID {
	return focus.ScopeID("route:" + id)
}
