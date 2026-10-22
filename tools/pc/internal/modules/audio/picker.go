package audio

import (
	"strings"

	tea "charm.land/bubbletea/v2"

	"pc/internal/modules/live"
	pcaudio "pc/internal/pc/audio"
	"pc/internal/tui/core/registry"
	"pc/internal/tui/core/render"
	"pc/internal/tui/focus"
	"pc/internal/tui/kernel"
	"pc/internal/tui/layout"
	"pc/internal/tui/ui"
)

const (
	pickerID   registry.OverlayID = "audio.picker"
	pickerRows                    = 12
)

// picker chooses the output one application plays to. It holds the source so
// that picking is a single move, with a test sound available before committing.
type picker struct {
	source pcaudio.Source
	stream pcaudio.Stream
	sinks  []pcaudio.Sink
	list   ui.List
}

func newPicker(source pcaudio.Source, stream pcaudio.Stream, sinks []pcaudio.Sink) *picker {
	items := make([]ui.ListItem, len(sinks))
	current := 0
	for i, s := range sinks {
		var tags []string
		if s.Name == stream.Sink {
			tags = append(tags, "current")
			current = i
		}
		if s.Default {
			tags = append(tags, "default")
		}
		items[i] = ui.ListItem{ID: kernel.ID(s.Name), Title: s.Description, Detail: strings.Join(tags, " · ")}
	}

	list := ui.NewList(items...).SetHeight(min(len(items), pickerRows))
	list.Focused = true
	for range current {
		list, _ = list.Update(tea.KeyPressMsg{Code: tea.KeyDown})
	}
	return &picker{source: source, stream: stream, sinks: sinks, list: list}
}

// ID identifies the overlay.
func (p *picker) ID() registry.OverlayID {
	return pickerID
}

// FocusRegions traps focus on the list.
func (p *picker) FocusRegions() []focus.Region {
	return []focus.Region{{ID: "audio.picker", Order: 1, Label: "Outputs"}}
}

// Placement centres a box sized to the list.
func (p *picker) Placement(frame layout.Frame) kernel.Rect {
	area := frame.Size.Rect()
	return area.Center(kernel.Size{
		Width:  min(64, max(20, area.Width-8)),
		Height: min(min(len(p.sinks), pickerRows)+2, max(5, area.Height-2)),
	})
}

// Init has nothing to load: the outputs are already in the struct.
func (p *picker) Init(registry.Context) tea.Cmd {
	return nil
}

// Update moves the cursor, tests the highlighted output and routes the app.
func (p *picker) Update(ctx registry.Context, msg tea.Msg) (registry.Overlay, tea.Cmd) {
	next := *p

	key, ok := msg.(tea.KeyMsg)
	if !ok {
		return &next, nil
	}

	source, stream := next.source, next.stream
	i := next.list.Cursor()
	switch key.String() {
	case "esc":
		return &next, registry.Close()
	case "t":
		if i < 0 || i >= len(next.sinks) {
			return &next, nil
		}
		sink := next.sinks[i]
		return &next, live.Action("Test sound on "+sink.Description, func() error { return source.Test(sink.Name) })
	case "enter":
		if i < 0 || i >= len(next.sinks) {
			return &next, registry.Close()
		}
		sink := next.sinks[i]
		move := live.Action(stream.App+" → "+sink.Description, func() error { return source.MoveStream(stream.Index, sink.Name) }, ctx.Dispatch(live.RefreshID))
		return &next, tea.Sequence(registry.Close(), move)
	}

	next.list, _ = next.list.Update(msg)
	return &next, nil
}

// Render draws the outputs inside a modal.
func (p *picker) Render(rc render.Context) string {
	inner := rc.Rect.Inset(1).InsetXY(rc.Theme.Chrome.Density.Pad(), 0)
	return ui.Modal{
		Title:   "Output for " + p.stream.App,
		Content: p.list.Render(rc.For(inner)),
		Footer:  []ui.Hint{{Key: "enter", Label: "Route here"}, {Key: "t", Label: "Test"}, {Key: "esc", Label: "Cancel"}},
	}.Render(rc)
}
