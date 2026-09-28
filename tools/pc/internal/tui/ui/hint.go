// Package ui holds the widget layer. Widgets take props and a render context
// and return a string; none of them imports navigation, focus, input, command
// or shell. A widget that needs to know it is focused takes a bool, not a
// focus state — that is what keeps this package liftable into any Bubble Tea
// program.
package ui

import (
	"strings"

	"pc/internal/tui/core/render"
)

// Hint is a keybinding rendered for the user: a key as the shell resolved it,
// and a short label. Widgets never see a keymap, only hints.
type Hint struct {
	Key   string
	Label string
}

// IsZero reports whether the hint has nothing to show.
func (h Hint) IsZero() bool {
	return h.Key == "" && h.Label == ""
}

// KeyHint renders a single binding as "key label".
type KeyHint struct {
	Hint Hint
}

// Render draws the hint inline; it does not use the context's rectangle.
func (k KeyHint) Render(rc render.Context) string {
	if k.Hint.IsZero() {
		return ""
	}
	st := rc.Styles()
	if k.Hint.Label == "" {
		return st.KeyHintKey.Render(k.Hint.Key)
	}
	if k.Hint.Key == "" {
		return st.KeyHintLabel.Render(k.Hint.Label)
	}
	return st.KeyHintKey.Render(k.Hint.Key) + " " + st.KeyHintLabel.Render(k.Hint.Label)
}

// RenderHints joins hints with a double space, dropping empty ones.
func RenderHints(rc render.Context, hints []Hint) string {
	parts := make([]string, 0, len(hints))
	for _, h := range hints {
		if s := (KeyHint{Hint: h}).Render(rc); s != "" {
			parts = append(parts, s)
		}
	}
	return strings.Join(parts, "  ")
}
