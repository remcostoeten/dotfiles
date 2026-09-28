// Package audio is the audio screen: outputs, paired bluetooth devices, the
// default output's volume and whatever is playing.
package audio

import (
	"fmt"
	"strings"

	tea "charm.land/bubbletea/v2"

	"pc/internal/modules/live"
	pcaudio "pc/internal/pc/audio"
	"pc/internal/tui/core/registry"
	"pc/internal/tui/core/render"
	"pc/internal/tui/focus"
	"pc/internal/tui/kernel"
	"pc/internal/tui/layout"
	navigation "pc/internal/tui/navigation"
	"pc/internal/tui/ui"
	"pc/internal/widgets"
)

const (
	regionOutputs   kernel.ID = "audio.outputs"
	regionBluetooth kernel.ID = "audio.bluetooth"
)

const (
	volumeHeight = 4
)

type request uint8

const (
	activate request = iota
	volumeDown
	volumeUp
	toggleMute
)

type media pcaudio.MediaAction

// Module is the audio screen.
type Module struct {
	source pcaudio.Source
}

// New builds the screen around its source.
func New(source pcaudio.Source) *Module {
	return &Module{source: source}
}

// ID names the module.
func (m *Module) ID() registry.ModuleID {
	return "audio"
}

// Register installs the route and its verbs.
func (m *Module) Register(r *registry.Registrar) {
	live.RegisterScreen(r, live.Screen{
		Route:    navigation.Route{ID: "audio", Title: "Audio", Order: 40},
		Key:      "4",
		Category: "Audio",
		Build:    func(registry.Context) registry.View { return newView(m.source) },
		Verbs: []live.Verb{
			{ID: "audio.activate", Title: "Use Output or Toggle Device", Description: "Make the selected output the default, or (dis)connect the selected bluetooth device", Keys: []string{"enter"}, Hint: "Select", Priority: 60, Msg: activate},
			{ID: "audio.volume.down", Title: "Volume Down", Description: "Lower the default output by 5%", Keys: []string{"-"}, Hint: "Volume", Priority: 55, Msg: volumeDown},
			{ID: "audio.volume.up", Title: "Volume Up", Description: "Raise the default output by 5%", Keys: []string{"=", "+"}, Msg: volumeUp},
			{ID: "audio.mute", Title: "Toggle Mute", Keys: []string{"m"}, Hint: "Mute", Priority: 50, Msg: toggleMute},
			{ID: "audio.media.toggle", Title: "Play or Pause", Keys: []string{"space"}, Hint: "Play/pause", Priority: 45, Msg: media(pcaudio.PlayPause)},
			{ID: "audio.media.next", Title: "Next Track", Keys: []string{">"}, Msg: media(pcaudio.Next)},
			{ID: "audio.media.previous", Title: "Previous Track", Keys: []string{"<"}, Msg: media(pcaudio.Previous)},
		},
	})
}

// View is the audio screen.
type View struct {
	source    pcaudio.Source
	snapshot  pcaudio.Snapshot
	ready     bool
	outputs   ui.Table
	bluetooth ui.Table
	rects     map[kernel.ID]kernel.Rect
}

func newView(source pcaudio.Source) *View {
	return &View{
		source: source,
		outputs: ui.NewTable([]ui.Column{
			{Title: "", Width: layout.Fixed(1)},
			{Title: "OUTPUT", Width: layout.Flex(1)},
			{Title: "VOLUME", Width: layout.Fixed(7), Align: render.Right},
		}, nil),
		bluetooth: ui.NewTable([]ui.Column{
			{Title: "", Width: layout.Fixed(1)},
			{Title: "DEVICE", Width: layout.Flex(1)},
			{Title: "STATE", Width: layout.Fixed(12)},
		}, nil),
		rects: map[kernel.ID]kernel.Rect{},
	}
}

// Init reads every audio source.
func (v *View) Init() tea.Cmd {
	return v.fetch()
}

func (v *View) fetch() tea.Cmd {
	source := v.source
	return func() tea.Msg { return source.Read() }
}

// FocusRegions declares the output and bluetooth tables.
func (v *View) FocusRegions() []focus.Region {
	return []focus.Region{
		{ID: regionOutputs, Order: 1, Label: "Outputs", JumpKey: 'o'},
		{ID: regionBluetooth, Order: 2, Label: "Bluetooth", JumpKey: 'b', Skip: len(v.snapshot.Bluetooth) == 0},
	}
}

// RegionRects reports where the tables were drawn.
func (v *View) RegionRects(kernel.Rect) map[kernel.ID]kernel.Rect {
	return v.rects
}

// Update folds in snapshots and acts on verbs.
func (v *View) Update(ctx registry.Context, msg tea.Msg) (registry.View, tea.Cmd) {
	next := *v
	next.outputs.Focused = ctx.Focus.Focused(regionOutputs)
	next.bluetooth.Focused = ctx.Focus.Focused(regionBluetooth)

	switch msg := msg.(type) {
	case live.Tick:
		return &next, next.fetch()
	case pcaudio.Snapshot:
		return next.apply(msg), nil
	case request:
		return &next, next.handle(msg, ctx.Focus.Focused(regionBluetooth))
	case media:
		source := v.source
		action := pcaudio.MediaAction(msg)
		return &next, live.Action(mediaLabel(action), func() error { return source.Media(action) }, next.fetch())
	}
	next.outputs, _ = next.outputs.Update(msg)
	next.bluetooth, _ = next.bluetooth.Update(msg)
	return &next, nil
}

func (v View) apply(s pcaudio.Snapshot) *View {
	v.ready = true
	v.snapshot = s

	outputs := make([][]string, len(s.Sinks))
	for i, sink := range s.Sinks {
		mark, volume := "", fmt.Sprintf("%d%%", sink.Volume)
		if sink.Default {
			mark = "●"
		}
		if sink.Muted {
			volume = "muted"
		}
		outputs[i] = []string{mark, sink.Description, volume}
	}
	v.outputs = v.outputs.SetRows(outputs)

	devices := make([][]string, len(s.Bluetooth))
	for i, d := range s.Bluetooth {
		mark, state := "", "disconnected"
		if d.Connected {
			mark, state = "●", "connected"
		}
		devices[i] = []string{mark, d.Name, state}
	}
	v.bluetooth = v.bluetooth.SetRows(devices)
	return &v
}

func (v View) handle(r request, onBluetooth bool) tea.Cmd {
	source := v.source
	switch {
	case r == activate && onBluetooth:
		i := v.bluetooth.Cursor()
		if i < 0 || i >= len(v.snapshot.Bluetooth) {
			return nil
		}
		d := v.snapshot.Bluetooth[i]
		label := "Connected " + d.Name
		if d.Connected {
			label = "Disconnected " + d.Name
		}
		return live.Action(label, func() error { return source.SetConnected(d.MAC, !d.Connected) }, v.fetch())

	case r == activate:
		i := v.outputs.Cursor()
		if i < 0 || i >= len(v.snapshot.Sinks) {
			return nil
		}
		s := v.snapshot.Sinks[i]
		return live.Action("Default output → "+s.Description, func() error { return source.SetDefault(s.Name) }, v.fetch())

	case r == volumeDown || r == volumeUp:
		delta := pcaudio.VolumeStep
		if r == volumeDown {
			delta = -delta
		}
		return live.Action(fmt.Sprintf("Volume %+d%%", delta), func() error { return source.ChangeVolume(delta) }, v.fetch())

	case r == toggleMute:
		return live.Action("Mute toggled", source.ToggleMute, v.fetch())
	}
	return nil
}

// Render lays out the device tables beside volume and media.
func (v *View) Render(rc render.Context) string {
	area := rc.Rect
	cols := layout.Cols(area, layout.Flex(3), layout.Flex(2))
	left := layout.Rows(cols[0], layout.Flex(1), layout.Flex(1))
	right := layout.Rows(cols[1], layout.Fixed(volumeHeight), layout.Flex(1))
	v.rects[regionOutputs] = left[0]
	v.rects[regionBluetooth] = left[1]

	outputs := v.outputs.SetHeight(inner(rc, left[0]).Height)
	bluetooth := v.bluetooth.SetHeight(inner(rc, left[1]).Height)

	return render.Compose(area,
		render.At(left[0], ui.Panel{
			Title: "Outputs", Subtitle: fmt.Sprint(len(v.snapshot.Sinks)), Focused: rc.Focused(regionOutputs),
			Footer: []ui.Hint{{Key: "enter", Label: "Make default"}}, Scroll: outputs.ScrollPos(),
			Content: v.tableView(rc.For(inner(rc, left[0])), outputs, len(v.snapshot.Sinks), "No outputs found", "is pactl installed?"),
		}.Render(rc.For(left[0]))),
		render.At(left[1], ui.Panel{
			Title: "Bluetooth", Subtitle: fmt.Sprint(len(v.snapshot.Bluetooth)), Focused: rc.Focused(regionBluetooth),
			Footer: []ui.Hint{{Key: "enter", Label: "(Dis)connect"}}, Scroll: bluetooth.ScrollPos(),
			Content: v.tableView(rc.For(inner(rc, left[1])), bluetooth, len(v.snapshot.Bluetooth), "No paired devices", ""),
		}.Render(rc.For(left[1]))),
		render.At(right[0], ui.Panel{Title: "Volume", Footer: []ui.Hint{{Key: "- =", Label: "±5%"}, {Key: "m", Label: "Mute"}}, Content: v.volume(rc.For(inner(rc, right[0])))}.Render(rc.For(right[0]))),
		render.At(right[1], ui.Panel{Title: "Now playing", Footer: []ui.Hint{{Key: "space", Label: "Play/pause"}, {Key: "< >", Label: "Track"}}, Content: v.players(rc.For(inner(rc, right[1])))}.Render(rc.For(right[1]))),
	)
}

func (v *View) tableView(rc render.Context, table ui.Table, count int, empty, hint string) string {
	switch {
	case !v.ready:
		return ui.EmptyState{Title: "Reading audio devices…"}.Render(rc)
	case count == 0:
		return ui.EmptyState{Title: empty, Hint: hint}.Render(rc)
	}
	return table.Render(rc)
}

func (v *View) volume(rc render.Context) string {
	for _, s := range v.snapshot.Sinks {
		if !s.Default {
			continue
		}
		g := widgets.Gauge{Label: "volume", Value: s.Volume, Max: 100}
		if s.Muted {
			g.Text, g.Severity = "muted", ui.SeverityWarning
		}
		return render.Join(g.Render(rc), rc.Styles().Muted.Render(render.Truncate(s.Description, rc.Rect.Width, rc.Glyphs.Ellipsis)))
	}
	return rc.Styles().Muted.Render("no default output")
}

func (v *View) players(rc render.Context) string {
	if len(v.snapshot.Players) == 0 {
		return ui.EmptyState{Title: "Nothing playing"}.Render(rc)
	}
	st := rc.Styles()
	lines := make([]string, 0, 3*len(v.snapshot.Players))
	for i, p := range v.snapshot.Players {
		if i > 0 {
			lines = append(lines, "")
		}
		icon := st.Muted.Render("||")
		if p.Playing() {
			icon = st.Success.Render(rc.Glyphs.Chevron)
		}
		title := p.Title
		if title == "" {
			title = p.Name
		}
		lines = append(lines, icon+" "+st.PanelTitleFocused.Render(render.Truncate(title, rc.Rect.Width-3, rc.Glyphs.Ellipsis)))
		detail := p.Name
		if p.Artist != "" {
			detail = p.Artist + " · " + p.Name
		}
		lines = append(lines, "  "+st.Muted.Render(render.Truncate(detail, rc.Rect.Width-2, rc.Glyphs.Ellipsis)))
	}
	return strings.Join(lines, "\n")
}

func mediaLabel(a pcaudio.MediaAction) string {
	switch a {
	case pcaudio.Next:
		return "Next track"
	case pcaudio.Previous:
		return "Previous track"
	default:
		return "Play/pause"
	}
}

func inner(rc render.Context, r kernel.Rect) kernel.Rect {
	return r.Inset(1).InsetXY(rc.Theme.Chrome.Density.Pad(), 0)
}
