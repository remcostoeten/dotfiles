package ui

import (
	"strings"

	"pc/internal/tui/core/render"
)

// Tabs is a strip of labels with one selected. It is a widget, not navigation:
// its selected index belongs to whichever view owns it, and it has no idea the
// router exists.
type Tabs struct {
	Items     []string
	Active    int
	Underline bool
}

// Render draws the strip on one line, clipped to the context's width.
func (t Tabs) Render(rc render.Context) string {
	if len(t.Items) == 0 {
		return ""
	}
	st := rc.Styles()

	parts := make([]string, 0, len(t.Items))
	for i, item := range t.Items {
		if i == t.Active {
			parts = append(parts, st.TabActive.Render(" "+item+" "))
			continue
		}
		parts = append(parts, st.TabInactive.Render(" "+item+" "))
	}
	strip := strings.Join(parts, " ")
	if !t.Underline {
		return render.Truncate(strip, rc.Rect.Width, rc.Glyphs.Ellipsis)
	}

	rule := t.underline(rc)
	return render.Truncate(strip, rc.Rect.Width, rc.Glyphs.Ellipsis) + "\n" +
		render.Truncate(rule, rc.Rect.Width, "")
}

// underline draws a rule under the active tab only, which is how the active
// section stays identifiable when the selection colour is unavailable.
func (t Tabs) underline(rc render.Context) string {
	st := rc.Styles()
	var b strings.Builder
	for i, item := range t.Items {
		if i > 0 {
			b.WriteString(" ")
		}
		width := render.Width(item) + 2
		if i == t.Active {
			b.WriteString(st.Accent.Render(strings.Repeat(rc.Theme.Chrome.BorderFocus.Top, width)))
			continue
		}
		b.WriteString(strings.Repeat(" ", width))
	}
	return b.String()
}
