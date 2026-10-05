package ui

import (
	"strings"

	"pc/internal/tui/core/render"
)

const scrollTrack = 3

// ScrollPos describes how much of a scrollable body is on screen. Widgets that
// scroll report one so that Panel can draw the indicator in its bottom border.
type ScrollPos struct {
	Offset  int
	Visible int
	Total   int
}

// HasScroll reports whether there is anything off screen.
func (s ScrollPos) HasScroll() bool {
	return s.Total > s.Visible && s.Visible > 0
}

// MaxOffset is the largest offset that still fills the viewport.
func (s ScrollPos) MaxOffset() int {
	if !s.HasScroll() {
		return 0
	}
	return s.Total - s.Visible
}

// Indicator is a compact scroll position for a panel border, e.g. "[= ]".
// It is empty when everything fits.
func (s ScrollPos) Indicator() string {
	if !s.HasScroll() {
		return ""
	}
	thumb := 0
	if maxOffset := s.MaxOffset(); maxOffset > 0 {
		thumb = s.Offset * (scrollTrack - 1) / maxOffset
	}
	thumb = min(max(thumb, 0), scrollTrack-1)

	var b strings.Builder
	b.WriteString("[")
	for i := range scrollTrack {
		if i == thumb {
			b.WriteString("=")
			continue
		}
		b.WriteString(" ")
	}
	b.WriteString("]")
	return b.String()
}

// Scrollbar is a vertical scroll indicator drawn beside a scrolling body.
type Scrollbar struct {
	Pos ScrollPos
}

// Render draws one column, as tall as the context's rectangle.
func (s Scrollbar) Render(rc render.Context) string {
	height := rc.Rect.Height
	if height <= 0 {
		return ""
	}
	st := rc.Styles()
	if !s.Pos.HasScroll() {
		return strings.TrimRight(strings.Repeat(" \n", height), "\n")
	}

	thumbSize := max(1, s.Pos.Visible*height/s.Pos.Total)
	travel := height - thumbSize
	thumbTop := 0
	if maxOffset := s.Pos.MaxOffset(); maxOffset > 0 && travel > 0 {
		thumbTop = s.Pos.Offset * travel / maxOffset
	}

	rows := make([]string, height)
	for i := range rows {
		if i >= thumbTop && i < thumbTop+thumbSize {
			rows[i] = st.ScrollbarThumb.Render(rc.Glyphs.Bar[len(rc.Glyphs.Bar)-1])
			continue
		}
		rows[i] = st.Scrollbar.Render(rc.Glyphs.Bar[0])
	}
	return strings.Join(rows, "\n")
}

// Window clamps an offset so that a cursor stays visible in a viewport of the
// given height, returning the offset to render from.
func Window(offset, cursor, visible, total int) int {
	if visible <= 0 || total <= 0 {
		return 0
	}
	if cursor < offset {
		offset = cursor
	}
	if cursor >= offset+visible {
		offset = cursor - visible + 1
	}
	if maxOffset := max(0, total-visible); offset > maxOffset {
		offset = maxOffset
	}
	return max(0, offset)
}
