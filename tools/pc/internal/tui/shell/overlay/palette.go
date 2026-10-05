// Package overlay holds the framework-aware surfaces: the ones that need the
// command registry, the keymap or the focus stack. They are built from ui/
// primitives but live above them, so that ui/ stays importable by anything and
// aware of nothing.
package overlay

import (
	tea "charm.land/bubbletea/v2"

	"pc/internal/tui/command"
	"pc/internal/tui/core/registry"
	"pc/internal/tui/core/render"
	"pc/internal/tui/focus"
	"pc/internal/tui/kernel"
	"pc/internal/tui/layout"
	"pc/internal/tui/ui"
)

// PaletteID names the command palette overlay.
const PaletteID registry.OverlayID = "palette"

// Palette is a consumer of the command registry, never its owner: it lists
// what is available, fuzzy-matches, and dispatches an identifier. Delete it
// and every command still works from its keybinding.
type Palette struct {
	input   ui.Input
	list    ui.List
	matches []command.Command
	query   string
}

// NewPalette opens an empty palette.
func NewPalette() *Palette {
	in := ui.NewInput("Search commands…")
	in.Focused = true

	list := ui.NewList()
	list.Focused = true

	return &Palette{input: in, list: list}
}

// ID identifies the overlay.
func (p *Palette) ID() registry.OverlayID {
	return PaletteID
}

// FocusRegions traps focus on the query field.
func (p *Palette) FocusRegions() []focus.Region {
	return []focus.Region{{ID: "palette.query", Order: 1, Label: "Command palette"}}
}

// Capturing keeps the keymap out of the way while the user is typing.
func (p *Palette) Capturing() bool {
	return true
}

// Placement centres the palette in the upper third of the frame.
func (p *Palette) Placement(frame layout.Frame) kernel.Rect {
	width := min(64, max(20, frame.Size.Width-8))
	height := min(16, max(6, frame.Size.Height-6))
	area := frame.Size.Rect()

	rect := area.Center(kernel.Size{Width: width, Height: height})
	rect.Y = max(0, area.Height/6)
	return rect
}

// Init lists everything available, which is what the palette shows on open.
func (p *Palette) Init(ctx registry.Context) tea.Cmd {
	*p = p.refresh(ctx)
	return nil
}

// Update edits the query, moves the selection and runs the chosen command.
func (p *Palette) Update(ctx registry.Context, msg tea.Msg) (registry.Overlay, tea.Cmd) {
	next := *p

	if key, ok := msg.(tea.KeyMsg); ok {
		switch key.String() {
		case "esc":
			return &next, registry.Close()
		case "enter":
			selected, ok := next.selected()
			if !ok {
				return &next, registry.Close()
			}
			return &next, tea.Sequence(registry.Close(), ctx.Dispatch(selected.ID))
		case "up", "down", "pgup", "pgdown":
			next.list, _ = next.list.Update(msg)
			return &next, nil
		}
	}

	next.input, _ = next.input.Update(msg)
	if next.input.Value() != next.query || next.matches == nil {
		next.query = next.input.Value()
		next = next.refresh(ctx)
	}
	return &next, nil
}

// refresh re-runs the search and rebuilds the result list.
func (p Palette) refresh(ctx registry.Context) Palette {
	if ctx.Commands == nil {
		return p
	}
	p.matches = ctx.Commands.Search(p.query, ctx.Scope())

	items := make([]ui.ListItem, len(p.matches))
	for i, c := range p.matches {
		severity := ui.SeverityInfo
		if c.Dangerous {
			severity = ui.SeverityDanger
		}
		items[i] = ui.ListItem{
			ID:       kernel.ID(c.ID),
			Title:    c.Title,
			Detail:   c.Category,
			Severity: severity,
		}
	}
	p.list = p.list.SetItems(items)
	return p
}

func (p Palette) selected() (command.Command, bool) {
	if p.list.Cursor() < 0 || p.list.Cursor() >= len(p.matches) {
		return command.Command{}, false
	}
	return p.matches[p.list.Cursor()], true
}

// Render draws the query field over the result list.
func (p *Palette) Render(rc render.Context) string {
	area := rc.Rect
	inner := area.Inset(1).InsetXY(rc.Theme.Chrome.Density.Pad(), 0)
	rows := layout.Rows(inner, layout.Fixed(1), layout.Fixed(1), layout.Flex(1))

	list := p.list.SetHeight(rows[2].Height)
	body := render.Compose(inner,
		render.At(rows[0], p.input.Render(rc.For(rows[0]))),
		render.At(rows[1], ui.Rule{}.Render(rc.For(rows[1]))),
		render.At(rows[2], list.Render(rc.For(rows[2]))),
	)

	return ui.Modal{
		Title:   "Commands",
		Content: body,
		Footer:  []ui.Hint{{Key: "enter", Label: "Run"}, {Key: "esc", Label: "Close"}},
	}.Render(rc)
}
