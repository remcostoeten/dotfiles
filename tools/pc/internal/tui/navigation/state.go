package navigation

import "slices"

// State is the navigation machine. Transitions return a new State; nothing
// mutates in place, so a transition is a table test with no terminal in sight.
type State struct {
	stack   []Entry
	history []RouteID
	cursor  int
	tabs    map[RouteID]int
}

// NewState starts at a root route.
func NewState(root RouteID) State {
	return State{
		stack:   []Entry{{Route: root}},
		history: []RouteID{root},
		tabs:    map[RouteID]int{},
	}
}

// Current is the entry on top of the stack.
func (s State) Current() Entry {
	if len(s.stack) == 0 {
		return Entry{}
	}
	return s.stack[len(s.stack)-1]
}

// Root is the section the stack was entered from.
func (s State) Root() RouteID {
	if len(s.stack) == 0 {
		return ""
	}
	return s.stack[0].Route
}

// Depth is how far the user has drilled in. One means a top-level section.
func (s State) Depth() int {
	return len(s.stack)
}

// Stack lists the entries from root to current.
func (s State) Stack() []Entry {
	return slices.Clone(s.stack)
}

// Push drills into a nested route, keeping the current one beneath it.
func (s State) Push(id RouteID, params Params) State {
	if id.IsZero() {
		return s
	}
	s.stack = append(slices.Clone(s.stack), Entry{Route: id, Params: params})
	return s
}

// Pop unwinds one level. It reports false at the root, where esc should mean
// something else — usually closing an overlay or nothing at all.
func (s State) Pop() (State, bool) {
	if len(s.stack) <= 1 {
		return s, false
	}
	s.stack = slices.Clone(s.stack[:len(s.stack)-1])
	return s, true
}

// Switch moves to a sibling section, discarding any drill-in depth and
// recording the move in history. Re-entering the current section is a no-op,
// so holding a nav key does not fill the history with duplicates.
func (s State) Switch(id RouteID, params Params) State {
	if id.IsZero() || (s.Root() == id && s.Depth() == 1) {
		return s
	}
	s.stack = []Entry{{Route: id, Params: params}}
	s.history = append(slices.Clone(s.history[:s.cursor+1]), id)
	s.cursor = len(s.history) - 1
	return s
}

// Back steps to the previously visited section.
func (s State) Back() (State, bool) {
	if s.cursor <= 0 {
		return s, false
	}
	s.cursor--
	s.stack = []Entry{{Route: s.history[s.cursor]}}
	return s, true
}

// Forward reverses a Back.
func (s State) Forward() (State, bool) {
	if s.cursor >= len(s.history)-1 {
		return s, false
	}
	s.cursor++
	s.stack = []Entry{{Route: s.history[s.cursor]}}
	return s, true
}

// History lists the visited sections, oldest first.
func (s State) History() []RouteID {
	return slices.Clone(s.history)
}

// Tab is the selected tab index for a route, defaulting to the first.
func (s State) Tab(id RouteID) int {
	return s.tabs[id]
}

// SetTab records a route's selected tab. The index belongs to the route rather
// than to the widget so that leaving and returning preserves it.
func (s State) SetTab(id RouteID, index int) State {
	tabs := make(map[RouteID]int, len(s.tabs)+1)
	for k, v := range s.tabs {
		tabs[k] = v
	}
	tabs[id] = max(0, index)
	s.tabs = tabs
	return s
}
