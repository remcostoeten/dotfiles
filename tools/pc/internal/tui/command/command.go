// Package command holds the application's verb list. Everything that does
// something is a Command; the palette, the help overlay, the status bar and
// buttons are all consumers of the same registry.
package command

import (
	tea "charm.land/bubbletea/v2"
)

// ID names a command, namespaced by its module: "git.fetch".
type ID string

// IsZero reports whether the identifier is unset.
func (id ID) IsZero() bool {
	return id == ""
}

func (id ID) String() string {
	return string(id)
}

// Scope is the state a predicate is evaluated against. It is a small value
// rather than the whole model, so that command availability is testable
// without a runtime.
type Scope struct {
	Route   string
	Region  string
	Overlay string
	Depth   int
}

// Predicate gates a command's availability. A nil predicate always passes.
type Predicate func(Scope) bool

// Allow reports whether the predicate passes, treating nil as always.
func (p Predicate) Allow(s Scope) bool {
	return p == nil || p(s)
}

// And combines predicates, passing only when every one does.
func And(ps ...Predicate) Predicate {
	return func(s Scope) bool {
		for _, p := range ps {
			if !p.Allow(s) {
				return false
			}
		}
		return true
	}
}

// Or combines predicates, passing when any one does.
func Or(ps ...Predicate) Predicate {
	return func(s Scope) bool {
		for _, p := range ps {
			if p.Allow(s) {
				return true
			}
		}
		return false
	}
}

// Not inverts a predicate.
func Not(p Predicate) Predicate {
	return func(s Scope) bool { return !p.Allow(s) }
}

// OnRoute passes while the given route is active.
func OnRoute(route string) Predicate {
	return func(s Scope) bool { return s.Route == route }
}

// OnRegion passes while the given focus region is active.
func OnRegion(region string) Predicate {
	return func(s Scope) bool { return s.Region == region }
}

// WhenNested passes once the user has drilled in, which is what makes esc mean
// "go back" only where there is somewhere to go back to.
func WhenNested() Predicate {
	return func(s Scope) bool { return s.Depth > 1 }
}

// WhenNoOverlay passes while nothing is stacked over the frame.
func WhenNoOverlay() Predicate {
	return func(s Scope) bool { return s.Overlay == "" }
}

// WhenOverlay passes while something is stacked over the frame. Gating the
// overlay layer on it is what stops esc from being swallowed there when
// nothing is open.
func WhenOverlay() Predicate {
	return func(s Scope) bool { return s.Overlay != "" }
}

// Runner performs a command. It receives the scope the command was invoked in
// and returns a tea.Cmd, so commands are async by default and never block the
// event loop. Anything else a command needs — a service, a client, a config
// section — is captured when the module registers it.
type Runner func(Scope) tea.Cmd

// Command is one verb. It is plain data with a function attached, which is
// what lets the palette, the help overlay and the keymap all read the same list.
type Command struct {
	ID          ID
	Title       string
	Category    string
	Description string
	Keywords    []string
	Dangerous   bool
	When        Predicate
	Run         Runner
}
