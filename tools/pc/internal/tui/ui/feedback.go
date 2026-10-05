package ui

import (
	"strings"

	lipgloss "charm.land/lipgloss/v2"

	"pc/internal/tui/core/render"
	"pc/internal/tui/kernel"
)

// Severity classifies a toast, a badge or an error panel.
type Severity uint8

const (
	// SeverityInfo is neutral information.
	SeverityInfo Severity = iota
	// SeveritySuccess is a completed action.
	SeveritySuccess
	// SeverityWarning is a recoverable problem.
	SeverityWarning
	// SeverityDanger is a failure.
	SeverityDanger
)

func (s Severity) style(rc render.Context) lipgloss.Style {
	st := rc.Styles()
	switch s {
	case SeveritySuccess:
		return st.ToastSuccess
	case SeverityWarning:
		return st.ToastWarning
	case SeverityDanger:
		return st.ToastDanger
	default:
		return st.ToastInfo
	}
}

func (s Severity) glyph(g kernel.GlyphSet) string {
	switch s {
	case SeveritySuccess:
		return g.Success
	case SeverityWarning:
		return g.Warning
	case SeverityDanger:
		return g.Error
	default:
		return g.Info
	}
}

// EmptyState is what a panel shows instead of a body when there is nothing to
// show. It always offers the user a next step.
type EmptyState struct {
	Title string
	Hint  string
}

// Render centres the message in the context's rectangle.
func (e EmptyState) Render(rc render.Context) string {
	st := rc.Styles()
	area := rc.Rect
	if area.IsEmpty() {
		return ""
	}

	lines := make([]string, 0, 3)
	if e.Title != "" {
		lines = append(lines, st.EmptyTitle.Render(e.Title))
	}
	if e.Hint != "" {
		if len(lines) > 0 {
			lines = append(lines, "")
		}
		lines = append(lines, st.EmptyHint.Render(e.Hint))
	}
	return centreBlock(lines, area.Size())
}

// ErrorState reports a failure and names the command that retries it, so the
// retry path is the same one the palette and the keymap use.
type ErrorState struct {
	Title  string
	Detail string
	Retry  Hint
}

// Render centres the failure in the context's rectangle.
func (e ErrorState) Render(rc render.Context) string {
	st := rc.Styles()
	area := rc.Rect
	if area.IsEmpty() {
		return ""
	}

	lines := []string{st.ErrorTitle.Render(rc.Glyphs.Error + " " + e.Title)}
	if e.Detail != "" {
		lines = append(lines, "", st.ErrorDetail.Render(render.Truncate(e.Detail, area.Width, rc.Glyphs.Ellipsis)))
	}
	if hint := (KeyHint{Hint: e.Retry}).Render(rc); hint != "" {
		lines = append(lines, "", hint)
	}
	return centreBlock(lines, area.Size())
}

// Spinner is a single frame of an activity indicator. The frame index is the
// caller's state, which keeps the widget pure.
type Spinner struct {
	Label string
	Frame int
}

// Render draws one line.
func (s Spinner) Render(rc render.Context) string {
	frames := rc.Glyphs.Spinner
	if len(frames) == 0 {
		return s.Label
	}
	st := rc.Styles()
	glyph := st.Spinner.Render(frames[((s.Frame%len(frames))+len(frames))%len(frames)])
	if s.Label == "" {
		return glyph
	}
	return glyph + " " + st.Muted.Render(s.Label)
}

// Badge is a small inline count or label.
type Badge struct {
	Text     string
	Severity Severity
	Accent   bool
}

// Render draws the badge inline.
func (b Badge) Render(rc render.Context) string {
	if b.Text == "" {
		return ""
	}
	st := rc.Styles()
	switch {
	case b.Severity != SeverityInfo:
		return b.Severity.style(rc).Render(b.Text)
	case b.Accent:
		return st.BadgeAccent.Render(b.Text)
	default:
		return st.Badge.Render(b.Text)
	}
}

// Toast is a transient notification. Its lifetime belongs to the shell; the
// widget only draws it.
type Toast struct {
	Severity Severity
	Text     string
}

// Render draws one line, clipped to the context's width.
func (t Toast) Render(rc render.Context) string {
	if t.Text == "" {
		return ""
	}
	body := t.Severity.glyph(rc.Glyphs) + " " + t.Text
	return t.Severity.style(rc).Render(render.Truncate(body, rc.Rect.Width, rc.Glyphs.Ellipsis))
}

// Sparkline plots a series into a single row of bar glyphs.
type Sparkline struct {
	Values []float64
}

// Render draws the most recent values that fit in the context's width.
func (s Sparkline) Render(rc render.Context) string {
	bars := rc.Glyphs.Bar
	width := rc.Rect.Width
	if len(bars) == 0 || width <= 0 || len(s.Values) == 0 {
		return ""
	}

	values := s.Values
	if len(values) > width {
		values = values[len(values)-width:]
	}

	low, high := values[0], values[0]
	for _, v := range values {
		low = min(low, v)
		high = max(high, v)
	}

	var b strings.Builder
	for _, v := range values {
		index := 0
		if high > low {
			index = int((v - low) / (high - low) * float64(len(bars)-1))
		}
		b.WriteString(bars[min(max(index, 0), len(bars)-1)])
	}
	return rc.Styles().Accent.Render(b.String())
}

// centreBlock centres pre-styled lines in both axes.
func centreBlock(lines []string, size kernel.Size) string {
	if size.IsZero() {
		return ""
	}
	rows := make([]string, 0, size.Height)
	top := max(0, (size.Height-len(lines))/2)
	for range top {
		rows = append(rows, strings.Repeat(" ", size.Width))
	}
	for _, l := range lines {
		rows = append(rows, render.Fit(l, size.Width, render.Center, ""))
	}
	return render.Clip(strings.Join(rows, "\n"), size)
}
