// Package themes holds the built-in palettes. It is separate from package
// theme so that the theme machinery has no dependency on any particular theme.
package themes

import (
	lipgloss "charm.land/lipgloss/v2"

	"pc/internal/tui/kernel"
	"pc/internal/tui/theme"
)

// All returns the built-in themes in cycle order. The first is the default.
func All() []theme.Theme {
	return []theme.Theme{Dark(), Dim(), HighContrast(), ASCII()}
}

func unicodeChrome() theme.Chrome {
	return theme.Chrome{
		Border:      lipgloss.RoundedBorder(),
		BorderFocus: lipgloss.ThickBorder(),
		Glyphs:      kernel.UnicodeGlyphs(),
		Density:     theme.Comfortable,
	}
}

// Dark is the default theme: a violet accent on a near-black ground.
func Dark() theme.Theme {
	return theme.New("dark", true, false, theme.Palette{
		Bg:           theme.Color("#141220"),
		Surface:      theme.Color("#1B1829"),
		SurfaceAlt:   theme.Color("#221E33"),
		Fg:           theme.Color("#E8E5F2"),
		FgMuted:      theme.Color("#9A93B0"),
		FgSubtle:     theme.Color("#726B8A"),
		Border:       theme.Color("#2C2842"),
		BorderFocus:  theme.Color("#9C8CF5"),
		BorderSubtle: theme.Color("#3D3757"),
		Accent:       theme.Color("#9C8CF5"),
		AccentFg:     theme.Color("#100D1A"),
		AccentMuted:  theme.Color("#262040"),
		Success:      theme.Color("#5DBE8E"),
		Warning:      theme.Color("#D4A54A"),
		Danger:       theme.Color("#E0736A"),
		Info:         theme.Color("#7FC3E8"),
		SelectionBg:  theme.Color("#9C8CF5"),
		SelectionFg:  theme.Color("#100D1A"),
	}, unicodeChrome())
}

// Dim trades contrast for comfort over a long session.
func Dim() theme.Theme {
	return theme.New("dim", true, false, theme.Palette{
		Bg:           theme.Color("#1A1A20"),
		Surface:      theme.Color("#20202A"),
		SurfaceAlt:   theme.Color("#26262F"),
		Fg:           theme.Color("#C4C2CC"),
		FgMuted:      theme.Color("#8A8894"),
		FgSubtle:     theme.Color("#63616D"),
		Border:       theme.Color("#31313C"),
		BorderFocus:  theme.Color("#7E86A8"),
		BorderSubtle: theme.Color("#3C3C47"),
		Accent:       theme.Color("#8E96BA"),
		AccentFg:     theme.Color("#1A1A20"),
		AccentMuted:  theme.Color("#2A2C38"),
		Success:      theme.Color("#7FA98D"),
		Warning:      theme.Color("#B79B65"),
		Danger:       theme.Color("#B87F79"),
		Info:         theme.Color("#7F9BB0"),
		SelectionBg:  theme.Color("#3A3E52"),
		SelectionFg:  theme.Color("#D6D4DE"),
	}, unicodeChrome())
}

// HighContrast targets WCAG-grade ratios and draws every border thick.
func HighContrast() theme.Theme {
	chrome := unicodeChrome()
	chrome.Border = lipgloss.ThickBorder()
	chrome.BorderFocus = lipgloss.DoubleBorder()

	return theme.New("high-contrast", true, false, theme.Palette{
		Bg:           theme.Color("#000000"),
		Surface:      theme.Color("#000000"),
		SurfaceAlt:   theme.Color("#1C1C1C"),
		Fg:           theme.Color("#FFFFFF"),
		FgMuted:      theme.Color("#D0D0D0"),
		FgSubtle:     theme.Color("#A8A8A8"),
		Border:       theme.Color("#A8A8A8"),
		BorderFocus:  theme.Color("#FFD400"),
		BorderSubtle: theme.Color("#6C6C6C"),
		Accent:       theme.Color("#FFD400"),
		AccentFg:     theme.Color("#000000"),
		AccentMuted:  theme.Color("#3A3000"),
		Success:      theme.Color("#3BE08B"),
		Warning:      theme.Color("#FFB000"),
		Danger:       theme.Color("#FF6B6B"),
		Info:         theme.Color("#63D0FF"),
		SelectionBg:  theme.Color("#FFD400"),
		SelectionFg:  theme.Color("#000000"),
	}, chrome)
}

// ASCII is the honest accessibility test: no unicode, no colour beyond bold,
// faint and reverse. If the app is usable here, nothing is signalled by colour
// alone.
func ASCII() theme.Theme {
	none := theme.NoColor()
	palette := theme.Palette{
		Bg: none, Surface: none, SurfaceAlt: none,
		Fg: none, FgMuted: none, FgSubtle: none,
		Border: none, BorderFocus: none, BorderSubtle: none,
		Accent: none, AccentFg: none, AccentMuted: none,
		Success: none, Warning: none, Danger: none, Info: none,
		SelectionBg: none, SelectionFg: none,
	}
	chrome := theme.Chrome{
		Border:      lipgloss.ASCIIBorder(),
		BorderFocus: asciiFocusBorder(),
		Glyphs:      kernel.ASCIIGlyphs(),
		Density:     theme.Comfortable,
	}
	return theme.New("ascii", false, true, palette, chrome)
}

// asciiFocusBorder is heavier than ASCIIBorder without leaving ASCII, so that
// focus stays legible on a terminal with neither colour nor unicode.
func asciiFocusBorder() lipgloss.Border {
	return lipgloss.Border{
		Top:         "=",
		Bottom:      "=",
		Left:        "|",
		Right:       "|",
		TopLeft:     "#",
		TopRight:    "#",
		BottomLeft:  "#",
		BottomRight: "#",
	}
}
