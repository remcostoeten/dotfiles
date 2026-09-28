// Package render owns every width-aware string operation in the codebase.
// Nothing outside it may call len() on a string that will be displayed: escape
// sequences occupy no cells and wide runes occupy two, so byte length is never
// display width.
package render

import (
	"strings"

	"github.com/charmbracelet/x/ansi"

	"pc/internal/tui/kernel"
)

// Align is the horizontal placement of text inside a fixed width.
type Align uint8

const (
	// Left pads on the right.
	Left Align = iota
	// Center splits the padding, biasing the extra cell to the right.
	Center
	// Right pads on the left.
	Right
)

// Width is the display width of a string in terminal cells, ignoring escape
// sequences and counting wide runes as two.
func Width(s string) int {
	return ansi.StringWidth(s)
}

// Lines splits a rendered string into its display lines.
func Lines(s string) []string {
	if s == "" {
		return nil
	}
	return strings.Split(s, "\n")
}

// Truncate clips a single line to width, appending tail when it had to cut.
func Truncate(s string, width int, tail string) string {
	if width <= 0 {
		return ""
	}
	return ansi.Truncate(s, width, tail)
}

// Pad extends a single line to exactly width, aligning the existing content.
// A line already at or over width is returned unchanged.
func Pad(s string, width int, align Align) string {
	gap := width - Width(s)
	if gap <= 0 {
		return s
	}
	switch align {
	case Right:
		return strings.Repeat(" ", gap) + s
	case Center:
		left := gap / 2
		return strings.Repeat(" ", left) + s + strings.Repeat(" ", gap-left)
	default:
		return s + strings.Repeat(" ", gap)
	}
}

// Fit forces a single line to exactly width, truncating or padding as needed.
func Fit(s string, width int, align Align, tail string) string {
	if width <= 0 {
		return ""
	}
	return Pad(Truncate(s, width, tail), width, align)
}

// Wrap breaks a paragraph on word boundaries at width, falling back to hard
// breaks for words that do not fit.
func Wrap(s string, width int) string {
	if width <= 0 {
		return ""
	}
	return ansi.Wrap(s, width, "")
}

// Blank is a rectangle of spaces.
func Blank(size kernel.Size) string {
	if size.IsZero() {
		return ""
	}
	line := strings.Repeat(" ", size.Width)
	rows := make([]string, size.Height)
	for i := range rows {
		rows[i] = line
	}
	return strings.Join(rows, "\n")
}

// Clip forces a block of text to exactly size, truncating long lines, padding
// short ones and adding or dropping rows. Every widget's output passes through
// it before composition, which is what keeps the frame from tearing.
func Clip(s string, size kernel.Size) string {
	if size.IsZero() {
		return ""
	}

	lines := Lines(s)
	rows := make([]string, size.Height)
	for i := range rows {
		if i < len(lines) {
			rows[i] = Fit(lines[i], size.Width, Left, "")
			continue
		}
		rows[i] = strings.Repeat(" ", size.Width)
	}
	return strings.Join(rows, "\n")
}

// Join stacks blocks vertically without any positioning.
func Join(blocks ...string) string {
	parts := make([]string, 0, len(blocks))
	for _, b := range blocks {
		if b == "" {
			continue
		}
		parts = append(parts, b)
	}
	return strings.Join(parts, "\n")
}
