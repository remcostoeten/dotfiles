// Package widgets holds the pc-specific widgets built on the ui layer: meters
// and label/value rows. Like ui, they take props and a render context.
package widgets

import (
	"strconv"
	"strings"

	lipgloss "charm.land/lipgloss/v2"

	"pc/internal/tui/core/render"
	"pc/internal/tui/kernel"
	"pc/internal/tui/layout"
	"pc/internal/tui/ui"
)

const (
	labelWidth   = 7
	percentWidth = 5
	textWidth    = 18
	sparkWidth   = 24
	minBarWidth  = 8
	sparkBarMin  = 16
)

// Gauge is a one-line meter: label, bar, percentage, value text and, with
// Spark set, a history sparkline. Spark reserves the column even without
// history, so the bars of stacked gauges stay aligned.
type Gauge struct {
	Label      string
	LabelWidth int
	Value      int
	Max        int
	Text       string
	TextWidth  int
	NoPercent  bool
	Severity   ui.Severity
	Spark      bool
	History    []float64
}

// Render draws the gauge across the context's width, shrinking the sparkline
// and then dropping the text when space runs out.
func (g Gauge) Render(rc render.Context) string {
	width := rc.Rect.Width
	if width <= 0 {
		return ""
	}
	st := rc.Styles()
	tone := Tone(rc, g.Severity)

	label := g.LabelWidth
	if label == 0 {
		label = labelWidth
	}
	percent := percentWidth
	if g.NoPercent {
		percent = 0
	}
	text := g.TextWidth
	if text == 0 {
		text = textWidth
	}
	if width < label+percent+text+minBarWidth+3 {
		text = 0
	}
	spark := min(sparkWidth, width-label-percent-text-sparkBarMin-4)
	if !g.Spark || spark < minBarWidth {
		spark = 0
	}
	gutters := 1
	for _, w := range []int{percent, text, spark} {
		if w > 0 {
			gutters++
		}
	}
	sizes := layout.Sizes(width-gutters, layout.Fixed(label), layout.Flex(1), layout.Fixed(percent), layout.Fixed(text), layout.Fixed(spark))

	parts := []string{
		st.Muted.Render(render.Fit(g.Label, sizes[0], render.Left, rc.Glyphs.Ellipsis)),
		Bar(rc, Percent(g.Value, g.Max), sizes[1], tone),
	}
	if percent > 0 {
		parts = append(parts, tone.Render(render.Fit(strconv.Itoa(Percent(g.Value, g.Max))+"%", sizes[2], render.Right, "")))
	}
	if text > 0 {
		textStyle := st.Base
		if g.NoPercent {
			textStyle = tone
		}
		parts = append(parts, textStyle.Render(render.Fit(g.Text, sizes[3], render.Left, rc.Glyphs.Ellipsis)))
	}
	if spark > 0 {
		parts = append(parts, render.Fit(ui.Sparkline{Values: g.History}.Render(rc.For(kernel.Rect{Width: sizes[4], Height: 1})), sizes[4], render.Right, ""))
	}
	return render.Fit(strings.Join(parts, " "), width, render.Left, "")
}

// Bar draws a filled meter of width cells, using the theme's heaviest bar glyph
// and its border rule so the ascii theme degrades with it.
func Bar(rc render.Context, percent, width int, tone lipgloss.Style) string {
	if width <= 0 {
		return ""
	}
	filled := min(max(percent, 0), 100) * width / 100
	if filled == 0 && percent > 0 {
		filled = 1
	}
	full := "#"
	if n := len(rc.Glyphs.Bar); n > 0 {
		full = rc.Glyphs.Bar[n-1]
	}
	return tone.Render(strings.Repeat(full, filled)) +
		rc.Styles().Subtle.Render(strings.Repeat(rc.Theme.Chrome.Border.Top, width-filled))
}

// PlainBar is Bar without styling, for table cells whose row style must not be
// interrupted by inner escape sequences.
func PlainBar(rc render.Context, percent, width int) string {
	filled := min(max(percent, 0), 100) * width / 100
	full := "#"
	if n := len(rc.Glyphs.Bar); n > 0 {
		full = rc.Glyphs.Bar[n-1]
	}
	return strings.Repeat(full, filled) + strings.Repeat(rc.Theme.Chrome.Border.Top, width-filled)
}

// Field is one label/value row.
type Field struct {
	Label    string
	Value    string
	Severity ui.Severity
}

// Fields draws label/value rows, one per line, with the labels aligned.
type Fields []Field

// Render draws the rows into the context's rectangle.
func (f Fields) Render(rc render.Context) string {
	width := 0
	for _, field := range f {
		width = max(width, render.Width(field.Label))
	}
	st := rc.Styles()
	lines := make([]string, len(f))
	for i, field := range f {
		value := st.Base.Render(field.Value)
		if field.Severity != ui.SeverityInfo {
			value = Tone(rc, field.Severity).Render(field.Value)
		}
		lines[i] = st.Muted.Render(render.Fit(field.Label, width, render.Left, "")) + "  " + value
	}
	return render.Clip(strings.Join(lines, "\n"), rc.Size())
}

// Keys draws a column of key hints, one per line.
func Keys(rc render.Context, hints []ui.Hint) string {
	width := 0
	for _, h := range hints {
		width = max(width, render.Width(h.Key))
	}
	st := rc.Styles()
	lines := make([]string, len(hints))
	for i, h := range hints {
		lines[i] = st.KeyHintKey.Render(render.Fit(h.Key, width, render.Left, "")) + "  " + st.KeyHintLabel.Render(h.Label)
	}
	return strings.Join(lines, "\n")
}

// Tone is the style a severity is drawn in, with Info meaning the accent.
func Tone(rc render.Context, s ui.Severity) lipgloss.Style {
	st := rc.Styles()
	switch s {
	case ui.SeveritySuccess:
		return st.Success
	case ui.SeverityWarning:
		return st.Warning
	case ui.SeverityDanger:
		return st.Danger
	default:
		return st.Accent
	}
}

// Heat grades a reading against warn and hot thresholds.
func Heat(value, warn, hot int) ui.Severity {
	switch {
	case value >= hot:
		return ui.SeverityDanger
	case value >= warn:
		return ui.SeverityWarning
	default:
		return ui.SeveritySuccess
	}
}

// Percent is value as a share of max, clamped to 0–100.
func Percent(value, max int) int {
	if max <= 0 {
		return 0
	}
	return min(value*100/max, 100)
}

// Push appends to a bounded history.
func Push(history []float64, v int, limit int) []float64 {
	history = append(history, float64(v))
	if len(history) > limit {
		history = history[len(history)-limit:]
	}
	return history
}
