package registry

import (
	"reflect"
	"slices"

	tea "charm.land/bubbletea/v2"

	"pc/internal/tui/command"
	"pc/internal/tui/input"
	"pc/internal/tui/kernel"
	navigation "pc/internal/tui/navigation"
	"pc/internal/tui/theme"
)

// ModuleID names a feature.
type ModuleID string

// Module is the entire extension API: a struct with a Register method. There
// is no plugin loader, no discovery and no lifecycle graph — Go compiles fast,
// and recompiling to add a module is the right trade for a starter you clone.
type Module interface {
	ID() ModuleID
	Register(*Registrar)
}

// Constructor builds a view for a route. It is held here rather than on
// navigation.Route so that navigation stays a pure state machine.
type Constructor func(Context) View

type routeEntry struct {
	route navigation.Route
	build Constructor
}

// Services holds values modules share by type. It is an escape hatch: two
// modules needing each other usually means the shared thing belongs in its own
// package, depended on by both.
type Services struct {
	byType map[reflect.Type]any
}

func newServices() *Services {
	return &Services{byType: map[reflect.Type]any{}}
}

// Get resolves a service by its type, reporting whether one was registered.
func Get[T any](s *Services) (T, bool) {
	var zero T
	if s == nil {
		return zero, false
	}
	v, ok := s.byType[reflect.TypeOf(zero)]
	if !ok {
		return zero, false
	}
	out, ok := v.(T)
	return out, ok
}

// Registrar is what a module writes into during boot. It is write-only, and
// only while booting.
type Registrar struct {
	routes   []routeEntry
	commands *command.Registry
	keymap   *input.Resolver
	status   []StatusItem
	themes   []theme.Theme
	services *Services
	subs     []func(Context) tea.Cmd
	errs     []error
}

// NewRegistrar starts an empty registration pass.
func NewRegistrar() *Registrar {
	return &Registrar{
		commands: command.NewRegistry(),
		keymap:   input.NewResolver(),
		services: newServices(),
	}
}

// Route installs a screen and its nav entry.
func (r *Registrar) Route(route navigation.Route, build Constructor) {
	switch {
	case route.ID.IsZero():
		r.fail(kernel.Errorf(kernel.KindConfig, "registry.Route", "a route needs an id"))
	case build == nil:
		r.fail(kernel.Errorf(kernel.KindConfig, "registry.Route", "route %q has no constructor", route.ID))
	case slices.ContainsFunc(r.routes, func(e routeEntry) bool { return e.route.ID == route.ID }):
		r.fail(kernel.Errorf(kernel.KindConflict, "registry.Route", "route %q is already registered", route.ID))
	default:
		r.routes = append(r.routes, routeEntry{route: route, build: build})
	}
}

// Command installs a verb.
func (r *Registrar) Command(c command.Command) {
	r.fail(r.commands.Add(c))
}

// Bind installs a key, or a chord, in a layer.
func (r *Registrar) Bind(layer input.Layer, b input.Binding) {
	r.fail(r.keymap.Add(layer, b))
}

// StatusItem installs a status bar segment.
func (r *Registrar) StatusItem(item StatusItem) {
	if item.Render == nil {
		r.fail(kernel.Errorf(kernel.KindConfig, "registry.StatusItem", "a status item needs a renderer"))
		return
	}
	r.status = append(r.status, item)
}

// Theme installs an extra palette.
func (r *Registrar) Theme(t theme.Theme) {
	r.themes = append(r.themes, t)
}

// Service publishes a value other modules may resolve by type.
func (r *Registrar) Service(v any) {
	if v == nil {
		r.fail(kernel.Errorf(kernel.KindConfig, "registry.Service", "cannot register a nil service"))
		return
	}
	r.services.byType[reflect.TypeOf(v)] = v
}

// Subscribe installs a background producer: a ticker, a watcher, anything that
// emits messages over the life of the program.
func (r *Registrar) Subscribe(sub func(Context) tea.Cmd) {
	if sub == nil {
		return
	}
	r.subs = append(r.subs, sub)
}

func (r *Registrar) fail(err error) {
	if err != nil {
		r.errs = append(r.errs, err)
	}
}

// Registry is the frozen result of a registration pass: shared by pointer,
// written once, read-only afterwards.
type Registry struct {
	routes   []routeEntry
	commands *command.Registry
	keymap   *input.Resolver
	status   []StatusItem
	themes   []theme.Theme
	services *Services
	subs     []func(Context) tea.Cmd
}

// Freeze validates the registration pass and closes it. It reports every
// problem it found rather than only the first, because a boot failure should
// name all of them at once.
func (r *Registrar) Freeze() (*Registry, error) {
	errs := slices.Clone(r.errs)
	for _, c := range r.keymap.Conflicts() {
		errs = append(errs, c)
	}
	if len(errs) > 0 {
		return nil, &RegistrationError{Errs: errs}
	}

	routes := slices.Clone(r.routes)
	slices.SortStableFunc(routes, func(a, b routeEntry) int { return a.route.Order - b.route.Order })

	status := slices.Clone(r.status)
	slices.SortStableFunc(status, func(a, b StatusItem) int { return a.Order - b.Order })

	return &Registry{
		routes:   routes,
		commands: r.commands,
		keymap:   r.keymap,
		status:   status,
		themes:   slices.Clone(r.themes),
		services: r.services,
		subs:     slices.Clone(r.subs),
	}, nil
}

// Routes lists every registered route, sorted by declared order.
func (r *Registry) Routes() []navigation.Route {
	out := make([]navigation.Route, len(r.routes))
	for i, e := range r.routes {
		out[i] = e.route
	}
	return out
}

// NavRoutes lists the routes that appear in the top nav.
func (r *Registry) NavRoutes() []navigation.Route {
	var out []navigation.Route
	for _, e := range r.routes {
		if !e.route.Hidden {
			out = append(out, e.route)
		}
	}
	return out
}

// Route looks a route's metadata up.
func (r *Registry) Route(id navigation.RouteID) (navigation.Route, bool) {
	for _, e := range r.routes {
		if e.route.ID == id {
			return e.route, true
		}
	}
	return navigation.Route{}, false
}

// Build constructs a route's view.
func (r *Registry) Build(id navigation.RouteID, ctx Context) (View, error) {
	for _, e := range r.routes {
		if e.route.ID == id {
			return e.build(ctx), nil
		}
	}
	return nil, kernel.Errorf(kernel.KindNotFound, "registry.Build", "no route %q", id)
}

// FirstRoute is the route the shell opens on: the lowest-ordered visible one.
func (r *Registry) FirstRoute() navigation.RouteID {
	for _, e := range r.routes {
		if !e.route.Hidden {
			return e.route.ID
		}
	}
	if len(r.routes) > 0 {
		return r.routes[0].route.ID
	}
	return ""
}

// Commands is the frozen verb list.
func (r *Registry) Commands() *command.Registry {
	return r.commands
}

// Keymap is the frozen key resolver.
func (r *Registry) Keymap() *input.Resolver {
	return r.keymap
}

// Status lists the status bar segments, sorted by declared order.
func (r *Registry) Status() []StatusItem {
	return slices.Clone(r.status)
}

// Themes lists the palettes modules contributed.
func (r *Registry) Themes() []theme.Theme {
	return slices.Clone(r.themes)
}

// Services resolves module-published values.
func (r *Registry) Services() *Services {
	return r.services
}

// Subscriptions lists the background producers to start at boot.
func (r *Registry) Subscriptions() []func(Context) tea.Cmd {
	return slices.Clone(r.subs)
}

// RegistrationError collects everything wrong with a boot.
type RegistrationError struct {
	Errs []error
}

func (e *RegistrationError) Error() string {
	if len(e.Errs) == 1 {
		return e.Errs[0].Error()
	}
	out := "registration failed:"
	for _, err := range e.Errs {
		out += "\n  - " + err.Error()
	}
	return out
}

func (e *RegistrationError) Unwrap() []error {
	return e.Errs
}
