package render

import (
	"pc/internal/tui/kernel"
	"pc/internal/tui/layout"
	"pc/internal/tui/theme"
)

// FocusSnapshot is the read-only view of focus that rendering needs. It is an
// interface rather than the concrete focus.Snapshot so that render — and
// therefore every widget — stays independent of the focus package.
type FocusSnapshot interface {
	Focused(kernel.ID) bool
	Current() kernel.ID
}

// Context carries render-time dependencies down the tree. It has no dispatch
// and no mutable state, which is what makes View a pure function of the model.
type Context struct {
	Theme      theme.Theme
	Rect       kernel.Rect
	Focus      FocusSnapshot
	Breakpoint layout.Breakpoint
	Glyphs     kernel.GlyphSet
}

// NewContext builds a context for a theme and area, defaulting the glyph set
// to the theme's own.
func NewContext(t theme.Theme, area kernel.Rect, bp layout.Breakpoint, focus FocusSnapshot) Context {
	return Context{
		Theme:      t,
		Rect:       area,
		Focus:      focus,
		Breakpoint: bp,
		Glyphs:     t.Chrome.Glyphs,
	}
}

// For scopes the context to a sub-rectangle.
func (rc Context) For(r kernel.Rect) Context {
	rc.Rect = r
	return rc
}

// Inset scopes the context to its own rectangle shrunk by n cells.
func (rc Context) Inset(n int) Context {
	rc.Rect = rc.Rect.Inset(n)
	return rc
}

// Focused reports whether the given region currently holds focus.
func (rc Context) Focused(id kernel.ID) bool {
	if rc.Focus == nil {
		return false
	}
	return rc.Focus.Focused(id)
}

// Styles is a shorthand for the theme's precomputed styles.
func (rc Context) Styles() theme.Styles {
	return rc.Theme.Styles
}

// Size is the extent of the context's rectangle.
func (rc Context) Size() kernel.Size {
	return rc.Rect.Size()
}

// At pairs content with the context's own rectangle.
func (rc Context) At(content string) Block {
	return At(rc.Rect, content)
}
