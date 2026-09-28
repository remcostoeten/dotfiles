package theme

import (
	"image/color"

	lipgloss "charm.land/lipgloss/v2"

	"pc/internal/tui/kernel"
)

// Palette is the semantic colour vocabulary. Components name roles, never
// hues, so a theme swap is a field assignment rather than a component change.
type Palette struct {
	Bg         color.Color
	Surface    color.Color
	SurfaceAlt color.Color

	Fg       color.Color
	FgMuted  color.Color
	FgSubtle color.Color

	Border       color.Color
	BorderFocus  color.Color
	BorderSubtle color.Color

	Accent      color.Color
	AccentFg    color.Color
	AccentMuted color.Color

	Success color.Color
	Warning color.Color
	Danger  color.Color
	Info    color.Color

	SelectionBg color.Color
	SelectionFg color.Color
}

// Density controls the padding widgets apply inside their borders.
type Density uint8

const (
	// Comfortable pads panel contents by one cell.
	Comfortable Density = iota
	// Compact removes interior padding for dense screens.
	Compact
)

// Pad is the horizontal padding a panel applies at this density.
func (d Density) Pad() int {
	if d == Compact {
		return 0
	}
	return 1
}

// Chrome carries the non-colour half of the visual language. Keeping borders
// and glyphs in the theme is what lets state be signalled without colour and
// lets a no-unicode terminal degrade without touching a component.
type Chrome struct {
	Border      lipgloss.Border
	BorderFocus lipgloss.Border
	Glyphs      kernel.GlyphSet
	Density     Density
}

// Color parses a hex or named colour. It is the only place in the codebase
// permitted to construct one outside a theme definition.
func Color(s string) color.Color {
	return lipgloss.Color(s)
}

// NoColor is the absence of colour, used by the ascii theme so that every
// distinction falls back to bold, faint or reverse.
func NoColor() color.Color {
	return lipgloss.NoColor{}
}
