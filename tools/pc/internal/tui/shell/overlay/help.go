package overlay

import (
	"slices"
	"strings"

	tea "charm.land/bubbletea/v2"

	"pc/internal/tui/command"
	"pc/internal/tui/core/registry"
	"pc/internal/tui/core/render"
	"pc/internal/tui/focus"
	"pc/internal/tui/input"
	"pc/internal/tui/kernel"
	"pc/internal/tui/layout"
	"pc/internal/tui/ui"
)

// HelpID names the help overlay.
const HelpID registry.OverlayID = "help"

// Help lists the available commands grouped by category, each with the key it
// resolved to. It is generated from the registry, so it cannot drift from what
// the keymap actually does.
type Help struct {
	body ui.ScrollArea
}

// NewHelp opens an empty help view; its content is built on the first update.
func NewHelp() *Help {
	body := ui.NewScrollArea("")
	body.Focused = true
	return &Help{body: body}
}

// ID identifies the overlay.
func (h *Help) ID() registry.OverlayID {
	return HelpID
}

// FocusRegions traps focus on the scrolling body.
func (h *Help) FocusRegions() []focus.Region {
	return []focus.Region{{ID: "help.body", Order: 1, Label: "Help"}}
}

// Placement centres the help view with a margin on every side.
func (h *Help) Placement(frame layout.Frame) kernel.Rect {
	area := frame.Size.Rect()
	return area.Center(kernel.Size{
		Width:  max(20, area.Width-8),
		Height: max(6, area.Height-4),
	})
}

// Init renders the registry into the scrolling body.
func (h *Help) Init(ctx registry.Context) tea.Cmd {
	h.body = h.body.SetContent(buildHelp(ctx))
	return nil
}

// Update scrolls the body and closes on esc.
func (h *Help) Update(_ registry.Context, msg tea.Msg) (registry.Overlay, tea.Cmd) {
	next := *h

	if key, ok := msg.(tea.KeyMsg); ok {
		switch key.String() {
		case "esc", "q", "?":
			return &next, registry.Close()
		}
	}

	next.body, _ = next.body.Update(msg)
	return &next, nil
}

// Render draws the scrolling body inside a modal.
func (h *Help) Render(rc render.Context) string {
	area := rc.Rect
	inner := area.Inset(1).InsetXY(rc.Theme.Chrome.Density.Pad(), 0)
	body := h.body.SetHeight(inner.Height)

	return ui.Modal{
		Title:   "Keys and commands",
		Content: body.Render(rc.For(inner)),
		Footer:  []ui.Hint{{Key: "esc", Label: "Close"}},
	}.Render(rc)
}

// buildHelp renders the registry as text: every available command, grouped by
// category, annotated with the key that reaches it.
func buildHelp(ctx registry.Context) string {
	if ctx.Commands == nil {
		return ""
	}
	st := ctx.Theme.Styles
	keys := keysByCommand(ctx.Keymap)

	commands := ctx.Commands.Available(ctx.Scope())
	slices.SortStableFunc(commands, func(a, b command.Command) int {
		if a.Category != b.Category {
			return strings.Compare(a.Category, b.Category)
		}
		return strings.Compare(a.Title, b.Title)
	})

	var lines []string
	category := ""
	for _, c := range commands {
		if c.Category != category {
			if category != "" {
				lines = append(lines, "")
			}
			category = c.Category
			lines = append(lines, st.PanelTitleFocused.Render(strings.ToUpper(category)))
		}

		key := keys[c.ID]
		if key == "" {
			key = ctx.Theme.Chrome.Glyphs.Bullet
		}
		line := "  " + st.KeyHintKey.Render(render.Fit(key, 12, render.Left, "")) + st.Base.Render(c.Title)
		if c.Description != "" {
			line += "  " + st.Subtle.Render(c.Description)
		}
		lines = append(lines, line)
	}
	return strings.Join(lines, "\n")
}

// keysByCommand inverts the keymap so the help view can annotate a command
// with the key that reaches it.
func keysByCommand(resolver *input.Resolver) map[command.ID]string {
	out := map[command.ID]string{}
	if resolver == nil {
		return out
	}
	for _, layer := range []input.Layer{input.LayerGlobal, input.LayerScreen, input.LayerComponent, input.LayerOverlay} {
		for _, b := range resolver.Bindings(layer) {
			if _, taken := out[b.Command]; !taken {
				out[b.Command] = strings.Join(b.Keys, " ")
			}
		}
	}
	return out
}
