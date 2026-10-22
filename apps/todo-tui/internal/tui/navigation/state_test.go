package navigation

import (
	"slices"
	"testing"
)

func TestStackPushAndPop(t *testing.T) {
	s := NewState("home")

	if got := s.Current().Route; got != "home" {
		t.Fatalf("Current() = %q, want \"home\"", got)
	}
	if _, ok := s.Pop(); ok {
		t.Error("popping at the root must report false — esc means something else there")
	}

	s = s.Push("pod", Params{"name": "api-0"})
	if got := s.Depth(); got != 2 {
		t.Fatalf("Depth() = %d, want 2", got)
	}
	if got := s.Current().Params.Get("name"); got != "api-0" {
		t.Errorf("params did not survive the push: %q", got)
	}
	if got := s.Root(); got != "home" {
		t.Errorf("Root() = %q, want \"home\"", got)
	}

	s, ok := s.Pop()
	if !ok {
		t.Fatal("popping a nested route must report true")
	}
	if got := s.Current().Route; got != "home" {
		t.Errorf("Current() = %q, want \"home\"", got)
	}
}

func TestPushIsIgnoredWithoutARoute(t *testing.T) {
	s := NewState("home").Push("", nil)
	if got := s.Depth(); got != 1 {
		t.Errorf("Depth() = %d, want 1 — an empty route id is not a destination", got)
	}
}

func TestSwitchDiscardsDepthAndRecordsHistory(t *testing.T) {
	s := NewState("home").Push("detail", nil).Switch("settings", nil)

	if got := s.Depth(); got != 1 {
		t.Errorf("Depth() = %d, want 1 — switching sections drops drill-in depth", got)
	}
	if got := s.History(); !slices.Equal(got, []RouteID{"home", "settings"}) {
		t.Errorf("History() = %v, want [home settings]", got)
	}
}

func TestSwitchToTheCurrentSectionIsANoOp(t *testing.T) {
	s := NewState("home").Switch("home", nil)
	if got := len(s.History()); got != 1 {
		t.Errorf("history has %d entries, want 1 — re-entering a section must not duplicate it", got)
	}
}

func TestBackAndForward(t *testing.T) {
	s := NewState("home").Switch("manager", nil).Switch("settings", nil)

	s, ok := s.Back()
	if !ok || s.Current().Route != "manager" {
		t.Fatalf("Back() = %q, %v; want \"manager\", true", s.Current().Route, ok)
	}
	s, ok = s.Back()
	if !ok || s.Current().Route != "home" {
		t.Fatalf("Back() = %q, %v; want \"home\", true", s.Current().Route, ok)
	}
	if _, ok := s.Back(); ok {
		t.Error("Back() at the start of history must report false")
	}

	s, ok = s.Forward()
	if !ok || s.Current().Route != "manager" {
		t.Fatalf("Forward() = %q, %v; want \"manager\", true", s.Current().Route, ok)
	}
	s, _ = s.Forward()
	if _, ok := s.Forward(); ok {
		t.Error("Forward() at the end of history must report false")
	}
}

func TestSwitchAfterBackTruncatesTheForwardHistory(t *testing.T) {
	s := NewState("home").Switch("manager", nil).Switch("settings", nil)
	s, _ = s.Back()
	s = s.Switch("logs", nil)

	if got := s.History(); !slices.Equal(got, []RouteID{"home", "manager", "logs"}) {
		t.Errorf("History() = %v, want [home manager logs]", got)
	}
	if _, ok := s.Forward(); ok {
		t.Error("Forward() must report false after a new branch replaced it")
	}
}

func TestTabsAreRememberedPerRoute(t *testing.T) {
	s := NewState("home").SetTab("home", 2).SetTab("manager", 1)

	if got := s.Tab("home"); got != 2 {
		t.Errorf("Tab(home) = %d, want 2", got)
	}
	if got := s.Tab("manager"); got != 1 {
		t.Errorf("Tab(manager) = %d, want 1", got)
	}
	if got := s.Tab("unvisited"); got != 0 {
		t.Errorf("Tab(unvisited) = %d, want 0", got)
	}
	if got := s.SetTab("home", -3).Tab("home"); got != 0 {
		t.Errorf("a negative tab index must clamp to 0, got %d", got)
	}
}

func TestTransitionsDoNotMutateTheReceiver(t *testing.T) {
	base := NewState("home").SetTab("home", 1)

	base.Push("detail", nil)
	base.Switch("settings", nil)
	base.SetTab("home", 9)

	if got := base.Depth(); got != 1 {
		t.Errorf("Depth() = %d, want 1 — transitions must return a new state", got)
	}
	if got := base.Current().Route; got != "home" {
		t.Errorf("Current() = %q, want \"home\"", got)
	}
	if got := base.Tab("home"); got != 1 {
		t.Errorf("Tab(home) = %d, want 1", got)
	}
}

func TestApply(t *testing.T) {
	tests := []struct {
		name    string
		msg     NavigateMsg
		route   RouteID
		depth   int
		changed bool
	}{
		{name: "switch", msg: NavigateMsg{Kind: KindSwitch, Route: "settings"}, route: "settings", depth: 1, changed: true},
		{name: "switch to the same route", msg: NavigateMsg{Kind: KindSwitch, Route: "home"}, route: "home", depth: 1},
		{name: "push", msg: NavigateMsg{Kind: KindPush, Route: "detail"}, route: "detail", depth: 2, changed: true},
		{name: "pop at the root", msg: NavigateMsg{Kind: KindPop}, route: "home", depth: 1},
		{name: "back at the start", msg: NavigateMsg{Kind: KindBack}, route: "home", depth: 1},
		{name: "forward at the end", msg: NavigateMsg{Kind: KindForward}, route: "home", depth: 1},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, changed := NewState("home").Apply(tt.msg)
			if changed != tt.changed {
				t.Errorf("changed = %v, want %v", changed, tt.changed)
			}
			if got.Current().Route != tt.route {
				t.Errorf("route = %q, want %q", got.Current().Route, tt.route)
			}
			if got.Depth() != tt.depth {
				t.Errorf("depth = %d, want %d", got.Depth(), tt.depth)
			}
		})
	}
}
