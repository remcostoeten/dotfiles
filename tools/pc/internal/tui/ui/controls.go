package ui

import (
	"strings"

	"pc/internal/tui/core/render"
	"pc/internal/tui/kernel"
)

// Button carries a command identifier rather than a callback, so the mouse and
// the keyboard reach the same action through the same registry.
type Button struct {
	Label   string
	Command kernel.ID
	Focused bool
	Danger  bool
}

// Render draws the button inline.
func (b Button) Render(rc render.Context) string {
	st := rc.Styles()
	body := " " + b.Label + " "
	switch {
	case b.Focused:
		return st.ButtonFocused.Render(body)
	case b.Danger:
		return st.ButtonDanger.Render(body)
	default:
		return st.Button.Render(body)
	}
}

// Checkbox is a labelled boolean.
type Checkbox struct {
	Label   string
	Checked bool
	Focused bool
}

// Render draws the checkbox inline. The box contents differ as well as the
// colour, so the state reads in a monochrome terminal.
func (c Checkbox) Render(rc render.Context) string {
	st := rc.Styles()
	mark := " "
	style := st.Unchecked
	if c.Checked {
		mark = rc.Glyphs.Check
		style = st.Checked
	}
	body := "[" + mark + "] " + c.Label
	if c.Focused {
		return st.Selection.Render(body)
	}
	return style.Render(body)
}

// Modal is a bordered box drawn over the frame. Placement is the shell's job;
// the widget only draws into the rectangle it is given.
type Modal struct {
	Title   string
	Content string
	Footer  []Hint
}

// Render draws the modal into the context's rectangle.
func (m Modal) Render(rc render.Context) string {
	panel := Panel{
		Title:   m.Title,
		Focused: true,
		Footer:  m.Footer,
		Content: m.Content,
	}
	return panel.Render(rc)
}

// Size is a modal's preferred rectangle inside an area, capped so that it never
// covers the whole frame.
func (m Modal) Size(area kernel.Rect, width, height int) kernel.Rect {
	w := min(width, max(0, area.Width-4))
	h := min(height, max(0, area.Height-4))
	return area.Center(kernel.Size{Width: w, Height: h})
}

// Rule is a horizontal divider.
type Rule struct{}

// Render draws one line across the context's width.
func (Rule) Render(rc render.Context) string {
	if rc.Rect.Width <= 0 {
		return ""
	}
	return rc.Styles().PanelBorder.Render(strings.Repeat(rc.Theme.Chrome.Border.Top, rc.Rect.Width))
}
