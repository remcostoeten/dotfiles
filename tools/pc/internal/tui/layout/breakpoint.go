package layout

import "pc/internal/tui/kernel"

// Breakpoint is the responsive band a terminal size falls into.
type Breakpoint uint8

const (
	// Compact is a single pane; panels become tabs.
	Compact Breakpoint = iota
	// Normal shows a collapsed sidebar beside the workspace.
	Normal
	// Wide shows the sidebar, the workspace and a detail pane.
	Wide
)

const (
	normalWidth = 80
	wideWidth   = 120
)

// MinSize is the smallest terminal the shell will render into. Below it the
// runtime draws a single "terminal too small" panel instead of a broken frame.
var MinSize = kernel.Size{Width: 40, Height: 10}

// BreakpointFor classifies a terminal size.
func BreakpointFor(s kernel.Size) Breakpoint {
	switch {
	case s.Width >= wideWidth:
		return Wide
	case s.Width >= normalWidth:
		return Normal
	default:
		return Compact
	}
}

// TooSmall reports whether the terminal is below MinSize in either axis.
func TooSmall(s kernel.Size) bool {
	return !s.Fits(MinSize)
}

func (b Breakpoint) String() string {
	switch b {
	case Wide:
		return "wide"
	case Normal:
		return "normal"
	default:
		return "compact"
	}
}
