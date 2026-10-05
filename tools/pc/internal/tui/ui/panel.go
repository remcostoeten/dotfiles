package ui

import (
	"strings"

	lipgloss "charm.land/lipgloss/v2"

	"pc/internal/tui/core/render"
	"pc/internal/tui/kernel"
)

// Panel is the visual atom: a bordered region with its title inset into the
// top border, optional hints and a scroll indicator inset into the bottom one.
// Almost everything on screen is a Panel wrapping something else.
type Panel struct {
	Title    string
	Subtitle string
	Focused  bool
	Footer   []Hint
	Scroll   ScrollPos
	Content  string
}

// Render draws the panel into the context's rectangle. Focus changes the
// border weight, the border colour and the title weight together, so the state
// survives a monochrome terminal.
func (p Panel) Render(rc render.Context) string {
	area := rc.Rect
	if area.Width < 2 || area.Height < 2 {
		return render.Clip(p.Content, area.Size())
	}

	st := rc.Styles()
	chrome := rc.Theme.Chrome
	border := chrome.Border
	line := st.PanelBorder
	title := st.PanelTitle
	if p.Focused {
		border = chrome.BorderFocus
		line = st.PanelBorderFocused
		title = st.PanelTitleFocused
	}

	inner := area.Width - 2
	top := borderRow(line, border.TopLeft, border.Top, border.TopRight, inner,
		label(title, p.Title),
		label(st.PanelSubtitle, p.Subtitle),
	)
	bottom := borderRow(line, border.BottomLeft, border.Bottom, border.BottomRight, inner,
		spaced(RenderHints(rc, p.Footer)),
		label(st.PanelSubtitle, p.Scroll.Indicator()),
	)

	pad := chrome.Density.Pad()
	body := area.Inset(1)
	contentWidth := max(0, body.Width-2*pad)
	gutter := strings.Repeat(" ", pad)

	rows := make([]string, 0, body.Height+2)
	rows = append(rows, top)
	content := render.Clip(p.Content, kernel.Size{Width: contentWidth, Height: body.Height})
	for _, l := range render.Lines(content) {
		rows = append(rows, line.Render(border.Left)+gutter+l+gutter+line.Render(border.Right))
	}
	rows = append(rows, bottom)
	return strings.Join(rows, "\n")
}

// segment is a pre-styled run of cells destined for a border row.
type segment string

// spaced surrounds already-styled content with one cell of breathing room.
func spaced(content string) segment {
	if content == "" {
		return ""
	}
	return segment(" " + content + " ")
}

func label(style lipgloss.Style, text string) segment {
	if text == "" {
		return ""
	}
	return spaced(style.Render(text))
}

// borderRow draws one horizontal border, inlaying a left and a right segment
// into the run of border runes. The right segment is dropped before the left
// one is truncated, because a title identifies a panel and a count decorates it.
func borderRow(style lipgloss.Style, corner, fill, endCorner string, inner int, left, right segment) string {
	leftWidth := render.Width(string(left))
	rightWidth := render.Width(string(right))

	if leftWidth+rightWidth > inner {
		right, rightWidth = "", 0
	}
	if leftWidth > inner {
		left = segment(render.Truncate(string(left), inner, ""))
		leftWidth = render.Width(string(left))
	}

	gap := max(0, inner-leftWidth-rightWidth)
	return style.Render(corner) +
		string(left) +
		style.Render(strings.Repeat(fill, gap)) +
		string(right) +
		style.Render(endCorner)
}
