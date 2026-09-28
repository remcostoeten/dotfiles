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

// ConfirmID names the confirmation overlay.
const ConfirmID registry.OverlayID = "confirm"

// Confirm asks before running a destructive command. A command that needs
// confirming does not implement a dialog — it returns one of these, and the
// real command is dispatched on accept. Composition, not a dialog framework.
type Confirm struct {
	Title   string
	Message string
	Accept  command.ID
	Danger  bool

	confirmed bool
}

// NewConfirm builds a confirmation for a command.
func NewConfirm(title, message string, accept command.ID, danger bool) *Confirm {
	return &Confirm{Title: title, Message: message, Accept: accept, Danger: danger}
}

// Ask returns a command that opens a confirmation.
func Ask(title, message string, accept command.ID, danger bool) tea.Cmd {
	return registry.Open(NewConfirm(title, message, accept, danger))
}

// ID identifies the overlay.
func (c *Confirm) ID() registry.OverlayID {
	return ConfirmID
}

// FocusRegions traps focus on the two buttons.
func (c *Confirm) FocusRegions() []focus.Region {
	return []focus.Region{
		{ID: "confirm.cancel", Order: 1, Label: "Cancel"},
		{ID: "confirm.accept", Order: 2, Label: "Confirm"},
	}
}

// Placement centres a small box.
func (c *Confirm) Placement(frame layout.Frame) kernel.Rect {
	area := frame.Size.Rect()
	return area.Center(kernel.Size{
		Width:  min(56, max(20, area.Width-8)),
		Height: min(8, max(5, area.Height-4)),
	})
}

// Init has nothing to load: the question is already in the struct.
func (c *Confirm) Init(registry.Context) tea.Cmd {
	return nil
}

// Update moves between the buttons and resolves the question.
func (c *Confirm) Update(ctx registry.Context, msg tea.Msg) (registry.Overlay, tea.Cmd) {
	next := *c

	key, ok := msg.(tea.KeyMsg)
	if !ok {
		return &next, nil
	}

	switch key.String() {
	case "esc", "n":
		return &next, registry.Close()
	case "y":
		return &next, tea.Sequence(registry.Close(), ctx.Dispatch(next.Accept))
	case "left", "right", "tab", "h", "l":
		next.confirmed = !next.confirmed
		return &next, nil
	case "enter":
		if !next.confirmed {
			return &next, registry.Close()
		}
		return &next, tea.Sequence(registry.Close(), ctx.Dispatch(next.Accept))
	}
	return &next, nil
}

// Render draws the question and the two buttons.
func (c *Confirm) Render(rc render.Context) string {
	area := rc.Rect
	inner := area.Inset(1).InsetXY(rc.Theme.Chrome.Density.Pad(), 0)
	rows := layout.Rows(inner, layout.Flex(1), layout.Fixed(1))

	message := ui.EmptyState{Title: c.Message}.Render(rc.For(rows[0]))
	buttons := ui.Button{Label: "Cancel", Focused: !c.confirmed}.Render(rc) +
		"  " +
		ui.Button{Label: "Confirm", Focused: c.confirmed, Danger: c.Danger}.Render(rc)

	body := render.Compose(inner,
		render.At(rows[0], message),
		render.At(rows[1], render.Fit(buttons, rows[1].Width, render.Center, "")),
	)

	return ui.Modal{
		Title:   c.Title,
		Content: body,
		Footer:  []ui.Hint{{Key: "y", Label: "Yes"}, {Key: "n", Label: "No"}},
	}.Render(rc)
}
