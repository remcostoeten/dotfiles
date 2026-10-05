package registry

import (
	tea "charm.land/bubbletea/v2"

	"pc/internal/tui/core/render"
	"pc/internal/tui/focus"
	"pc/internal/tui/kernel"
	"pc/internal/tui/layout"
	navigation "pc/internal/tui/navigation"
	"pc/internal/tui/ui"
)

// OverlayID names an open overlay.
type OverlayID string

// Overlay is something drawn over the frame that traps focus: the palette, the
// help view, a confirmation, jump mode. It is an interface here rather than a
// shell type so that the runtime can composite overlays without importing the
// shell that implements them.
type Overlay interface {
	ID() OverlayID
	// Init runs once, when the runtime mounts the overlay. It is where an
	// overlay reads the registry it was opened to display.
	Init(Context) tea.Cmd
	Update(Context, tea.Msg) (Overlay, tea.Cmd)
	Render(render.Context) string
	Placement(layout.Frame) kernel.Rect
	FocusRegions() []focus.Region
}

// OpenMsg asks the runtime to stack an overlay over the frame.
type OpenMsg struct {
	Overlay Overlay
}

// CloseMsg asks the runtime to dismiss the topmost overlay, or a named one.
type CloseMsg struct {
	Overlay OverlayID
}

// Open returns a command that stacks an overlay.
func Open(o Overlay) tea.Cmd {
	return func() tea.Msg { return OpenMsg{Overlay: o} }
}

// Close returns a command that dismisses the topmost overlay.
func Close() tea.Cmd {
	return func() tea.Msg { return CloseMsg{} }
}

// CloseNamed returns a command that dismisses a specific overlay.
func CloseNamed(id OverlayID) tea.Cmd {
	return func() tea.Msg { return CloseMsg{Overlay: id} }
}

// ToastMsg asks the runtime to show a transient notification.
type ToastMsg struct {
	Toast ui.Toast
}

// ToastExpiredMsg retires a notification once its lifetime elapses.
type ToastExpiredMsg struct {
	Seq int
}

// Notify returns a command that shows a notification.
func Notify(t ui.Toast) tea.Cmd {
	return func() tea.Msg { return ToastMsg{Toast: t} }
}

// Chrome draws the parts of the frame that are neither a view nor an overlay.
// The runtime holds it as an interface so that it never imports the shell.
type Chrome interface {
	TopBar(rc render.Context, nav navigation.State, routes []navigation.Route) string
	Sidebar(rc render.Context, nav navigation.State, routes []navigation.Route) string
	StatusBar(rc render.Context, status Status) string
	Boot(rc render.Context) string
	TooSmall(rc render.Context, need kernel.Size) string
	Fatal(rc render.Context, err error) string
}

// Status is everything the status bar draws, already resolved: the shell turns
// bindings into hints, so the bar is generated rather than written.
type Status struct {
	Hints  []ui.Hint
	Items  []string
	Pinned ui.Hint
}

// Multi is the optional half of an overlay that draws several disjoint pieces
// rather than one box — jump badges scattered across the frame. The runtime
// composites each block on its own, so the gaps between them stay transparent
// instead of being painted over with blanks.
type Multi interface {
	Blocks(rc render.Context, frame layout.Frame) []render.Block
}

// OpenFuncMsg stacks an overlay that needs to see the live focus state or the
// solved frame — jump mode, for instance. The runtime supplies both, so the
// caller does not have to smuggle them out of the model.
type OpenFuncMsg struct {
	Build func(focus.State, layout.Frame) Overlay
}

// OpenWith returns a command that stacks an overlay built from live state.
func OpenWith(build func(focus.State, layout.Frame) Overlay) tea.Cmd {
	return func() tea.Msg { return OpenFuncMsg{Build: build} }
}

// ThemeMsg switches the palette. Themes are values, so this is an assignment
// plus a re-render: no reload, no cache invalidation, no component involvement.
type ThemeMsg struct {
	Name string
	Next bool
}

// SetTheme returns a command that switches to a named palette.
func SetTheme(name string) tea.Cmd {
	return func() tea.Msg { return ThemeMsg{Name: name} }
}

// NextTheme returns a command that cycles to the following palette.
func NextTheme() tea.Cmd {
	return func() tea.Msg { return ThemeMsg{Next: true} }
}

// CycleRouteMsg moves to the next or previous top-level section. The runtime
// resolves it against the registered route list, so no caller needs one.
type CycleRouteMsg struct {
	Delta int
}

// CycleRoute returns a command that steps through the nav strip.
func CycleRoute(delta int) tea.Cmd {
	return func() tea.Msg { return CycleRouteMsg{Delta: delta} }
}
