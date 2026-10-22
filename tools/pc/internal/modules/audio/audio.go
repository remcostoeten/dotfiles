// Package audio is the audio screen: outputs, the applications playing to
// them, paired bluetooth devices, volume and whatever is playing.
package audio

import (
	"fmt"
	"strings"

	tea "charm.land/bubbletea/v2"

	"pc/internal/modules/live"
	pcaudio "pc/internal/pc/audio"
	"pc/internal/tui/command"
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
	regionApps      kernel.ID = "audio.apps"
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
	playTest
	routeAll
)

type media pcaudio.MediaAction

type pane uint8

const (
	paneOutputs pane = iota
	paneApps
	paneBluetooth
)

// target is whatever the volume, mute and test verbs act on: the selected
// output, the selected application or, from the bluetooth table, the default
// output. name is the output to hear it on.
type target struct {
	name   string
	label  string
	stream int
	app    bool
	volume int
	muted  bool
}

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
		Gate:     func(s command.Scope) bool { return s.Overlay != string(pickerID) },
		Verbs: []live.Verb{
			{ID: "audio.activate", Title: "Use Output, Route App or Toggle Device", Description: "Make the selected output the default, choose an output for the selected app, or (dis)connect the selected bluetooth device", Keys: []string{"enter"}, Hint: "Select", Priority: 60, Msg: activate},
			{ID: "audio.test", Title: "Play Test Sound", Description: "Play a sample on the selected output, or on the output the selected app plays to", Keys: []string{"t"}, Hint: "Test", Priority: 58, Msg: playTest},
			{ID: "audio.volume.down", Title: "Volume Down", Description: "Lower the selected output or app by 5%", Keys: []string{"-"}, Hint: "Volume", Priority: 55, Msg: volumeDown},
			{ID: "audio.volume.up", Title: "Volume Up", Description: "Raise the selected output or app by 5%", Keys: []string{"=", "+"}, Msg: volumeUp},
			{ID: "audio.mute", Title: "Toggle Mute", Description: "Mute or unmute the selected output or app", Keys: []string{"m"}, Hint: "Mute", Priority: 50, Msg: toggleMute},
			{ID: "audio.route.all", Title: "Send All Apps to Output", Description: "Route every application to the selected output", Keys: []string{"R"}, Msg: routeAll},
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
	apps      ui.Table
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
		apps: ui.NewTable([]ui.Column{
			{Title: "", Width: layout.Fixed(1)},
			{Title: "APP", Width: layout.Flex(1)},
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

// FocusRegions declares the output, app and bluetooth tables.
func (v *View) FocusRegions() []focus.Region {
	return []focus.Region{
		{ID: regionOutputs, Order: 1, Label: "Outputs", JumpKey: 'o'},
		{ID: regionApps, Order: 2, Label: "Apps", JumpKey: 'a', Skip: len(v.snapshot.Streams) == 0},
		{ID: regionBluetooth, Order: 3, Label: "Bluetooth", JumpKey: 'b', Skip: len(v.snapshot.Bluetooth) == 0},
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
	next.apps.Focused = ctx.Focus.Focused(regionApps)
	next.bluetooth.Focused = ctx.Focus.Focused(regionBluetooth)

	switch msg := msg.(type) {
	case live.Tick:
		return &next, next.fetch()
	case pcaudio.Snapshot:
		return next.apply(msg), nil
	case request:
		return &next, next.handle(msg, focusedPane(ctx.Focus.Focused))
	case media:
		source := v.source
		action := pcaudio.MediaAction(msg)
		return &next, live.Action(mediaLabel(action), func() error { return source.Media(action) }, next.fetch())
	}
	next.outputs, _ = next.outputs.Update(msg)
	next.apps, _ = next.apps.Update(msg)
	next.bluetooth, _ = next.bluetooth.Update(msg)
	return &next, nil
}

func focusedPane(focused func(kernel.ID) bool) pane {
	switch {
	case focused(regionApps):
		return paneApps
	case focused(regionBluetooth):
		return paneBluetooth
	}
	return paneOutputs
}

func (v View) apply(s pcaudio.Snapshot) *View {
	v.ready = true
	v.snapshot = s

	outputs := make([][]string, len(s.Sinks))
	for i, sink := range s.Sinks {
		mark := ""
		if sink.Default {
			mark = "●"
		}
		outputs[i] = []string{mark, sink.Description, volumeText(sink.Volume, sink.Muted)}
	}
	v.outputs = v.outputs.SetRows(outputs)

	apps := make([][]string, len(s.Streams))
	for i, stream := range s.Streams {
		mark := "●"
		if stream.Corked {
			mark = ""
		}
		apps[i] = []string{mark, appLabel(stream), v.describe(stream.Sink), volumeText(stream.Volume, stream.Muted)}
	}
	v.apps = v.apps.SetRows(apps)

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

func volumeText(volume int, muted bool) string {
	if muted {
		return "muted"
	}
	return fmt.Sprintf("%d%%", volume)
}

func appLabel(s pcaudio.Stream) string {
	if s.Media == "" || s.Media == s.App {
		return s.App
	}
	return s.App + " · " + s.Media
}

func (v View) describe(sink string) string {
	if sink == "" {
		return "—"
	}
	for _, s := range v.snapshot.Sinks {
		if s.Name == sink {
			return s.Description
		}
	}
	return sink
}

func (v View) defaultSink() (pcaudio.Sink, bool) {
	for _, s := range v.snapshot.Sinks {
		if s.Default {
			return s, true
		}
	}
	return pcaudio.Sink{}, false
}

func (v View) target(p pane) (target, bool) {
	switch p {
	case paneApps:
		i := v.apps.Cursor()
		if i < 0 || i >= len(v.snapshot.Streams) {
			return target{}, false
		}
		s := v.snapshot.Streams[i]
		return target{name: s.Sink, label: s.App, stream: s.Index, app: true, volume: s.Volume, muted: s.Muted}, true
	case paneOutputs:
		i := v.outputs.Cursor()
		if i < 0 || i >= len(v.snapshot.Sinks) {
			return target{}, false
		}
		return sinkTarget(v.snapshot.Sinks[i]), true
	}
	s, ok := v.defaultSink()
	return sinkTarget(s), ok
}

func sinkTarget(s pcaudio.Sink) target {
	return target{name: s.Name, label: s.Description, volume: s.Volume, muted: s.Muted}
}

func (v View) handle(r request, p pane) tea.Cmd {
	switch r {
	case activate:
		return v.activate(p)
	case routeAll:
		return v.routeAll()
	}

	t, ok := v.target(p)
	if !ok {
		return nil
	}
	switch r {
	case volumeDown, volumeUp:
		return v.nudge(t, r)
	case toggleMute:
		return v.mute(t)
	case playTest:
		return v.test(t)
	}
	return nil
}

func (v View) activate(p pane) tea.Cmd {
	source := v.source
	switch p {
	case paneBluetooth:
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

	case paneApps:
		i := v.apps.Cursor()
		if i < 0 || i >= len(v.snapshot.Streams) || len(v.snapshot.Sinks) == 0 {
			return nil
		}
		return registry.Open(newPicker(source, v.snapshot.Streams[i], v.snapshot.Sinks))
	}

	i := v.outputs.Cursor()
	if i < 0 || i >= len(v.snapshot.Sinks) {
		return nil
	}
	s := v.snapshot.Sinks[i]
	return live.Action("Default output → "+s.Description, func() error { return source.SetDefault(s.Name) }, v.fetch())
}

func (v View) routeAll() tea.Cmd {
	i := v.outputs.Cursor()
	streams := v.snapshot.Streams
	if i < 0 || i >= len(v.snapshot.Sinks) || len(streams) == 0 {
		return live.Warn("No apps to route")
	}
	sink, source := v.snapshot.Sinks[i], v.source
	return live.Action("All apps → "+sink.Description, func() error {
		var first error
		for _, s := range streams {
			if err := source.MoveStream(s.Index, sink.Name); err != nil && first == nil {
				first = err
			}
		}
		return first
	}, v.fetch())
}

func (v View) nudge(t target, r request) tea.Cmd {
	source := v.source
	delta := pcaudio.VolumeStep
	if r == volumeDown {
		delta = -delta
	}
	run := func() error { return source.ChangeVolume(t.name, delta) }
	if t.app {
		run = func() error { return source.ChangeStreamVolume(t.stream, delta) }
	}
	return live.Action(fmt.Sprintf("%s %+d%%", t.label, delta), run, v.fetch())
}

func (v View) mute(t target) tea.Cmd {
	source := v.source
	run := func() error { return source.ToggleMute(t.name) }
	if t.app {
		run = func() error { return source.ToggleStreamMute(t.stream) }
	}
	return live.Action(t.label+" mute toggled", run, v.fetch())
}

func (v View) test(t target) tea.Cmd {
	sink := t.name
	if sink == "" {
		d, ok := v.defaultSink()
		if !ok {
			return live.Warn("No output to test")
		}
		sink = d.Name
	}
	source := v.source
	return live.Action("Test sound on "+v.describe(sink), func() error { return source.Test(sink) })
}

// Render lays out the device tables beside volume and media.
func (v *View) Render(rc render.Context) string {
	area := rc.Rect
	cols := layout.Cols(area, layout.Flex(3), layout.Flex(2))
	left := layout.Rows(cols[0], layout.Flex(1), layout.Flex(1))
	right := layout.Rows(cols[1], layout.Fixed(volumeHeight), layout.Flex(1), layout.Flex(1))
	v.rects[regionOutputs] = left[0]
	v.rects[regionApps] = left[1]
	v.rects[regionBluetooth] = right[1]

	outputs := v.outputs.SetHeight(inner(rc, left[0]).Height)
	apps := v.apps.SetHeight(inner(rc, left[1]).Height)
	bluetooth := v.bluetooth.SetHeight(inner(rc, right[1]).Height)

	return render.Compose(area,
		render.At(left[0], ui.Panel{
			Title: "Outputs", Subtitle: fmt.Sprint(len(v.snapshot.Sinks)), Focused: rc.Focused(regionOutputs),
			Footer: []ui.Hint{{Key: "enter", Label: "Make default"}, {Key: "t", Label: "Test"}, {Key: "R", Label: "Send all apps here"}}, Scroll: outputs.ScrollPos(),
			Content: v.tableView(rc.For(inner(rc, left[0])), outputs, len(v.snapshot.Sinks), "No outputs found", "is pactl installed?"),
		}.Render(rc.For(left[0]))),
		render.At(left[1], ui.Panel{
			Title: "Apps", Subtitle: fmt.Sprint(len(v.snapshot.Streams)), Focused: rc.Focused(regionApps),
			Footer: []ui.Hint{{Key: "enter", Label: "Choose output"}, {Key: "t", Label: "Test"}, {Key: "- =", Label: "±5%"}, {Key: "m", Label: "Mute"}}, Scroll: apps.ScrollPos(),
			Content: v.tableView(rc.For(inner(rc, left[1])), apps, len(v.snapshot.Streams), "Nothing is playing", "start something and it shows up here"),
		}.Render(rc.For(left[1]))),
		render.At(right[0], ui.Panel{Title: "Volume", Footer: []ui.Hint{{Key: "- =", Label: "±5%"}, {Key: "m", Label: "Mute"}}, Content: v.volume(rc.For(inner(rc, right[0])), v.renderedPane(rc))}.Render(rc.For(right[0]))),
		render.At(right[1], ui.Panel{
			Title: "Bluetooth", Subtitle: fmt.Sprint(len(v.snapshot.Bluetooth)), Focused: rc.Focused(regionBluetooth),
			Footer: []ui.Hint{{Key: "enter", Label: "(Dis)connect"}}, Scroll: bluetooth.ScrollPos(),
			Content: v.tableView(rc.For(inner(rc, right[1])), bluetooth, len(v.snapshot.Bluetooth), "No paired devices", ""),
		}.Render(rc.For(right[1]))),
		render.At(right[2], ui.Panel{Title: "Now playing", Footer: []ui.Hint{{Key: "space", Label: "Play/pause"}, {Key: "< >", Label: "Track"}}, Content: v.players(rc.For(inner(rc, right[2])))}.Render(rc.For(right[2]))),
	)
}

func (v *View) renderedPane(rc render.Context) pane {
	return focusedPane(rc.Focused)
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

func (v *View) volume(rc render.Context, p pane) string {
	t, ok := v.target(p)
	if !ok {
		return rc.Styles().Muted.Render("no output selected")
	}
	g := widgets.Gauge{Label: "volume", Value: t.volume, Max: 100}
	if t.muted {
		g.Text, g.Severity = "muted", ui.SeverityWarning
	}
	return render.Join(g.Render(rc), rc.Styles().Muted.Render(render.Truncate(t.label, rc.Rect.Width, rc.Glyphs.Ellipsis)))
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
