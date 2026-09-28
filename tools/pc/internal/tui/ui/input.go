package ui

import (
	"strings"

	tea "charm.land/bubbletea/v2"

	"pc/internal/tui/core/render"
)

// Input is a single-line text field. While it is focused the shell puts the
// keymap into its capture layer, so the field sees raw keys and only esc
// escapes it.
type Input struct {
	Placeholder string
	Focused     bool

	runes  []rune
	cursor int
}

// NewInput builds an empty field.
func NewInput(placeholder string) Input {
	return Input{Placeholder: placeholder}
}

// Value is the current text.
func (i Input) Value() string {
	return string(i.runes)
}

// SetValue replaces the text and puts the cursor at the end.
func (i Input) SetValue(s string) Input {
	i.runes = []rune(s)
	i.cursor = len(i.runes)
	return i
}

// Clear empties the field.
func (i Input) Clear() Input {
	return i.SetValue("")
}

// Update applies an editing key. Keys it does not handle are left alone so the
// caller can act on enter and esc.
func (i Input) Update(msg tea.Msg) (Input, tea.Cmd) {
	key, ok := msg.(tea.KeyMsg)
	if !ok || !i.Focused {
		return i, nil
	}

	switch key.String() {
	case "left", "ctrl+b":
		i.cursor = max(0, i.cursor-1)
	case "right", "ctrl+f":
		i.cursor = min(len(i.runes), i.cursor+1)
	case "home", "ctrl+a":
		i.cursor = 0
	case "end", "ctrl+e":
		i.cursor = len(i.runes)
	case "backspace":
		if i.cursor > 0 {
			i.runes = deleteRuneAt(i.runes, i.cursor-1)
			i.cursor--
		}
	case "delete", "ctrl+d":
		if i.cursor < len(i.runes) {
			i.runes = deleteRuneAt(i.runes, i.cursor)
		}
	case "ctrl+u":
		i.runes = i.runes[i.cursor:]
		i.cursor = 0
	case "ctrl+k":
		i.runes = i.runes[:i.cursor]
	default:
		text := key.Key().Text
		if text == "" {
			return i, nil
		}
		next := make([]rune, 0, len(i.runes)+len([]rune(text)))
		next = append(next, i.runes[:i.cursor]...)
		next = append(next, []rune(text)...)
		next = append(next, i.runes[i.cursor:]...)
		i.runes = next
		i.cursor += len([]rune(text))
	}
	return i, nil
}

// Render draws the field on one line, scrolling horizontally to keep the
// cursor visible.
func (i Input) Render(rc render.Context) string {
	width := rc.Rect.Width
	if width <= 0 {
		return ""
	}
	st := rc.Styles()

	if !i.Focused {
		if len(i.runes) == 0 {
			return st.InputPlaceholder.Render(render.Fit(i.Placeholder, width, render.Left, rc.Glyphs.Ellipsis))
		}
		return st.InputText.Render(render.Fit(string(i.runes), width, render.Left, rc.Glyphs.Ellipsis))
	}

	// An empty focused field keeps its placeholder, with the cursor sitting on
	// the first cell of it: a blank line tells the user nothing about what to
	// type here.
	if len(i.runes) == 0 {
		hint := []rune(i.Placeholder)
		if len(hint) == 0 {
			return st.InputCursor.Render(" ") + strings.Repeat(" ", max(0, width-1))
		}
		body := st.InputCursor.Render(string(hint[0])) +
			st.InputPlaceholder.Render(render.Truncate(string(hint[1:]), max(0, width-1), rc.Glyphs.Ellipsis))
		return render.Pad(body, width, render.Left)
	}

	before := string(i.runes[:i.cursor])
	under := " "
	after := ""
	if i.cursor < len(i.runes) {
		under = string(i.runes[i.cursor])
		after = string(i.runes[i.cursor+1:])
	}

	body := st.InputText.Render(before) + st.InputCursor.Render(under) + st.InputText.Render(after)
	if render.Width(body) <= width {
		return body + strings.Repeat(" ", width-render.Width(body))
	}
	return render.Truncate(body, width, "")
}

// deleteRuneAt copies rather than shifting in place, because an Input value
// may already have been copied by Bubble Tea and must not share a mutated array.
func deleteRuneAt(rs []rune, at int) []rune {
	out := make([]rune, 0, len(rs)-1)
	out = append(out, rs[:at]...)
	return append(out, rs[at+1:]...)
}
