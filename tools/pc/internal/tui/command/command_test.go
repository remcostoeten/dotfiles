package command

import (
	"slices"
	"testing"

	tea "charm.land/bubbletea/v2"

	"pc/internal/tui/kernel"
)

type ranMsg struct{ id ID }

func runner(id ID) Runner {
	return func(Scope) tea.Cmd {
		return func() tea.Msg { return ranMsg{id: id} }
	}
}

func registry(t *testing.T) *Registry {
	t.Helper()
	r := NewRegistry()

	commands := []Command{
		{ID: "app.quit", Title: "Quit", Category: "Application", Run: runner("app.quit")},
		{ID: "app.palette", Title: "Command Palette", Category: "Application", Keywords: []string{"search"}, Run: runner("app.palette")},
		{ID: "git.fetch", Title: "Fetch from origin", Category: "Git", When: OnRoute("git"), Run: runner("git.fetch")},
		{ID: "git.push", Title: "Push", Category: "Git", When: OnRoute("git"), Dangerous: true, Run: runner("git.push")},
	}
	for _, c := range commands {
		if err := r.Add(c); err != nil {
			t.Fatalf("Add(%q): %v", c.ID, err)
		}
	}
	return r
}

func ids(commands []Command) []ID {
	out := make([]ID, len(commands))
	for i, c := range commands {
		out[i] = c.ID
	}
	return out
}

func TestAddRejectsDuplicatesAndBlanks(t *testing.T) {
	r := NewRegistry()

	if err := r.Add(Command{Title: "no id"}); err == nil {
		t.Error("Add() accepted a command with no id")
	} else if !kernel.IsKind(err, kernel.KindConfig) {
		t.Errorf("error kind = %v, want config", kernel.KindOf(err))
	}

	if err := r.Add(Command{ID: "a", Title: "A"}); err != nil {
		t.Fatalf("Add(): %v", err)
	}
	err := r.Add(Command{ID: "a", Title: "Also A"})
	if err == nil {
		t.Fatal("Add() accepted a duplicate id")
	}
	if !kernel.IsKind(err, kernel.KindConflict) {
		t.Errorf("error kind = %v, want conflict", kernel.KindOf(err))
	}
}

func TestAvailableRespectsPredicates(t *testing.T) {
	r := registry(t)

	tests := []struct {
		name  string
		scope Scope
		want  []ID
	}{
		{name: "off the git route", scope: Scope{Route: "home"}, want: []ID{"app.quit", "app.palette"}},
		{name: "on the git route", scope: Scope{Route: "git"}, want: []ID{"app.quit", "app.palette", "git.fetch", "git.push"}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := ids(r.Available(tt.scope)); !slices.Equal(got, tt.want) {
				t.Errorf("Available() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestPredicateCombinators(t *testing.T) {
	tests := []struct {
		name  string
		p     Predicate
		scope Scope
		want  bool
	}{
		{name: "nil always passes", scope: Scope{}, want: true},
		{name: "on route", p: OnRoute("git"), scope: Scope{Route: "git"}, want: true},
		{name: "off route", p: OnRoute("git"), scope: Scope{Route: "home"}},
		{name: "on region", p: OnRegion("pods.table"), scope: Scope{Region: "pods.table"}, want: true},
		{name: "nested", p: WhenNested(), scope: Scope{Depth: 2}, want: true},
		{name: "not nested", p: WhenNested(), scope: Scope{Depth: 1}},
		{name: "no overlay", p: WhenNoOverlay(), scope: Scope{}, want: true},
		{name: "overlay open", p: WhenNoOverlay(), scope: Scope{Overlay: "palette"}},
		{name: "and passes", p: And(OnRoute("git"), WhenNested()), scope: Scope{Route: "git", Depth: 2}, want: true},
		{name: "and fails on one", p: And(OnRoute("git"), WhenNested()), scope: Scope{Route: "git", Depth: 1}},
		{name: "or passes on one", p: Or(OnRoute("git"), WhenNested()), scope: Scope{Route: "home", Depth: 2}, want: true},
		{name: "or fails on all", p: Or(OnRoute("git"), WhenNested()), scope: Scope{Route: "home", Depth: 1}},
		{name: "not inverts", p: Not(OnRoute("git")), scope: Scope{Route: "home"}, want: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := tt.p.Allow(tt.scope); got != tt.want {
				t.Errorf("Allow(%+v) = %v, want %v", tt.scope, got, tt.want)
			}
		})
	}
}

func TestRun(t *testing.T) {
	r := registry(t)
	scope := Scope{Route: "git"}

	cmd := r.Run("git.fetch", scope)
	if cmd == nil {
		t.Fatal("Run() returned no command")
	}
	if got, ok := cmd().(ranMsg); !ok || got.id != "git.fetch" {
		t.Errorf("the command produced %#v", cmd())
	}

	if r.Run("git.fetch", Scope{Route: "home"}) != nil {
		t.Error("running an unavailable command must be a no-op, not a crash")
	}
	if r.Run("nope", scope) != nil {
		t.Error("running an unknown command must be a no-op — a stale keybinding cannot take the app down")
	}
}

func TestGet(t *testing.T) {
	r := registry(t)

	if c, err := r.Get("app.quit"); err != nil || c.Title != "Quit" {
		t.Errorf("Get() = %+v, %v", c, err)
	}
	_, err := r.Get("nope")
	if err == nil || !kernel.IsKind(err, kernel.KindNotFound) {
		t.Errorf("Get() error = %v, want not_found", err)
	}
}

func TestSearch(t *testing.T) {
	r := registry(t)
	scope := Scope{Route: "git"}

	tests := []struct {
		name  string
		query string
		first ID
		count int
	}{
		{name: "empty query lists everything available", query: "", first: "app.quit", count: 4},
		{name: "exact title", query: "push", first: "git.push", count: 1},
		{name: "title prefix", query: "fetch", first: "git.fetch", count: 1},
		{name: "id prefix", query: "git.", first: "git.fetch", count: 2},
		{name: "category", query: "application", first: "app.quit", count: 2},
		{name: "keyword", query: "search", first: "app.palette", count: 1},
		{name: "subsequence", query: "ffo", first: "git.fetch", count: 1},
		{name: "no match", query: "zzzz", count: 0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := r.Search(tt.query, scope)
			if len(got) != tt.count {
				t.Fatalf("Search(%q) returned %v, want %d results", tt.query, ids(got), tt.count)
			}
			if tt.count > 0 && got[0].ID != tt.first {
				t.Errorf("Search(%q) ranked %q first, want %q", tt.query, got[0].ID, tt.first)
			}
		})
	}
}

func TestSearchNeverReturnsUnavailableCommands(t *testing.T) {
	r := registry(t)
	for _, c := range r.Search("git", Scope{Route: "home"}) {
		if c.When != nil {
			t.Errorf("Search returned %q, whose predicate fails in this scope", c.ID)
		}
	}
}

func TestDispatchEmitsAnExecMsg(t *testing.T) {
	msg, ok := Dispatch("app.quit")().(ExecMsg)
	if !ok {
		t.Fatalf("Dispatch produced %#v, want ExecMsg", msg)
	}
	if msg.ID != "app.quit" {
		t.Errorf("ExecMsg.ID = %q, want \"app.quit\"", msg.ID)
	}
}
