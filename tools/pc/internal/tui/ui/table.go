package ui

import (
	"strings"

	tea "charm.land/bubbletea/v2"

	"pc/internal/tui/core/render"
	"pc/internal/tui/layout"
)

// Column describes one column of a Table. The width is a layout constraint, so
// column sizing is the same pure rect maths the frame uses.
type Column struct {
	Title string
	Width layout.Constraint
	Align render.Align
}

// Table is a selectable grid with a header row.
type Table struct {
	Columns []Column
	Rows    [][]string
	Focused bool
	Height  int

	cursor int
	offset int
}

// NewTable builds a table.
func NewTable(columns []Column, rows [][]string) Table {
	return Table{Columns: columns, Rows: rows}
}

// SetRows replaces the body, clamping the cursor into the new range.
func (t Table) SetRows(rows [][]string) Table {
	t.Rows = rows
	t.cursor = min(max(t.cursor, 0), max(0, len(rows)-1))
	t.offset = Window(t.offset, t.cursor, t.bodyHeight(), len(rows))
	return t
}

// SetHeight tells the table how many rows, header included, it will occupy.
func (t Table) SetHeight(h int) Table {
	t.Height = max(0, h)
	t.offset = Window(t.offset, t.cursor, t.bodyHeight(), len(t.Rows))
	return t
}

// Cursor is the index of the highlighted row.
func (t Table) Cursor() int {
	return t.cursor
}

// Selected returns the highlighted row.
func (t Table) Selected() ([]string, bool) {
	if t.cursor < 0 || t.cursor >= len(t.Rows) {
		return nil, false
	}
	return t.Rows[t.cursor], true
}

// ScrollPos describes how much of the body is on screen.
func (t Table) ScrollPos() ScrollPos {
	return ScrollPos{Offset: t.offset, Visible: t.bodyHeight(), Total: len(t.Rows)}
}

func (t Table) bodyHeight() int {
	return max(0, t.Height-1)
}

// Update handles cursor movement.
func (t Table) Update(msg tea.Msg) (Table, tea.Cmd) {
	if !t.Focused {
		return t, nil
	}
	move := DecodeMove(msg)
	if move == MoveNone {
		return t, nil
	}
	t.cursor = move.apply(t.cursor, len(t.Rows), t.bodyHeight())
	t.offset = Window(t.offset, t.cursor, t.bodyHeight(), len(t.Rows))
	return t, nil
}

// Render draws the header and the visible window of rows.
func (t Table) Render(rc render.Context) string {
	size := rc.Size()
	if size.IsZero() || len(t.Columns) == 0 {
		return ""
	}
	st := rc.Styles()
	widths := t.columnWidths(size.Width)

	lines := make([]string, 0, size.Height)
	lines = append(lines, st.PanelSubtitle.Render(t.headerRow(rc, widths)))

	if len(t.Rows) == 0 {
		body := EmptyState{Title: "No rows"}.Render(rc.For(rc.Rect.InsetXY(0, 1)))
		return render.Clip(render.Join(lines[0], body), size)
	}

	visible := min(t.bodyHeight(), len(t.Rows)-t.offset)
	for i := range visible {
		index := t.offset + i
		style := st.Base
		if index == t.cursor {
			style = st.SelectionDim
			if t.Focused {
				style = st.Selection
			}
		}
		lines = append(lines, style.Render(t.bodyRow(rc, t.Rows[index], widths)))
	}
	return render.Clip(strings.Join(lines, "\n"), size)
}

// columnWidths reserves one cell of gutter between columns before solving.
func (t Table) columnWidths(total int) []int {
	constraints := make([]layout.Constraint, len(t.Columns))
	for i, c := range t.Columns {
		constraints[i] = c.Width
	}
	gutters := max(0, len(t.Columns)-1)
	return layout.Sizes(max(0, total-gutters), constraints...)
}

func (t Table) headerRow(rc render.Context, widths []int) string {
	cells := make([]string, len(t.Columns))
	for i, c := range t.Columns {
		cells[i] = render.Fit(c.Title, widths[i], c.Align, rc.Glyphs.Ellipsis)
	}
	return strings.Join(cells, " ")
}

func (t Table) bodyRow(rc render.Context, row []string, widths []int) string {
	cells := make([]string, len(t.Columns))
	for i, c := range t.Columns {
		value := ""
		if i < len(row) {
			value = row[i]
		}
		cells[i] = render.Fit(value, widths[i], c.Align, rc.Glyphs.Ellipsis)
	}
	return strings.Join(cells, " ")
}
