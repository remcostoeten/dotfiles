package theme

import (
	"image/color"

	lipgloss "charm.land/lipgloss/v2"
)

// Styles are the lipgloss styles every component draws with. They are built
// once when a theme is loaded rather than per frame, because rebuilding styles
// inside a render loop is the classic terminal-UI performance mistake.
type Styles struct {
	Base   lipgloss.Style
	Muted  lipgloss.Style
	Subtle lipgloss.Style
	Accent lipgloss.Style

	Success lipgloss.Style
	Warning lipgloss.Style
	Danger  lipgloss.Style
	Info    lipgloss.Style

	PanelBorder        lipgloss.Style
	PanelBorderFocused lipgloss.Style
	PanelTitle         lipgloss.Style
	PanelTitleFocused  lipgloss.Style
	PanelSubtitle      lipgloss.Style

	TopBar        lipgloss.Style
	TopBarTitle   lipgloss.Style
	TopBarVersion lipgloss.Style
	NavItem       lipgloss.Style
	NavItemActive lipgloss.Style

	StatusBar   lipgloss.Style
	StatusKey   lipgloss.Style
	StatusLabel lipgloss.Style

	Selection    lipgloss.Style
	SelectionDim lipgloss.Style

	KeyHintKey   lipgloss.Style
	KeyHintLabel lipgloss.Style

	Badge       lipgloss.Style
	BadgeAccent lipgloss.Style

	EmptyTitle lipgloss.Style
	EmptyHint  lipgloss.Style

	Spinner        lipgloss.Style
	Scrollbar      lipgloss.Style
	ScrollbarThumb lipgloss.Style

	TabActive   lipgloss.Style
	TabInactive lipgloss.Style

	ModalBorder lipgloss.Style
	ModalTitle  lipgloss.Style

	ToastInfo    lipgloss.Style
	ToastSuccess lipgloss.Style
	ToastWarning lipgloss.Style
	ToastDanger  lipgloss.Style

	InputText        lipgloss.Style
	InputPlaceholder lipgloss.Style
	InputCursor      lipgloss.Style

	Button        lipgloss.Style
	ButtonFocused lipgloss.Style
	ButtonDanger  lipgloss.Style

	Checked   lipgloss.Style
	Unchecked lipgloss.Style

	ErrorTitle  lipgloss.Style
	ErrorDetail lipgloss.Style
}

// Theme is a complete visual definition. Themes are values, so switching one
// at runtime is an assignment plus a re-render.
type Theme struct {
	Name    string
	Dark    bool
	Mono    bool
	Palette Palette
	Chrome  Chrome
	Styles  Styles
}

// Canvas is the colour every cell of the frame falls back to when nothing
// styled it. It is nil for mono themes and for palettes that opted out of
// colour, which is how a terminal keeps its own background.
func (t Theme) Canvas() color.Color {
	if t.Mono || t.Palette.Bg == nil {
		return nil
	}
	if _, none := t.Palette.Bg.(lipgloss.NoColor); none {
		return nil
	}
	return t.Palette.Bg
}

// New builds a theme, precomputing its styles. Mono themes signal every state
// with weight and reversal instead of colour.
func New(name string, dark, mono bool, p Palette, c Chrome) Theme {
	t := Theme{Name: name, Dark: dark, Mono: mono, Palette: p, Chrome: c}
	t.Styles = buildStyles(p, mono)
	return t
}

type builder struct {
	p    Palette
	mono bool
}

func (b builder) fg(c color.Color) lipgloss.Style {
	if b.mono {
		return lipgloss.NewStyle()
	}
	return lipgloss.NewStyle().Foreground(c)
}

func buildStyles(p Palette, mono bool) Styles {
	b := builder{p: p, mono: mono}

	selection := b.fg(p.SelectionFg).Bold(true)
	if !mono {
		selection = selection.Background(p.SelectionBg)
	} else {
		selection = selection.Reverse(true)
	}

	return Styles{
		Base:   b.fg(p.Fg),
		Muted:  b.fg(p.FgMuted),
		Subtle: b.fg(p.FgSubtle).Faint(mono),
		Accent: b.fg(p.Accent).Bold(mono),

		Success: b.fg(p.Success),
		Warning: b.fg(p.Warning).Bold(mono),
		Danger:  b.fg(p.Danger).Bold(mono),
		Info:    b.fg(p.Info),

		PanelBorder:        b.fg(p.Border),
		PanelBorderFocused: b.fg(p.BorderFocus).Bold(true),
		PanelTitle:         b.fg(p.FgMuted),
		PanelTitleFocused:  b.fg(p.Accent).Bold(true),
		PanelSubtitle:      b.fg(p.FgSubtle),

		TopBar:        b.fg(p.Fg),
		TopBarTitle:   b.fg(p.Fg).Bold(true),
		TopBarVersion: b.fg(p.FgSubtle),
		NavItem:       b.fg(p.FgMuted),
		NavItemActive: selection,

		StatusBar:   b.fg(p.FgSubtle),
		StatusKey:   b.fg(p.Fg).Bold(mono),
		StatusLabel: b.fg(p.FgMuted),

		Selection:    selection,
		SelectionDim: b.fg(p.FgMuted).Faint(mono),

		KeyHintKey:   b.fg(p.Accent).Bold(mono),
		KeyHintLabel: b.fg(p.FgMuted),

		Badge:       b.fg(p.FgMuted),
		BadgeAccent: b.fg(p.Accent).Bold(mono),

		EmptyTitle: b.fg(p.FgMuted),
		EmptyHint:  b.fg(p.FgSubtle).Faint(mono),

		Spinner:        b.fg(p.Accent),
		Scrollbar:      b.fg(p.BorderSubtle),
		ScrollbarThumb: b.fg(p.Accent).Bold(mono),

		TabActive:   selection,
		TabInactive: b.fg(p.FgMuted),

		ModalBorder: b.fg(p.BorderFocus),
		ModalTitle:  b.fg(p.Accent).Bold(true),

		ToastInfo:    b.fg(p.Info),
		ToastSuccess: b.fg(p.Success),
		ToastWarning: b.fg(p.Warning).Bold(mono),
		ToastDanger:  b.fg(p.Danger).Bold(mono),

		InputText:        b.fg(p.Fg),
		InputPlaceholder: b.fg(p.FgSubtle).Faint(mono),
		InputCursor:      selection,

		Button:        b.fg(p.FgMuted),
		ButtonFocused: selection,
		ButtonDanger:  b.fg(p.Danger).Bold(true),

		Checked:   b.fg(p.Success).Bold(mono),
		Unchecked: b.fg(p.FgSubtle),

		ErrorTitle:  b.fg(p.Danger).Bold(true),
		ErrorDetail: b.fg(p.FgMuted),
	}
}
