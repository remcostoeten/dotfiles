package runtime

import (
	"fmt"
	"runtime/debug"
	"slices"
	"time"

	tea "charm.land/bubbletea/v2"

	"pc/internal/tui/command"
	"pc/internal/tui/core/registry"
	"pc/internal/tui/focus"
	"pc/internal/tui/input"
	"pc/internal/tui/kernel"
	"pc/internal/tui/layout"
	navigation "pc/internal/tui/navigation"
)

// chordTimeoutMsg discards a pending chord prefix that was never completed.
// The sequence number is what keeps a stale timer from clearing a newer chord.
type chordTimeoutMsg struct {
	seq int
}

// FatalMsg puts the runtime into its terminal error state.
type FatalMsg struct {
	Err error
}

func dispatch(id command.ID) tea.Cmd {
	return command.Dispatch(id)
}

// Update is the entire root reducer. It runs the same stages on every message,
// and each one delegates to a system that owns exactly one concern.
func (m Model) Update(msg tea.Msg) (next tea.Model, cmd tea.Cmd) {
	defer func() {
		if r := recover(); r != nil {
			next, cmd = m.recovered(r), nil
		}
	}()

	if handled, model, c := m.lifecycle(msg); handled {
		return model, c
	}
	if key, ok := msg.(tea.KeyMsg); ok {
		return m.routeKey(key)
	}
	if mouse, ok := msg.(tea.MouseMsg); ok {
		return m.routeMouse(mouse)
	}
	if handled, model, c := m.framework(msg); handled {
		return model, c
	}
	return m.forward(msg)
}

// lifecycle handles resize, quit and fatal errors — the messages that change
// what the frame is rather than what is in it.
func (m Model) lifecycle(msg tea.Msg) (bool, tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.core.Size = kernel.Size{Width: msg.Width, Height: msg.Height}
		m.core.Ready = true
		return true, m.resolveLayout(), nil

	case FatalMsg:
		m.core.Fatal = msg.Err
		m.log.Error("fatal", "err", msg.Err)
		return true, m, nil

	case tea.QuitMsg:
		m.core.Quit = true
		return true, m, tea.Quit

	case chordTimeoutMsg:
		if msg.seq == m.core.PendingSeq {
			m.core.Pending = nil
		}
		return true, m, nil
	}
	return false, m, nil
}

// routeKey resolves a key through the layered keymap. A key press does not
// call a function: it becomes a command identifier, which is dispatched.
func (m Model) routeKey(key tea.KeyMsg) (tea.Model, tea.Cmd) {
	result := m.reg.Keymap().Resolve(key.String(), m.inputContext())

	switch result.Kind {
	case input.Dispatch:
		m.core.Pending = nil
		return m, dispatch(result.Command)

	case input.Pending:
		m.core.Pending = result.Prefix
		m.core.PendingSeq++
		seq := m.core.PendingSeq
		return m, tea.Tick(input.ChordTimeout, func(time.Time) tea.Msg {
			return chordTimeoutMsg{seq: seq}
		})

	default:
		m.core.Pending = nil
		return m.forward(key)
	}
}

// routeMouse resolves a click against the rectangles layout already solved,
// rather than re-deriving geometry during the click.
func (m Model) routeMouse(msg tea.MouseMsg) (tea.Model, tea.Cmd) {
	if !m.cfg.Mouse {
		return m, nil
	}
	if click, ok := msg.(tea.MouseClickMsg); ok && len(m.ui.Overlays) == 0 {
		if id, hit := m.frame.HitTest(click.X, click.Y); hit {
			m.focus = m.focus.Set(id)
			return m, nil
		}
	}
	return m.forward(msg)
}

// framework reduces each framework message into the state that owns it, and
// nowhere else.
func (m Model) framework(msg tea.Msg) (bool, tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case command.ExecMsg:
		return true, m, m.reg.Commands().Run(msg.ID, m.Context().Scope())

	case navigation.NavigateMsg:
		model, cmd := m.navigate(msg)
		return true, model, cmd

	case focus.Msg:
		return true, m.reduceFocus(msg), nil

	case registry.OpenMsg:
		model, cmd := m.openOverlay(msg.Overlay)
		return true, model, cmd

	case registry.OpenFuncMsg:
		if msg.Build == nil {
			return true, m, nil
		}
		model, cmd := m.openOverlay(msg.Build(m.focus, m.frame))
		return true, model, cmd

	case registry.ThemeMsg:
		return true, m.switchTheme(msg), nil

	case registry.CycleRouteMsg:
		model, cmd := m.cycleRoute(msg.Delta)
		return true, model, cmd

	case registry.CloseMsg:
		return true, m.closeOverlay(msg.Overlay), nil

	case registry.ToastMsg:
		model, cmd := m.addToast(msg)
		return true, model, cmd

	case registry.ToastExpiredMsg:
		m.ui.Toasts = slices.DeleteFunc(slices.Clone(m.ui.Toasts), func(t toast) bool {
			return t.seq == msg.Seq
		})
		return true, m, nil
	}
	return false, m, nil
}

// forward hands a message to the active view and to the topmost overlay.
func (m Model) forward(msg tea.Msg) (tea.Model, tea.Cmd) {
	ctx := m.Context()
	cmds := make([]tea.Cmd, 0, 2)

	if len(m.ui.Overlays) > 0 {
		top := len(m.ui.Overlays) - 1
		updated, cmd := m.ui.Overlays[top].Update(ctx, msg)
		overlays := slices.Clone(m.ui.Overlays)
		overlays[top] = updated
		m.ui.Overlays = overlays
		cmds = append(cmds, cmd)
		return m.syncFocus(), tea.Batch(cmds...)
	}

	route := m.nav.Current().Route
	if view, ok := m.views[route]; ok && view != nil {
		updated, cmd := view.Update(ctx, msg)
		views := make(map[navigation.RouteID]registry.View, len(m.views))
		for k, v := range m.views {
			views[k] = v
		}
		views[route] = updated
		m.views = views
		cmds = append(cmds, cmd)
	}
	return m.syncFocus(), tea.Batch(cmds...)
}

// navigate applies a navigation message, then re-solves layout and focus,
// because both are derived from which screen is showing.
func (m Model) navigate(msg navigation.NavigateMsg) (tea.Model, tea.Cmd) {
	next, changed := m.nav.Apply(msg)
	if !changed {
		return m, nil
	}
	m.nav = next

	model, cmd := m.ensureView(m.nav.Current().Route)
	model.focus = model.focus.SwitchScope(scopeFor(model.nav.Current().Route), nil)
	return model.resolveLayout(), cmd
}

// ensureView constructs a route's view on first entry, or rebuilds it every
// time when the route declared itself ephemeral.
func (m Model) ensureView(id navigation.RouteID) (Model, tea.Cmd) {
	if id.IsZero() {
		return m, nil
	}
	route, ok := m.reg.Route(id)
	if !ok {
		m.core.Fatal = kernel.Errorf(kernel.KindNotFound, "runtime.navigate", "no route %q", id)
		return m, nil
	}
	if existing, built := m.views[id]; built && !route.Ephemeral && existing != nil {
		return m, nil
	}

	view, err := m.reg.Build(id, m.Context())
	if err != nil {
		m.core.Fatal = err
		return m, nil
	}

	views := make(map[navigation.RouteID]registry.View, len(m.views)+1)
	for k, v := range m.views {
		views[k] = v
	}
	views[id] = view
	m.views = views
	return m, view.Init()
}

func (m Model) reduceFocus(msg focus.Msg) Model {
	switch msg.Kind {
	case focus.KindNext:
		m.focus = m.focus.Next()
	case focus.KindPrev:
		m.focus = m.focus.Prev()
	case focus.KindSet:
		m.focus = m.focus.Set(msg.Region).SetJumpMode(false)
	case focus.KindDirectional:
		m.focus = m.focus.Directional(msg.Dir, m.regionRects())
	case focus.KindJumpMode:
		m.focus = m.focus.SetJumpMode(msg.On)
	}
	return m
}

func (m Model) openOverlay(o registry.Overlay) (Model, tea.Cmd) {
	if o == nil {
		return m, nil
	}
	m.ui.Overlays = append(slices.Clone(m.ui.Overlays), o)
	m.focus = m.focus.EnterScope(focus.ScopeID("overlay:"+o.ID()), o.FocusRegions())
	return m, o.Init(m.Context())
}

func (m Model) closeOverlay(id registry.OverlayID) Model {
	if len(m.ui.Overlays) == 0 {
		return m
	}
	index := len(m.ui.Overlays) - 1
	if id != "" {
		index = slices.IndexFunc(m.ui.Overlays, func(o registry.Overlay) bool { return o.ID() == id })
		if index < 0 {
			return m
		}
	}
	m.ui.Overlays = slices.Delete(slices.Clone(m.ui.Overlays), index, index+1)
	m.focus, _ = m.focus.ExitScope()
	return m
}

func (m Model) addToast(msg registry.ToastMsg) (tea.Model, tea.Cmd) {
	m.ui.nextToast++
	seq := m.ui.nextToast
	m.ui.Toasts = append(slices.Clone(m.ui.Toasts), toast{seq: seq, toast: msg.Toast})

	return m, tea.Tick(ToastLifetime, func(time.Time) tea.Msg {
		return registry.ToastExpiredMsg{Seq: seq}
	})
}

// resolveLayout re-solves the frame and revalidates focus against it. Layout
// is state computed here, not geometry derived during rendering.
func (m Model) resolveLayout() Model {
	m.frame = layout.Solve(m.core.Size, m.options)
	m.ui.Breakpoint = m.frame.Breakpoint
	return m.syncFocus()
}

// syncFocus re-reads the active surface's regions and records their rectangles
// on the frame, so that traversal, hit-testing and jump badges all agree.
func (m Model) syncFocus() Model {
	regions := m.activeRegions()
	m.focus = m.focus.Revalidate(regions)

	if placed, ok := m.activeSurface().(registry.Placed); ok {
		frame := m.frame
		for id, rect := range placed.RegionRects(m.workspace()) {
			frame = frame.WithRegion(id, rect)
		}
		m.frame = frame
	}
	return m
}

func (m Model) activeSurface() any {
	if len(m.ui.Overlays) > 0 {
		return m.ui.Overlays[len(m.ui.Overlays)-1]
	}
	return m.ActiveView()
}

func (m Model) activeRegions() []focus.Region {
	if f, ok := m.activeSurface().(registry.Focusable); ok {
		return f.FocusRegions()
	}
	return nil
}

func (m Model) regionRects() map[focus.ID]kernel.Rect {
	out := map[focus.ID]kernel.Rect{}
	for _, id := range m.frame.Regions() {
		if r, ok := m.frame.Region(id); ok {
			out[id] = r
		}
	}
	return out
}

func (m Model) workspace() kernel.Rect {
	if m.frame.Workspace.IsEmpty() {
		return m.core.Size.Rect()
	}
	return m.frame.Workspace
}

// inputContext is the state a key resolution happens in.
func (m Model) inputContext() input.Context {
	capture := false
	if c, ok := m.activeSurface().(registry.Capturing); ok {
		capture = c.Capturing()
	}
	scope := m.Context().Scope()
	scope.Overlay = string(m.Overlay())

	return input.Context{Scope: scope, Capture: capture, Pending: m.core.Pending}
}

// recovered converts a panic in domain code into an error panel. The app keeps
// running and the terminal is never touched, because a nil pointer in a module
// is not a reason to wreck the user's session. Only a runtime failure — which
// arrives as a FatalMsg — is allowed to end the program.
func (m Model) recovered(r any) Model {
	m.log.Error("recovered from a panic in a module",
		"panic", fmt.Sprint(r),
		"route", m.nav.Current().Route,
		"stack", string(debug.Stack()))

	m.core.Recovered = kernel.Errorf(kernel.KindModule, "runtime.Update", "%v", r)
	return m
}

// switchTheme assigns a palette. There is no reload and no cache to
// invalidate: a theme is a value and the styles inside it are already built.
func (m Model) switchTheme(msg registry.ThemeMsg) Model {
	next := m.themes.Next(m.theme.Name)
	if !msg.Next {
		found, err := m.themes.Get(msg.Name)
		if err != nil {
			m.log.Warn("unknown theme", "name", msg.Name)
			return m
		}
		next = found
	}
	m.theme = next
	return m
}

// cycleRoute steps through the visible sections, wrapping.
func (m Model) cycleRoute(delta int) (tea.Model, tea.Cmd) {
	routes := m.reg.NavRoutes()
	if len(routes) == 0 {
		return m, nil
	}
	index := slices.IndexFunc(routes, func(r navigation.Route) bool { return r.ID == m.nav.Root() })
	if index < 0 {
		index = 0
	}
	target := routes[((index+delta)%len(routes)+len(routes))%len(routes)].ID
	return m.navigate(navigation.NavigateMsg{Kind: navigation.KindSwitch, Route: target})
}
