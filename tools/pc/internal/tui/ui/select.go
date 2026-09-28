package ui

import (
	"strings"

	tea "charm.land/bubbletea/v2"

	"pc/internal/tui/core/render"
)

// Select is a labelled choice among options. Closed it shows the current
// value; open it shows the options inline, which avoids needing an overlay for
// something this small.
type Select struct {
	Label   string
	Options []string
	Focused bool

	index int
	open  bool
}

// NewSelect builds a select on its first option.
func NewSelect(label string, options ...string) Select {
	return Select{Label: label, Options: options}
}

// Value is the selected option.
func (s Select) Value() string {
	if s.index < 0 || s.index >= len(s.Options) {
		return ""
	}
	return s.Options[s.index]
}

// Index is the selected position.
func (s Select) Index() int {
	return s.index
}

// SetIndex selects a position, clamped into range.
func (s Select) SetIndex(i int) Select {
	s.index = min(max(i, 0), max(0, len(s.Options)-1))
	return s
}

// IsOpen reports whether the options are showing.
func (s Select) IsOpen() bool {
	return s.open
}

// Height is how many rows the select needs at its current state.
func (s Select) Height() int {
	if !s.open {
		return 1
	}
	return 1 + len(s.Options)
}

// Update opens, closes and moves the selection.
func (s Select) Update(msg tea.Msg) (Select, tea.Cmd) {
	if !s.Focused {
		return s, nil
	}
	key, ok := msg.(tea.KeyMsg)
	if !ok {
		return s, nil
	}

	switch key.String() {
	case "enter", "space":
		s.open = !s.open
		return s, nil
	case "esc":
		s.open = false
		return s, nil
	case "left", "h":
		s.index = max(0, s.index-1)
		return s, nil
	case "right", "l":
		s.index = min(max(0, len(s.Options)-1), s.index+1)
		return s, nil
	}

	if !s.open {
		return s, nil
	}
	if move := DecodeMove(msg); move != MoveNone {
		s.index = move.apply(s.index, len(s.Options), len(s.Options))
	}
	return s, nil
}

// Render draws the closed value, or the label plus the option list when open.
func (s Select) Render(rc render.Context) string {
	width := rc.Rect.Width
	if width <= 0 {
		return ""
	}
	st := rc.Styles()

	marker := rc.Glyphs.Chevron
	if s.open {
		marker = rc.Glyphs.Arrow
	}
	head := s.Label
	if head != "" {
		head += "  "
	}
	head += marker + " " + s.Value()

	headStyle := st.Base
	if s.Focused {
		headStyle = st.Accent
	}
	lines := []string{headStyle.Render(render.Fit(head, width, render.Left, rc.Glyphs.Ellipsis))}
	if !s.open {
		return lines[0]
	}

	for i, option := range s.Options {
		style := st.Muted
		prefix := "    "
		if i == s.index {
			style = st.Selection
			prefix = "  " + rc.Glyphs.Chevron + " "
		}
		lines = append(lines, style.Render(render.Fit(prefix+option, width, render.Left, rc.Glyphs.Ellipsis)))
	}
	return strings.Join(lines, "\n")
}
