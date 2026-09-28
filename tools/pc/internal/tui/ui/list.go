package ui

import (
	"strings"

	tea "charm.land/bubbletea/v2"

	"pc/internal/tui/core/render"
	"pc/internal/tui/kernel"
)

// ListItem is one row of a List.
type ListItem struct {
	ID       kernel.ID
	Title    string
	Detail   string
	Severity Severity
	Disabled bool
}

// List is a single-column selectable list. Height is set by whoever lays it
// out, so that Update can scroll without needing render-time geometry.
type List struct {
	Items   []ListItem
	Focused bool
	Height  int

	cursor int
	offset int
}

// NewList builds a list from items.
func NewList(items ...ListItem) List {
	return List{Items: items}
}

// SetItems replaces the contents, clamping the cursor into the new range.
func (l List) SetItems(items []ListItem) List {
	l.Items = items
	l.cursor = min(max(l.cursor, 0), max(0, len(items)-1))
	l.offset = Window(l.offset, l.cursor, l.Height, len(items))
	return l
}

// SetHeight tells the list how many rows it will be rendered into.
func (l List) SetHeight(h int) List {
	l.Height = max(0, h)
	l.offset = Window(l.offset, l.cursor, l.Height, len(l.Items))
	return l
}

// Cursor is the index of the highlighted item.
func (l List) Cursor() int {
	return l.cursor
}

// Selected returns the highlighted item.
func (l List) Selected() (ListItem, bool) {
	if l.cursor < 0 || l.cursor >= len(l.Items) {
		return ListItem{}, false
	}
	return l.Items[l.cursor], true
}

// ScrollPos describes how much of the list is on screen.
func (l List) ScrollPos() ScrollPos {
	return ScrollPos{Offset: l.offset, Visible: l.Height, Total: len(l.Items)}
}

// Update handles cursor movement. Keys it does not recognise are left alone.
func (l List) Update(msg tea.Msg) (List, tea.Cmd) {
	if !l.Focused {
		return l, nil
	}
	move := DecodeMove(msg)
	if move == MoveNone {
		return l, nil
	}
	l.cursor = move.apply(l.cursor, len(l.Items), l.Height)
	l.offset = Window(l.offset, l.cursor, l.Height, len(l.Items))
	return l, nil
}

// Render draws the visible window of the list.
func (l List) Render(rc render.Context) string {
	size := rc.Size()
	if size.IsZero() {
		return ""
	}
	if len(l.Items) == 0 {
		return EmptyState{Title: "Nothing here yet"}.Render(rc)
	}

	st := rc.Styles()
	height := min(size.Height, len(l.Items)-l.offset)
	rows := make([]string, 0, size.Height)

	for i := range height {
		index := l.offset + i
		item := l.Items[index]

		marker := "  "
		style := st.Base
		switch {
		case item.Disabled:
			style = st.Subtle
		case index == l.cursor && l.Focused:
			marker = rc.Glyphs.Chevron + " "
			style = st.Selection
		case index == l.cursor:
			marker = rc.Glyphs.Chevron + " "
			style = st.SelectionDim
		case item.Severity != SeverityInfo:
			style = item.Severity.style(rc)
		}

		body := marker + item.Title
		if item.Detail != "" {
			gap := size.Width - render.Width(body) - render.Width(item.Detail) - 1
			if gap > 0 {
				body += strings.Repeat(" ", gap+1) + item.Detail
			}
		}
		rows = append(rows, style.Render(render.Fit(body, size.Width, render.Left, rc.Glyphs.Ellipsis)))
	}
	return render.Clip(strings.Join(rows, "\n"), size)
}
