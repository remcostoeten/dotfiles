package input

import (
	"slices"
	"testing"

	"pc/internal/tui/command"
)

func TestNormalize(t *testing.T) {
	tests := []struct {
		name string
		in   string
		want string
	}{
		{name: "already canonical", in: "ctrl+p", want: "ctrl+p"},
		{name: "case is meaningless under ctrl", in: "Ctrl+P", want: "ctrl+p"},
		{name: "dash separator", in: "ctrl-p", want: "ctrl+p"},
		{name: "caret shorthand", in: "^p", want: "ctrl+p"},
		{name: "spelled-out modifier", in: "Control+x", want: "ctrl+x"},
		{name: "modifier order is canonical", in: "shift+alt+ctrl+k", want: "ctrl+alt+shift+k"},
		{name: "named key alias", in: "Escape", want: "esc"},
		{name: "page key alias", in: "PageDown", want: "pgdown"},
		{name: "space", in: " ", want: "space"},
		{name: "capital letters are their own binding", in: "G", want: "G"},
		{name: "surrounding whitespace", in: "  tab  ", want: "tab"},
		{name: "empty", in: "", want: ""},
		{name: "a lone minus is a key, not a separator", in: "-", want: "-"},
		{name: "a lone plus is a key, not a separator", in: "+", want: "+"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := Normalize(tt.in); got != tt.want {
				t.Errorf("Normalize(%q) = %q, want %q", tt.in, got, tt.want)
			}
		})
	}
}

func TestNormalizeIsIdempotent(t *testing.T) {
	for _, in := range []string{"Ctrl-P", "^k", "shift+alt+ctrl+k", "Escape", "G", " "} {
		once := Normalize(in)
		if twice := Normalize(once); twice != once {
			t.Errorf("Normalize(%q) = %q, but normalizing again gave %q", in, once, twice)
		}
	}
}

func resolver(t *testing.T) *Resolver {
	t.Helper()
	r := NewResolver()

	bindings := []struct {
		layer Layer
		b     Binding
	}{
		{LayerGlobal, Binding{Keys: []string{"ctrl+k"}, Command: "app.palette", Hint: "palette", Priority: 100}},
		{LayerGlobal, Binding{Keys: []string{"?"}, Command: "app.help", Hint: "Help", Priority: 10}},
		{LayerGlobal, Binding{Keys: []string{"g", "d"}, Command: "app.goto.dashboard"}},
		{LayerGlobal, Binding{Keys: []string{"g", "s"}, Command: "app.goto.settings"}},
		{LayerScreen, Binding{Keys: []string{"?"}, Command: "pods.filter"}},
		{LayerScreen, Binding{Keys: []string{"r"}, Command: "pods.refresh", When: command.OnRoute("pods"), Hint: "Refresh", Priority: 50}},
		{LayerOverlay, Binding{Keys: []string{"esc"}, Command: "overlay.close"}},
		{LayerCapture, Binding{Keys: []string{"esc"}, Command: "input.cancel"}},
	}
	for _, entry := range bindings {
		if err := r.Add(entry.layer, entry.b); err != nil {
			t.Fatalf("Add(%v): %v", entry.b.Keys, err)
		}
	}
	return r
}

func TestResolve(t *testing.T) {
	r := resolver(t)

	tests := []struct {
		name    string
		key     string
		ctx     Context
		kind    ResultKind
		command command.ID
	}{
		{name: "global binding", key: "ctrl+k", kind: Dispatch, command: "app.palette"},
		{name: "normalizes on the way in", key: "^K", kind: Dispatch, command: "app.palette"},
		{name: "unbound key falls through", key: "z", kind: Passthrough},
		{
			name:    "a higher layer shadows a lower one",
			key:     "?",
			kind:    Dispatch,
			command: "pods.filter",
		},
		{
			name:    "predicate gates a binding",
			key:     "r",
			ctx:     Context{Scope: command.Scope{Route: "pods"}},
			kind:    Dispatch,
			command: "pods.refresh",
		},
		{
			name: "predicate blocks it elsewhere",
			key:  "r",
			ctx:  Context{Scope: command.Scope{Route: "home"}},
			kind: Passthrough,
		},
		{
			name:    "the overlay layer wins over the screen",
			key:     "esc",
			kind:    Dispatch,
			command: "overlay.close",
		},
		{
			name:    "capture claims only what it bound",
			key:     "esc",
			ctx:     Context{Capture: true},
			kind:    Dispatch,
			command: "input.cancel",
		},
		{
			name: "capture passes everything else to the field",
			key:  "ctrl+k",
			ctx:  Context{Capture: true},
			kind: Passthrough,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := r.Resolve(tt.key, tt.ctx)
			if got.Kind != tt.kind {
				t.Fatalf("Kind = %v, want %v", got.Kind, tt.kind)
			}
			if got.Command != tt.command {
				t.Errorf("Command = %q, want %q", got.Command, tt.command)
			}
		})
	}
}

func TestChords(t *testing.T) {
	r := resolver(t)

	first := r.Resolve("g", Context{})
	if first.Kind != Pending {
		t.Fatalf("Kind = %v, want Pending", first.Kind)
	}
	if !slices.Equal(first.Prefix, []string{"g"}) {
		t.Errorf("Prefix = %v, want [g]", first.Prefix)
	}
	if len(first.Next) != 2 {
		t.Errorf("Next lists %d continuations, want 2 — the status bar shows them as a menu", len(first.Next))
	}

	second := r.Resolve("d", Context{Pending: first.Prefix})
	if second.Kind != Dispatch || second.Command != "app.goto.dashboard" {
		t.Fatalf("completing the chord gave %v/%q", second.Kind, second.Command)
	}

	stray := r.Resolve("z", Context{Pending: []string{"g"}})
	if stray.Kind != Passthrough {
		t.Errorf("an unmatched second key gave %v, want Passthrough", stray.Kind)
	}
}

func TestHintsAreOrderedByPriority(t *testing.T) {
	r := resolver(t)

	hints := r.Hints(Context{Scope: command.Scope{Route: "pods"}})
	var got []command.ID
	for _, h := range hints {
		got = append(got, h.Command)
	}

	want := []command.ID{"app.palette", "pods.refresh", "app.help"}
	if !slices.Equal(got, want) {
		t.Errorf("Hints() = %v, want %v", got, want)
	}
}

func TestHintsRespectPredicates(t *testing.T) {
	r := resolver(t)

	for _, h := range r.Hints(Context{Scope: command.Scope{Route: "home"}}) {
		if h.Command == "pods.refresh" {
			t.Error("a hint whose predicate fails must not reach the status bar")
		}
	}
}

func TestAddRejectsIncompleteBindings(t *testing.T) {
	tests := []struct {
		name    string
		layer   Layer
		binding Binding
	}{
		{name: "no keys", layer: LayerGlobal, binding: Binding{Command: "app.quit"}},
		{name: "blank keys", layer: LayerGlobal, binding: Binding{Keys: []string{"", "  "}, Command: "app.quit"}},
		{name: "no command", layer: LayerGlobal, binding: Binding{Keys: []string{"q"}}},
		{name: "unknown layer", layer: Layer(99), binding: Binding{Keys: []string{"q"}, Command: "app.quit"}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if err := NewResolver().Add(tt.layer, tt.binding); err == nil {
				t.Error("Add() accepted an incomplete binding")
			}
		})
	}
}

func TestConflicts(t *testing.T) {
	t.Run("a clean keymap has none", func(t *testing.T) {
		if got := resolver(t).Conflicts(); len(got) != 0 {
			t.Errorf("Conflicts() = %v, want none", got)
		}
	})

	t.Run("same keys in the same layer", func(t *testing.T) {
		r := NewResolver()
		_ = r.Add(LayerGlobal, Binding{Keys: []string{"ctrl+k"}, Command: "a"})
		_ = r.Add(LayerGlobal, Binding{Keys: []string{"Ctrl-K"}, Command: "b"})

		if got := r.Conflicts(); len(got) != 1 {
			t.Fatalf("Conflicts() = %v, want one", got)
		}
	})

	t.Run("same keys in different layers is fine", func(t *testing.T) {
		r := NewResolver()
		_ = r.Add(LayerGlobal, Binding{Keys: []string{"j"}, Command: "a"})
		_ = r.Add(LayerScreen, Binding{Keys: []string{"j"}, Command: "b"})

		if got := r.Conflicts(); len(got) != 0 {
			t.Errorf("Conflicts() = %v, want none — layering is the point", got)
		}
	})

	t.Run("a binding shadowing a chord prefix", func(t *testing.T) {
		r := NewResolver()
		_ = r.Add(LayerGlobal, Binding{Keys: []string{"g"}, Command: "a"})
		_ = r.Add(LayerGlobal, Binding{Keys: []string{"g", "d"}, Command: "b"})

		got := r.Conflicts()
		if len(got) != 1 {
			t.Fatalf("Conflicts() = %v, want one", got)
		}
		if got[0].A != "a" || got[0].B != "b" {
			t.Errorf("conflict named %q and %q, want the shadowing binding first", got[0].A, got[0].B)
		}
	})

	t.Run("guarded bindings are left alone", func(t *testing.T) {
		r := NewResolver()
		_ = r.Add(LayerScreen, Binding{Keys: []string{"r"}, Command: "a", When: command.OnRoute("pods")})
		_ = r.Add(LayerScreen, Binding{Keys: []string{"r"}, Command: "b", When: command.OnRoute("git")})

		if got := r.Conflicts(); len(got) != 0 {
			t.Errorf("Conflicts() = %v, want none — predicates are opaque, so this is not provable", got)
		}
	})
}
