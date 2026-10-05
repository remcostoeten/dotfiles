// Package registry is where the framework's systems meet. It defines what a
// screen is, what a module is, and what flows down to them — and it holds the
// one shared, write-once, then read-only structure the architecture allows.
package registry

import (
	tea "charm.land/bubbletea/v2"

	"pc/internal/tui/command"
	"pc/internal/tui/core/config"
	"pc/internal/tui/core/render"
	"pc/internal/tui/focus"
	"pc/internal/tui/input"
	"pc/internal/tui/kernel"
	navigation "pc/internal/tui/navigation"
	"pc/internal/tui/theme"
	"pc/internal/tui/ui"
)

// View is a screen. Update returns the interface rather than a concrete type,
// which is what lets the root model hold screens it was not compiled against.
type View interface {
	Init() tea.Cmd
	Update(Context, tea.Msg) (View, tea.Cmd)
	Render(render.Context) string
}

// Focusable is the optional half of a view that declares focus regions. A view
// without regions is a single focusable block.
type Focusable interface {
	FocusRegions() []focus.Region
}

// Bindable is the optional half of a view that brings its own component-layer
// bindings.
type Bindable interface {
	Bindings() []input.Binding
}

// Capturing is the optional half of a view that owns raw keys while a text
// field inside it holds focus.
type Capturing interface {
	Capturing() bool
}

// Context carries update-time dependencies down the tree. Nothing here reaches
// upward: this is dependency injection without a container.
type Context struct {
	Theme    theme.Theme
	Config   config.Config
	Log      kernel.Logger
	Route    navigation.Entry
	Depth    int
	Focus    focus.State
	Size     kernel.Size
	Dispatch func(command.ID) tea.Cmd
	Notify   func(ui.Toast) tea.Cmd
	Services *Services

	// Commands and Keymap let an overlay read the same lists the runtime
	// resolves against — the palette and the help view are consumers of the
	// registry, never owners of it.
	Commands *command.Registry
	Keymap   *input.Resolver
}

// Scope is the command scope this context represents, used to evaluate
// predicates without handing a command the whole model. Depth is how far the
// user has drilled in, not how many overlays are stacked — an overlay is
// reported through Scope.Overlay instead.
func (c Context) Scope() command.Scope {
	return command.Scope{
		Route:  string(c.Route.Route),
		Region: string(c.Focus.Current()),
		Depth:  c.Depth,
	}
}

// StatusItem is a segment of the status bar contributed by a module.
type StatusItem struct {
	Slot   Slot
	Order  int
	Render func(render.Context) string
}

// Slot is which end of the status bar an item sits at.
type Slot uint8

const (
	// SlotLeft places an item beside the keybinding hints.
	SlotLeft Slot = iota
	// SlotRight places an item beside the pinned palette hint.
	SlotRight
)

// Placed is the optional half of a view that reports where it laid its focus
// regions out. Without it a region is still traversable by tab and by jump
// key; with it, the region also answers to a mouse click and to ctrl+hjkl.
type Placed interface {
	RegionRects(area kernel.Rect) map[kernel.ID]kernel.Rect
}
