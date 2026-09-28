package ui

import (
	"strings"

	"pc/internal/tui/core/render"
)

// StatusBar is the generated bottom line: hints on the left, status segments
// on the right, and one pinned hint that survives truncation so the escape
// hatch is never the thing that gets cut.
type StatusBar struct {
	Hints  []Hint
	Items  []string
	Pinned Hint
}

// Render draws one line exactly as wide as the context's rectangle.
func (s StatusBar) Render(rc render.Context) string {
	width := rc.Rect.Width
	if width <= 0 {
		return ""
	}
	st := rc.Styles()

	right := s.renderRight(rc)
	rightWidth := render.Width(right)
	if rightWidth >= width {
		return render.Fit(right, width, render.Right, rc.Glyphs.Ellipsis)
	}

	left := " " + RenderHints(rc, s.Hints)
	available := width - rightWidth
	if render.Width(left) > available {
		left = render.Truncate(left, available, st.StatusBar.Render(rc.Glyphs.Ellipsis))
	}

	gap := max(0, width-render.Width(left)-rightWidth)
	return left + strings.Repeat(" ", gap) + right
}

func (s StatusBar) renderRight(rc render.Context) string {
	parts := make([]string, 0, len(s.Items)+1)
	for _, item := range s.Items {
		if item != "" {
			parts = append(parts, item)
		}
	}
	if pinned := (KeyHint{Hint: s.Pinned}).Render(rc); pinned != "" {
		parts = append(parts, pinned)
	}
	if len(parts) == 0 {
		return ""
	}
	return strings.Join(parts, "   ") + " "
}
