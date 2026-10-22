// Package navigation owns which screen is showing. It is a pure state machine:
// a stack for drill-in depth, a history for sibling routes and a per-route tab
// index. It imports no other framework package, and in particular it does not
// know what a view is — the registry pairs a route with its constructor.
package navigation

// RouteID names a registered screen.
type RouteID string

// IsZero reports whether the identifier is unset.
func (id RouteID) IsZero() bool {
	return id == ""
}

func (id RouteID) String() string {
	return string(id)
}

// Params carry values into a route, such as the pod a detail view is for.
type Params map[string]string

// Get reads a parameter, returning the empty string when it is absent.
func (p Params) Get(key string) string {
	return p[key]
}

// Route is a registered screen's metadata. Modules pick an Order band — 10,
// 20, 30 — so that registering one adds a nav entry without editing the shell.
type Route struct {
	ID        RouteID
	Title     string
	Order     int
	Hidden    bool
	Ephemeral bool
}

// Entry is one frame of the navigation stack.
type Entry struct {
	Route  RouteID
	Params Params
}
