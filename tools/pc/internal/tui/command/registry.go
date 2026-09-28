package command

import (
	"slices"
	"strings"

	tea "charm.land/bubbletea/v2"

	"pc/internal/tui/kernel"
)

// ExecMsg asks the runtime to run a command. Dispatching by identifier rather
// than calling a function is what gives every user action one auditable point.
type ExecMsg struct {
	ID    ID
	Scope Scope
}

// Dispatch returns a command that asks the runtime to run a command by id.
func Dispatch(id ID) tea.Cmd {
	return func() tea.Msg { return ExecMsg{ID: id} }
}

// Registry holds the verb list. It is written during boot and read-only after.
type Registry struct {
	order []ID
	byID  map[ID]Command
}

// NewRegistry builds an empty registry.
func NewRegistry() *Registry {
	return &Registry{byID: map[ID]Command{}}
}

// Add registers a command, refusing a duplicate identifier.
func (r *Registry) Add(c Command) error {
	if c.ID.IsZero() {
		return kernel.Errorf(kernel.KindConfig, "command.Add", "a command needs an id")
	}
	if _, exists := r.byID[c.ID]; exists {
		return kernel.Errorf(kernel.KindConflict, "command.Add", "command %q is already registered", c.ID)
	}
	r.order = append(r.order, c.ID)
	r.byID[c.ID] = c
	return nil
}

// Get looks a command up.
func (r *Registry) Get(id ID) (Command, error) {
	c, ok := r.byID[id]
	if !ok {
		return Command{}, kernel.Errorf(kernel.KindNotFound, "command.Get", "no command %q", id)
	}
	return c, nil
}

// All lists every registered command in registration order.
func (r *Registry) All() []Command {
	out := make([]Command, 0, len(r.order))
	for _, id := range r.order {
		out = append(out, r.byID[id])
	}
	return out
}

// Available lists the commands whose predicate passes in the given scope.
func (r *Registry) Available(scope Scope) []Command {
	out := make([]Command, 0, len(r.order))
	for _, id := range r.order {
		if c := r.byID[id]; c.When.Allow(scope) {
			out = append(out, c)
		}
	}
	return out
}

// Run executes a command. An unknown or unavailable command is a no-op rather
// than a crash, because a stale keybinding must not take the app down.
func (r *Registry) Run(id ID, scope Scope) tea.Cmd {
	c, ok := r.byID[id]
	if !ok || c.Run == nil || !c.When.Allow(scope) {
		return nil
	}
	return c.Run(scope)
}

// Search ranks the available commands against a query. An empty query returns
// everything available, which is what the palette shows when it opens.
func (r *Registry) Search(query string, scope Scope) []Command {
	available := r.Available(scope)
	query = strings.ToLower(strings.TrimSpace(query))
	if query == "" {
		return available
	}

	type scored struct {
		command Command
		score   int
		index   int
	}

	matches := make([]scored, 0, len(available))
	for i, c := range available {
		if score, ok := rank(c, query); ok {
			matches = append(matches, scored{command: c, score: score, index: i})
		}
	}

	slices.SortStableFunc(matches, func(a, b scored) int {
		if a.score != b.score {
			return b.score - a.score
		}
		return a.index - b.index
	})

	out := make([]Command, len(matches))
	for i, m := range matches {
		out[i] = m.command
	}
	return out
}

// rank scores a command against a lowercase query. Exact and prefix matches on
// the title beat substring matches, which beat a subsequence match — so typing
// "gf" still finds "Fetch from origin" but never above a literal hit.
func rank(c Command, query string) (int, bool) {
	title := strings.ToLower(c.Title)
	id := strings.ToLower(string(c.ID))
	category := strings.ToLower(c.Category)

	switch {
	case title == query:
		return 100, true
	case strings.HasPrefix(title, query):
		return 80, true
	case strings.HasPrefix(id, query):
		return 70, true
	case strings.Contains(title, query):
		return 60, true
	case strings.Contains(id, query):
		return 50, true
	case strings.Contains(category, query):
		return 40, true
	}

	for _, keyword := range c.Keywords {
		if strings.Contains(strings.ToLower(keyword), query) {
			return 30, true
		}
	}
	if isSubsequence(query, title) || isSubsequence(query, id) {
		return 10, true
	}
	return 0, false
}

// isSubsequence reports whether every rune of query appears in order in s.
func isSubsequence(query, s string) bool {
	runes := []rune(query)
	if len(runes) == 0 {
		return true
	}
	at := 0
	for _, c := range s {
		if c == runes[at] {
			at++
			if at == len(runes) {
				return true
			}
		}
	}
	return false
}
