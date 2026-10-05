package focus

import (
	"testing"

	"pc/internal/tui/kernel"
)

func regions() []Region {
	return []Region{
		{ID: "sources", Order: 1, Label: "Sources", JumpKey: 's'},
		{ID: "metrics", Order: 2, Label: "Metrics"},
		{ID: "overview", Order: 3, Label: "Overview", JumpKey: 'o'},
	}
}

func home() State {
	return NewState("route:home").SetRegions(regions())
}

func TestTraversalWraps(t *testing.T) {
	tests := []struct {
		name  string
		steps []string
		want  ID
	}{
		{name: "starts on the first region", want: "sources"},
		{name: "next", steps: []string{"next"}, want: "metrics"},
		{name: "next twice", steps: []string{"next", "next"}, want: "overview"},
		{name: "next wraps", steps: []string{"next", "next", "next"}, want: "sources"},
		{name: "prev wraps backwards", steps: []string{"prev"}, want: "overview"},
		{name: "next then prev returns", steps: []string{"next", "prev"}, want: "sources"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s := home()
			for _, step := range tt.steps {
				if step == "next" {
					s = s.Next()
					continue
				}
				s = s.Prev()
			}
			if got := s.Current(); got != tt.want {
				t.Errorf("Current() = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestRegionsAreOrderedByDeclaredOrder(t *testing.T) {
	s := NewState("route:home").SetRegions([]Region{
		{ID: "third", Order: 30},
		{ID: "first", Order: 10},
		{ID: "second", Order: 20},
	})

	if got := s.Current(); got != "first" {
		t.Fatalf("Current() = %q, want \"first\"", got)
	}
	if got := s.Next().Current(); got != "second" {
		t.Errorf("Next() = %q, want \"second\"", got)
	}
}

func TestSkippedRegionsLeaveTheRing(t *testing.T) {
	s := NewState("route:home").SetRegions([]Region{
		{ID: "a", Order: 1},
		{ID: "b", Order: 2, Skip: true},
		{ID: "c", Order: 3},
	})

	if got := s.Next().Current(); got != "c" {
		t.Errorf("Next() = %q, want \"c\" — a skipped region is not tab-reachable", got)
	}
	if got := s.Set("b").Current(); got != "a" {
		t.Errorf("Set on a skipped region moved focus to %q, want it to stay on \"a\"", got)
	}
}

func TestSetIgnoresUnknownRegions(t *testing.T) {
	s := home()
	if got := s.Set("nope").Current(); got != "sources" {
		t.Errorf("Current() = %q, want \"sources\"", got)
	}
}

func TestRevalidateFallsBackToTheNearestSurvivor(t *testing.T) {
	tests := []struct {
		name      string
		focus     ID
		remaining []Region
		want      ID
	}{
		{
			name:      "focus survives",
			focus:     "metrics",
			remaining: regions(),
			want:      "metrics",
		},
		{
			name:  "focused region disappears",
			focus: "metrics",
			remaining: []Region{
				{ID: "sources", Order: 1},
				{ID: "overview", Order: 3},
			},
			want: "sources",
		},
		{
			name:  "focused region becomes unreachable",
			focus: "metrics",
			remaining: []Region{
				{ID: "sources", Order: 1},
				{ID: "metrics", Order: 2, Skip: true},
				{ID: "overview", Order: 3},
			},
			want: "sources",
		},
		{
			name:      "nothing is left",
			focus:     "metrics",
			remaining: nil,
			want:      "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s := home().Set(tt.focus)
			if got := s.Revalidate(tt.remaining).Current(); got != tt.want {
				t.Errorf("Current() = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestScopesTrapAndRestoreFocus(t *testing.T) {
	s := home().Next()
	if got := s.Current(); got != "metrics" {
		t.Fatalf("setup: Current() = %q, want \"metrics\"", got)
	}

	s = s.EnterScope("overlay:confirm", []Region{
		{ID: "confirm.yes", Order: 1},
		{ID: "confirm.no", Order: 2},
	})
	if got := s.Current(); got != "confirm.yes" {
		t.Fatalf("entering a scope focused %q, want \"confirm.yes\"", got)
	}
	if got := s.Depth(); got != 2 {
		t.Fatalf("Depth() = %d, want 2", got)
	}

	s = s.Next()
	if got := s.Current(); got != "confirm.no" {
		t.Fatalf("traversal inside the overlay reached %q", got)
	}
	if s.Set("sources").Current() != "confirm.no" {
		t.Error("focus escaped the trapped scope")
	}

	s, ok := s.ExitScope()
	if !ok {
		t.Fatal("ExitScope() must report true when a scope was pushed")
	}
	if got := s.Current(); got != "metrics" {
		t.Errorf("Current() = %q, want \"metrics\" restored", got)
	}
	if _, ok := s.ExitScope(); ok {
		t.Error("ExitScope() at the root must report false")
	}
}

func TestScopeMemorySurvivesReEntry(t *testing.T) {
	overlay := []Region{{ID: "one", Order: 1}, {ID: "two", Order: 2}}

	s := home().EnterScope("overlay:palette", overlay).Next()
	s, _ = s.ExitScope()
	s = s.EnterScope("overlay:palette", overlay)

	if got := s.Current(); got != "two" {
		t.Errorf("Current() = %q, want \"two\" remembered from last time", got)
	}
}

func TestDirectional(t *testing.T) {
	rects := map[ID]kernel.Rect{
		"left":  {X: 0, Y: 0, Width: 20, Height: 20},
		"right": {X: 20, Y: 0, Width: 20, Height: 10},
		"below": {X: 20, Y: 10, Width: 20, Height: 10},
	}
	base := NewState("route:home").SetRegions([]Region{
		{ID: "left", Order: 1},
		{ID: "right", Order: 2},
		{ID: "below", Order: 3},
	})

	tests := []struct {
		name string
		from ID
		dir  Dir
		want ID
	}{
		{name: "right from the left pane", from: "left", dir: Right, want: "right"},
		{name: "left from the right pane", from: "right", dir: Left, want: "left"},
		{name: "down from the right pane", from: "right", dir: Down, want: "below"},
		{name: "up from the lower pane", from: "below", dir: Up, want: "right"},
		{name: "no neighbour leaves focus alone", from: "left", dir: Left, want: "left"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := base.Set(tt.from).Directional(tt.dir, rects).Current()
			if got != tt.want {
				t.Errorf("Directional(%v) = %q, want %q", tt.dir, got, tt.want)
			}
		})
	}
}

func TestDirectionalIgnoresRegionsWithNoRectangle(t *testing.T) {
	s := home().Directional(Right, map[ID]kernel.Rect{})
	if got := s.Current(); got != "sources" {
		t.Errorf("Current() = %q, want \"sources\" — a region with no rect is not on screen", got)
	}
}

func TestJumpKeys(t *testing.T) {
	s := NewState("route:home").SetRegions([]Region{
		{ID: "sources", Order: 1, Label: "Sources", JumpKey: 's'},
		{ID: "metrics", Order: 2, Label: "Metrics"},
		{ID: "summary", Order: 3, Label: "Summary"},
		{ID: "hidden", Order: 4, Label: "Hidden", Skip: true},
		{ID: "digits", Order: 5, Label: "42"},
	})

	keys := s.JumpKeys()
	if got := keys["sources"]; got != 's' {
		t.Errorf("declared key = %q, want 's'", got)
	}
	if got := keys["metrics"]; got != 'm' {
		t.Errorf("derived key = %q, want 'm'", got)
	}
	if got := keys["summary"]; got != 'u' {
		t.Errorf("collision fell back to %q, want 'u' — 's' is taken", got)
	}
	if _, ok := keys["hidden"]; ok {
		t.Error("a skipped region must not get a jump key")
	}
	if got := keys["digits"]; got != '1' {
		t.Errorf("label with no free letter got %q, want '1'", got)
	}

	seen := map[rune]bool{}
	for id, key := range keys {
		if seen[key] {
			t.Errorf("jump key %q was assigned twice, second to %q", key, id)
		}
		seen[key] = true
	}
}

func TestJumpModeToggles(t *testing.T) {
	s := home()
	if s.JumpMode() {
		t.Fatal("jump mode must start off")
	}
	s = s.SetJumpMode(true)
	if !s.JumpMode() {
		t.Fatal("SetJumpMode(true) did not take")
	}
	if s.EnterScope("overlay:x", []Region{{ID: "a"}}).JumpMode() {
		t.Error("opening an overlay must cancel jump mode")
	}
}

func TestTransitionsDoNotMutateTheReceiver(t *testing.T) {
	base := home()

	base.Next()
	base.EnterScope("overlay:x", []Region{{ID: "a"}})
	base.Set("overview")

	if got := base.Current(); got != "sources" {
		t.Errorf("Current() = %q, want \"sources\"", got)
	}
	if got := base.Depth(); got != 1 {
		t.Errorf("Depth() = %d, want 1", got)
	}
}
