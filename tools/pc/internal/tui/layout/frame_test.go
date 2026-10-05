package layout

import (
	"testing"

	"pc/internal/tui/kernel"
)

func TestBreakpointFor(t *testing.T) {
	tests := []struct {
		name string
		size kernel.Size
		want Breakpoint
	}{
		{name: "narrow", size: kernel.Size{Width: 60, Height: 20}, want: Compact},
		{name: "just below normal", size: kernel.Size{Width: 79, Height: 20}, want: Compact},
		{name: "exactly normal", size: kernel.Size{Width: 80, Height: 24}, want: Normal},
		{name: "just below wide", size: kernel.Size{Width: 119, Height: 40}, want: Normal},
		{name: "exactly wide", size: kernel.Size{Width: 120, Height: 40}, want: Wide},
		{name: "very wide", size: kernel.Size{Width: 300, Height: 80}, want: Wide},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := BreakpointFor(tt.size); got != tt.want {
				t.Errorf("BreakpointFor(%v) = %v, want %v", tt.size, got, tt.want)
			}
		})
	}
}

func TestTooSmall(t *testing.T) {
	tests := []struct {
		name string
		size kernel.Size
		want bool
	}{
		{name: "exactly the minimum", size: kernel.Size{Width: 40, Height: 10}},
		{name: "comfortable", size: kernel.Size{Width: 80, Height: 24}},
		{name: "one column short", size: kernel.Size{Width: 39, Height: 24}, want: true},
		{name: "one row short", size: kernel.Size{Width: 80, Height: 9}, want: true},
		{name: "unset", size: kernel.Size{}, want: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := TooSmall(tt.size); got != tt.want {
				t.Errorf("TooSmall(%v) = %v, want %v", tt.size, got, tt.want)
			}
		})
	}
}

func TestSolve(t *testing.T) {
	tests := []struct {
		name       string
		size       kernel.Size
		breakpoint Breakpoint
		tooSmall   bool
		topBar     kernel.Rect
		sidebar    kernel.Rect
		workspace  kernel.Rect
		statusBar  kernel.Rect
	}{
		{
			name:       "wide shows a full sidebar",
			size:       kernel.Size{Width: 120, Height: 40},
			breakpoint: Wide,
			topBar:     kernel.Rect{X: 0, Y: 0, Width: 120, Height: 1},
			sidebar:    kernel.Rect{X: 0, Y: 1, Width: 28, Height: 38},
			workspace:  kernel.Rect{X: 28, Y: 1, Width: 92, Height: 38},
			statusBar:  kernel.Rect{X: 0, Y: 39, Width: 120, Height: 1},
		},
		{
			name:       "normal collapses the sidebar",
			size:       kernel.Size{Width: 80, Height: 24},
			breakpoint: Normal,
			topBar:     kernel.Rect{X: 0, Y: 0, Width: 80, Height: 1},
			sidebar:    kernel.Rect{X: 0, Y: 1, Width: 5, Height: 22},
			workspace:  kernel.Rect{X: 5, Y: 1, Width: 75, Height: 22},
			statusBar:  kernel.Rect{X: 0, Y: 23, Width: 80, Height: 1},
		},
		{
			name:       "compact drops the sidebar entirely",
			size:       kernel.Size{Width: 60, Height: 20},
			breakpoint: Compact,
			topBar:     kernel.Rect{X: 0, Y: 0, Width: 60, Height: 1},
			workspace:  kernel.Rect{X: 0, Y: 1, Width: 60, Height: 18},
			statusBar:  kernel.Rect{X: 0, Y: 19, Width: 60, Height: 1},
		},
		{
			name:       "too small yields one full-bleed region",
			size:       kernel.Size{Width: 30, Height: 8},
			breakpoint: Compact,
			tooSmall:   true,
			workspace:  kernel.Rect{X: 0, Y: 0, Width: 30, Height: 8},
		},
		{
			name:       "unset size yields nothing",
			size:       kernel.Size{},
			breakpoint: Compact,
			tooSmall:   true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			f := Solve(tt.size, DefaultOptions())

			if f.Breakpoint != tt.breakpoint {
				t.Errorf("Breakpoint = %v, want %v", f.Breakpoint, tt.breakpoint)
			}
			if f.TooSmall != tt.tooSmall {
				t.Errorf("TooSmall = %v, want %v", f.TooSmall, tt.tooSmall)
			}
			if f.TopBar != tt.topBar {
				t.Errorf("TopBar = %+v, want %+v", f.TopBar, tt.topBar)
			}
			if f.Sidebar != tt.sidebar {
				t.Errorf("Sidebar = %+v, want %+v", f.Sidebar, tt.sidebar)
			}
			if f.Workspace != tt.workspace {
				t.Errorf("Workspace = %+v, want %+v", f.Workspace, tt.workspace)
			}
			if f.StatusBar != tt.statusBar {
				t.Errorf("StatusBar = %+v, want %+v", f.StatusBar, tt.statusBar)
			}
		})
	}
}

func TestSolveChromeNeverOverlapsTheWorkspace(t *testing.T) {
	for w := 40; w <= 200; w += 7 {
		for h := 10; h <= 60; h += 5 {
			f := Solve(kernel.Size{Width: w, Height: h}, DefaultOptions())
			pairs := []struct {
				name string
				a, b kernel.Rect
			}{
				{name: "topbar/workspace", a: f.TopBar, b: f.Workspace},
				{name: "statusbar/workspace", a: f.StatusBar, b: f.Workspace},
				{name: "sidebar/workspace", a: f.Sidebar, b: f.Workspace},
				{name: "topbar/sidebar", a: f.TopBar, b: f.Sidebar},
			}
			for _, p := range pairs {
				if p.a.Overlaps(p.b) {
					t.Fatalf("%dx%d: %s overlap: %+v and %+v", w, h, p.name, p.a, p.b)
				}
			}
			if f.Workspace.Intersect(f.Size.Rect()) != f.Workspace {
				t.Fatalf("%dx%d: workspace %+v escapes the terminal", w, h, f.Workspace)
			}
		}
	}
}

func TestFrameRegions(t *testing.T) {
	base := Solve(kernel.Size{Width: 120, Height: 40}, DefaultOptions())

	left := kernel.Rect{X: 0, Y: 1, Width: 28, Height: 38}
	right := kernel.Rect{X: 28, Y: 1, Width: 92, Height: 38}
	f := base.WithRegion("pods.ns", left).WithRegion("pods.table", right)

	tests := []struct {
		name string
		x, y int
		want kernel.ID
		hit  bool
	}{
		{name: "inside the left region", x: 3, y: 5, want: "pods.ns", hit: true},
		{name: "inside the right region", x: 40, y: 20, want: "pods.table", hit: true},
		{name: "on the boundary belongs to the right", x: 28, y: 5, want: "pods.table", hit: true},
		{name: "in the top bar", x: 3, y: 0},
		{name: "outside the terminal", x: 500, y: 500},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, ok := f.HitTest(tt.x, tt.y)
			if ok != tt.hit {
				t.Fatalf("HitTest(%d, %d) hit = %v, want %v", tt.x, tt.y, ok, tt.hit)
			}
			if got != tt.want {
				t.Errorf("HitTest(%d, %d) = %q, want %q", tt.x, tt.y, got, tt.want)
			}
		})
	}

	if r, ok := f.Region("pods.table"); !ok || r != right {
		t.Errorf("Region(pods.table) = %+v, %v; want %+v, true", r, ok, right)
	}
	if _, ok := f.Region("nope"); ok {
		t.Error("Region of an unregistered id must report false")
	}
}

func TestFrameRegionsLastRegistrationWins(t *testing.T) {
	f := Frame{}.
		WithRegion("under", kernel.Rect{X: 0, Y: 0, Width: 10, Height: 10}).
		WithRegion("over", kernel.Rect{X: 2, Y: 2, Width: 4, Height: 4})

	if got, _ := f.HitTest(3, 3); got != "over" {
		t.Errorf("HitTest inside the overlay = %q, want \"over\"", got)
	}
	if got, _ := f.HitTest(8, 8); got != "under" {
		t.Errorf("HitTest outside the overlay = %q, want \"under\"", got)
	}
}

func TestWithRegionDoesNotMutateTheReceiver(t *testing.T) {
	base := Frame{}.WithRegion("a", kernel.Rect{X: 0, Y: 0, Width: 4, Height: 4})

	left := base.WithRegion("b", kernel.Rect{X: 4, Y: 0, Width: 4, Height: 4})
	right := base.WithRegion("c", kernel.Rect{X: 4, Y: 0, Width: 4, Height: 4})

	if _, ok := base.Region("b"); ok {
		t.Error("the receiver must not see regions added to a derived frame")
	}
	if got, _ := left.HitTest(5, 1); got != "b" {
		t.Errorf("left branch resolved to %q, want \"b\"", got)
	}
	if got, _ := right.HitTest(5, 1); got != "c" {
		t.Errorf("right branch resolved to %q, want \"c\"", got)
	}
}
