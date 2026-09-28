package layout

import "pc/internal/tui/kernel"

// Options tunes the shell chrome that Solve lays out.
type Options struct {
	TopBarHeight          int
	StatusBarHeight       int
	SidebarWidth          int
	SidebarCollapsedWidth int
	ShowSidebar           bool
}

// DefaultOptions is the chrome the demo shell ships with.
func DefaultOptions() Options {
	return Options{
		TopBarHeight:          1,
		StatusBarHeight:       1,
		SidebarWidth:          28,
		SidebarCollapsedWidth: 5,
		ShowSidebar:           true,
	}
}

func (o Options) sidebarWidth(b Breakpoint) int {
	switch b {
	case Wide:
		return o.SidebarWidth
	case Normal:
		return o.SidebarCollapsedWidth
	default:
		return 0
	}
}

type region struct {
	id   kernel.ID
	rect kernel.Rect
}

// Frame is the solved geometry for one terminal size. It is recomputed on
// resize and navigation, stored on the model, and read — never derived — during
// rendering and mouse hit-testing.
type Frame struct {
	Size       kernel.Size
	Breakpoint Breakpoint
	TooSmall   bool

	TopBar    kernel.Rect
	Sidebar   kernel.Rect
	Workspace kernel.Rect
	StatusBar kernel.Rect

	regions []region
}

// Solve computes the chrome rectangles for a terminal size.
func Solve(size kernel.Size, o Options) Frame {
	f := Frame{
		Size:       size,
		Breakpoint: BreakpointFor(size),
		TooSmall:   TooSmall(size),
	}
	if size.IsZero() {
		return f
	}

	full := size.Rect()
	if f.TooSmall {
		f.Workspace = full
		return f
	}

	rows := Rows(full, Fixed(o.TopBarHeight), Flex(1), Fixed(o.StatusBarHeight))
	f.TopBar = rows[0]
	f.StatusBar = rows[2]

	body := rows[1]
	width := o.sidebarWidth(f.Breakpoint)
	if !o.ShowSidebar || width <= 0 {
		f.Workspace = body
		return f
	}

	cols := Cols(body, Fixed(width), Flex(1))
	f.Sidebar = cols[0]
	f.Workspace = cols[1]
	return f
}

// WithRegion records a focusable region's rectangle for hit-testing and for
// positioning jump-mode badges. Later registrations of the same id win.
func (f Frame) WithRegion(id kernel.ID, r kernel.Rect) Frame {
	next := make([]region, len(f.regions), len(f.regions)+1)
	copy(next, f.regions)
	f.regions = append(next, region{id: id, rect: r})
	return f
}

// Region returns a previously recorded region rectangle.
func (f Frame) Region(id kernel.ID) (kernel.Rect, bool) {
	for i := len(f.regions) - 1; i >= 0; i-- {
		if f.regions[i].id == id {
			return f.regions[i].rect, true
		}
	}
	return kernel.Rect{}, false
}

// Regions lists the recorded regions in registration order.
func (f Frame) Regions() []kernel.ID {
	out := make([]kernel.ID, 0, len(f.regions))
	seen := make(map[kernel.ID]bool, len(f.regions))
	for _, r := range f.regions {
		if seen[r.id] {
			continue
		}
		seen[r.id] = true
		out = append(out, r.id)
	}
	return out
}

// HitTest resolves a cell to the topmost region containing it.
func (f Frame) HitTest(x, y int) (kernel.ID, bool) {
	for i := len(f.regions) - 1; i >= 0; i-- {
		if f.regions[i].rect.Contains(x, y) {
			return f.regions[i].id, true
		}
	}
	return "", false
}
