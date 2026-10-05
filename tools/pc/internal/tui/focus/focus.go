// Package focus owns which region is active. Views declare the regions they
// have; this package owns traversal, trapping and restoration. It imports no
// other framework package.
package focus

import (
	"slices"

	"pc/internal/tui/kernel"
)

// ID names a focusable region. It is kernel.ID so that a region and the frame
// rectangle it was laid out into are addressed by the same value.
type ID = kernel.ID

// ScopeID names a focus scope: a route, or an overlay stacked above one.
type ScopeID string

// Region is a focusable area a view declares. It is data, not a component, so
// jump mode and directional traversal work for regions written after them.
type Region struct {
	ID      ID
	Order   int
	Label   string
	JumpKey rune
	Skip    bool
}

// Dir is a geometric traversal direction.
type Dir uint8

const (
	// Up moves to the nearest region above.
	Up Dir = iota
	// Down moves to the nearest region below.
	Down
	// Left moves to the nearest region to the left.
	Left
	// Right moves to the nearest region to the right.
	Right
)

// Scope is one level of the focus stack.
type Scope struct {
	ID      ScopeID
	regions []Region
	current ID
}

// State is the focus machine. Modal trapping, restoration on close and
// per-route memory are all this one structure rather than three features.
type State struct {
	scopes []Scope
	memory map[ScopeID]ID
	jump   bool
}

// NewState starts with a single empty scope.
func NewState(root ScopeID) State {
	return State{
		scopes: []Scope{{ID: root}},
		memory: map[ScopeID]ID{},
	}
}

// Current is the focused region, or the empty id when nothing is focusable.
func (s State) Current() ID {
	scope, ok := s.top()
	if !ok {
		return ""
	}
	return scope.current
}

// Focused reports whether the given region holds focus.
func (s State) Focused(id ID) bool {
	return !id.IsZero() && s.Current() == id
}

// Scope is the identifier of the active scope.
func (s State) Scope() ScopeID {
	scope, ok := s.top()
	if !ok {
		return ""
	}
	return scope.ID
}

// Depth is how many scopes are stacked. One means no overlay is trapping focus.
func (s State) Depth() int {
	return len(s.scopes)
}

// Regions lists the active scope's regions in declared order.
func (s State) Regions() []Region {
	scope, ok := s.top()
	if !ok {
		return nil
	}
	return slices.Clone(scope.regions)
}

// JumpMode reports whether jump badges should be drawn.
func (s State) JumpMode() bool {
	return s.jump
}

// SetJumpMode turns the badges on or off.
func (s State) SetJumpMode(on bool) State {
	s.jump = on
	return s
}

// EnterScope pushes a scope and traps focus inside it, restoring whatever was
// focused there last time.
func (s State) EnterScope(id ScopeID, regions []Region) State {
	scope := Scope{ID: id, regions: ordered(regions)}
	scope.current = s.memory[id]
	if !contains(scope.regions, scope.current) {
		scope.current = firstReachable(scope.regions)
	}

	s.scopes = append(slices.Clone(s.scopes), scope)
	s.jump = false
	return s.remember()
}

// ExitScope pops a scope, returning focus to exactly where it was beneath.
func (s State) ExitScope() (State, bool) {
	if len(s.scopes) <= 1 {
		return s, false
	}
	s.scopes = slices.Clone(s.scopes[:len(s.scopes)-1])
	s.jump = false
	return s, true
}

// SetRegions replaces the active scope's regions, keeping focus where it is if
// that region survived.
func (s State) SetRegions(regions []Region) State {
	scope, ok := s.top()
	if !ok {
		return s
	}
	scope.regions = ordered(regions)
	if !reachable(scope.regions, scope.current) {
		scope.current = nearest(scope.regions, s.orderOf(scope.current))
	}
	return s.replaceTop(scope).remember()
}

// Set focuses a region by id, ignoring ids that are absent or unreachable.
func (s State) Set(id ID) State {
	scope, ok := s.top()
	if !ok || !reachable(scope.regions, id) {
		return s
	}
	scope.current = id
	return s.replaceTop(scope).remember()
}

// Next moves to the following reachable region, wrapping.
func (s State) Next() State {
	return s.step(1)
}

// Prev moves to the preceding reachable region, wrapping.
func (s State) Prev() State {
	return s.step(-1)
}

// Revalidate re-applies the current regions after a resize or a data change.
// It never leaves focus pointing at a region that no longer exists: it falls
// back to the nearest survivor by declared order.
func (s State) Revalidate(regions []Region) State {
	return s.SetRegions(regions)
}

// Directional moves geometrically, using the rectangles the frame solved. A
// region with no rectangle is unreachable this way, which is correct: it is
// not on screen.
func (s State) Directional(d Dir, rects map[ID]kernel.Rect) State {
	scope, ok := s.top()
	if !ok {
		return s
	}
	from, ok := rects[scope.current]
	if !ok {
		return s
	}

	best := ID("")
	bestScore := 0
	for _, r := range scope.regions {
		if r.Skip || r.ID == scope.current {
			continue
		}
		to, ok := rects[r.ID]
		if !ok || !inDirection(d, from, to) {
			continue
		}
		score := distance(d, from, to)
		if best.IsZero() || score < bestScore {
			best, bestScore = r.ID, score
		}
	}
	if best.IsZero() {
		return s
	}
	return s.Set(best)
}

// JumpKeys assigns a key to every reachable region: the declared one where a
// region asked for it, then unused letters of each label, then digits.
func (s State) JumpKeys() map[ID]rune {
	scope, ok := s.top()
	if !ok {
		return nil
	}

	out := make(map[ID]rune, len(scope.regions))
	used := map[rune]bool{}
	var pending []Region

	for _, r := range scope.regions {
		if r.Skip {
			continue
		}
		if r.JumpKey != 0 && !used[r.JumpKey] {
			out[r.ID] = r.JumpKey
			used[r.JumpKey] = true
			continue
		}
		pending = append(pending, r)
	}

	fallback := []rune("123456789")
	for _, r := range pending {
		key := rune(0)
		for _, c := range lower(r.Label) {
			if c >= 'a' && c <= 'z' && !used[c] {
				key = c
				break
			}
		}
		if key == 0 {
			for _, c := range fallback {
				if !used[c] {
					key = c
					break
				}
			}
		}
		if key == 0 {
			continue
		}
		out[r.ID] = key
		used[key] = true
	}
	return out
}

func (s State) step(delta int) State {
	scope, ok := s.top()
	if !ok {
		return s
	}
	ring := reachableRegions(scope.regions)
	if len(ring) == 0 {
		return s
	}

	index := slices.IndexFunc(ring, func(r Region) bool { return r.ID == scope.current })
	if index < 0 {
		index = 0
		if delta < 0 {
			index = len(ring) - 1
		}
		scope.current = ring[index].ID
		return s.replaceTop(scope).remember()
	}

	scope.current = ring[((index+delta)%len(ring)+len(ring))%len(ring)].ID
	return s.replaceTop(scope).remember()
}

func (s State) top() (Scope, bool) {
	if len(s.scopes) == 0 {
		return Scope{}, false
	}
	return s.scopes[len(s.scopes)-1], true
}

func (s State) replaceTop(scope Scope) State {
	scopes := slices.Clone(s.scopes)
	scopes[len(scopes)-1] = scope
	s.scopes = scopes
	return s
}

// remember records the active scope's focus so that re-entering it restores.
func (s State) remember() State {
	scope, ok := s.top()
	if !ok {
		return s
	}
	memory := make(map[ScopeID]ID, len(s.memory)+1)
	for k, v := range s.memory {
		memory[k] = v
	}
	memory[scope.ID] = scope.current
	s.memory = memory
	return s
}

func (s State) orderOf(id ID) int {
	scope, ok := s.top()
	if !ok {
		return 0
	}
	for _, r := range scope.regions {
		if r.ID == id {
			return r.Order
		}
	}
	return 0
}

// SwitchScope replaces the whole stack with one scope. Navigating between
// sections uses it rather than a push, because a section is not stacked over
// the one before it — but the memory of what was focused there survives.
func (s State) SwitchScope(id ScopeID, regions []Region) State {
	scope := Scope{ID: id, regions: ordered(regions)}
	scope.current = s.memory[id]
	if !reachable(scope.regions, scope.current) {
		scope.current = firstReachable(scope.regions)
	}

	s.scopes = []Scope{scope}
	s.jump = false
	return s.remember()
}
