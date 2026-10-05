// Package gpu is the GPU screen: sensors with history, power/clock/fan tuning
// and the processes holding a GPU context.
package gpu

import (
	"errors"
	"fmt"
	"strings"
	"syscall"

	tea "charm.land/bubbletea/v2"

	"pc/internal/modules/live"
	pcgpu "pc/internal/pc/gpu"
	"pc/internal/pc/procs"
	"pc/internal/tui/core/registry"
	"pc/internal/tui/core/render"
	"pc/internal/tui/focus"
	"pc/internal/tui/kernel"
	"pc/internal/tui/layout"
	navigation "pc/internal/tui/navigation"
	"pc/internal/tui/shell/overlay"
	"pc/internal/tui/ui"
	"pc/internal/widgets"
)

const (
	regionProcs kernel.ID = "gpu.procs"
)

const (
	historyLen    = 60
	tuningWidth   = 38
	sensorsHeight = 10
)

type request uint8

const (
	powerDown request = iota
	powerUp
	clockDown
	clockUp
	cycleFans
	resetAsk
	resetConfirmed
	killAsk
	killConfirmed
)

type sample struct {
	stats pcgpu.Stats
	procs []pcgpu.Process
	err   error
}

// Module is the GPU screen.
type Module struct {
	source pcgpu.Source
	procs  procs.Source
}

// New builds the screen around its source.
func New(source pcgpu.Source, processes procs.Source) *Module {
	return &Module{source: source, procs: processes}
}

// ID names the module.
func (m *Module) ID() registry.ModuleID {
	return "gpu"
}

// Register installs the route and its verbs.
func (m *Module) Register(r *registry.Registrar) {
	live.RegisterScreen(r, live.Screen{
		Route:    navigation.Route{ID: "gpu", Title: "GPU", Order: 10},
		Key:      "1",
		Category: "GPU",
		Build:    func(registry.Context) registry.View { return newView(m.source, m.procs) },
		Verbs: []live.Verb{
			{ID: "gpu.power.down", Title: "Lower Power Limit", Description: "Lower the board power limit by 10 W", Keys: []string{"-"}, Hint: "Power", Priority: 60, Msg: powerDown},
			{ID: "gpu.power.up", Title: "Raise Power Limit", Description: "Raise the board power limit by 10 W", Keys: []string{"=", "+"}, Msg: powerUp},
			{ID: "gpu.clock.down", Title: "Lower Clock Cap", Description: "Lock graphics clocks 100 MHz lower", Keys: []string{"{"}, Hint: "Clocks", Priority: 55, Msg: clockDown},
			{ID: "gpu.clock.up", Title: "Raise Clock Cap", Description: "Lock graphics clocks 100 MHz higher", Keys: []string{"}"}, Msg: clockUp},
			{ID: "gpu.fans", Title: "Cycle Fan Mode", Description: "auto → 40 → 60 → 80 → 100%", Keys: []string{"f"}, Hint: "Fans", Priority: 50, Msg: cycleFans},
			{ID: "gpu.reset", Title: "Reset GPU Tuning", Description: "Default power limit, unlocked clocks, automatic fans", Keys: []string{"r"}, Dangerous: true, Msg: resetAsk},
			{ID: "gpu.reset.confirmed", Title: "Reset GPU Tuning (confirmed)", Confirmed: true, Msg: resetConfirmed},
			{ID: "gpu.kill", Title: "Kill GPU Process", Description: "Send SIGTERM to the selected process", Keys: []string{"x"}, Hint: "Kill", Priority: 45, Dangerous: true, Msg: killAsk},
			{ID: "gpu.kill.confirmed", Title: "Kill GPU Process (confirmed)", Confirmed: true, Msg: killConfirmed},
		},
	})
}

// View is the GPU screen.
type View struct {
	source   pcgpu.Source
	signal   procs.Source
	stats    pcgpu.Stats
	procs    []pcgpu.Process
	util     []float64
	power    []float64
	temp     []float64
	clockCap int
	fanIndex int
	err      error
	ready    bool
	pending  pcgpu.Process
	table    ui.Table
	rects    map[kernel.ID]kernel.Rect
}

func newView(source pcgpu.Source, signal procs.Source) *View {
	return &View{
		source: source,
		signal: signal,
		table: ui.NewTable([]ui.Column{
			{Title: "PROCESS", Width: layout.Flex(1)},
			{Title: "PID", Width: layout.Fixed(7), Align: render.Right},
			{Title: "T", Width: layout.Fixed(1)},
			{Title: "SM", Width: layout.Fixed(4), Align: render.Right},
			{Title: "MEM", Width: layout.Fixed(4), Align: render.Right},
			{Title: "", Width: layout.Fixed(7)},
		}, nil),
		rects: map[kernel.ID]kernel.Rect{},
	}
}

// Init reads the card.
func (v *View) Init() tea.Cmd {
	return v.fetch()
}

func (v *View) fetch() tea.Cmd {
	source := v.source
	return func() tea.Msg {
		stats, err := source.Read()
		if err != nil {
			return sample{err: err}
		}
		return sample{stats: stats, procs: source.Processes()}
	}
}

// FocusRegions declares the process table.
func (v *View) FocusRegions() []focus.Region {
	return []focus.Region{{ID: regionProcs, Order: 1, Label: "Processes", JumpKey: 'p'}}
}

// RegionRects reports where the process table was drawn.
func (v *View) RegionRects(kernel.Rect) map[kernel.ID]kernel.Rect {
	return v.rects
}

// Update folds in samples and acts on verbs.
func (v *View) Update(ctx registry.Context, msg tea.Msg) (registry.View, tea.Cmd) {
	next := *v
	next.table.Focused = ctx.Focus.Focused(regionProcs)

	switch msg := msg.(type) {
	case live.Tick:
		return &next, next.fetch()
	case sample:
		return next.apply(msg), nil
	case request:
		return next.handle(msg)
	}
	next.table, _ = next.table.Update(msg)
	return &next, nil
}

func (v View) apply(s sample) *View {
	v.err = s.err
	if s.err != nil {
		return &v
	}
	v.ready = true
	v.stats = s.stats
	v.procs = s.procs
	v.util = widgets.Push(v.util, s.stats.Util, historyLen)
	v.power = widgets.Push(v.power, s.stats.Power, historyLen)
	v.temp = widgets.Push(v.temp, s.stats.Temp, historyLen)

	rows := make([][]string, len(s.procs))
	for i, p := range s.procs {
		lock := ""
		if procs.IsProtected(p.Command) {
			lock = "session"
		}
		rows[i] = []string{p.Command, fmt.Sprint(p.PID), p.Kind, fmt.Sprintf("%d%%", p.SM), fmt.Sprintf("%d%%", p.Mem), lock}
	}
	v.table = v.table.SetRows(rows)
	return &v
}

func (v View) handle(r request) (registry.View, tea.Cmd) {
	if !v.ready {
		return &v, live.Warn("GPU stats are not loaded yet")
	}
	source := v.source
	switch r {
	case powerDown, powerUp:
		step := pcgpu.PowerStep
		if r == powerDown {
			step = -step
		}
		target := min(max(v.stats.PowerLimit+step, pcgpu.MinPower), pcgpu.MaxPower)
		return &v, live.Action(fmt.Sprintf("Power limit → %d W", target), func() error { return source.SetPowerLimit(target) }, v.fetch())

	case clockDown, clockUp:
		base := v.clockCap
		if base == 0 {
			base = v.stats.ClockMax
		}
		if r == clockDown {
			v.clockCap = max(base-pcgpu.ClockStep, pcgpu.MinClock)
		} else {
			v.clockCap = min(base+pcgpu.ClockStep, v.stats.ClockMax)
		}
		target := v.clockCap
		return &v, live.Action(fmt.Sprintf("Clock cap → %d MHz", target), func() error { return source.SetClockCap(target) }, v.fetch())

	case cycleFans:
		v.fanIndex = (v.fanIndex + 1) % len(pcgpu.FanModes)
		mode := pcgpu.FanModes[v.fanIndex]
		return &v, live.Action("Fans → "+fanLabel(mode), func() error { return source.SetFans(mode) }, v.fetch())

	case resetAsk:
		return &v, overlay.Ask("Reset GPU tuning",
			fmt.Sprintf("Power limit back to %d W, clocks unlocked, fans automatic?", v.stats.PowerDefault),
			"gpu.reset.confirmed", true)

	case resetConfirmed:
		v.clockCap = 0
		v.fanIndex = 0
		def := v.stats.PowerDefault
		return &v, tea.Batch(
			live.Action(fmt.Sprintf("Power limit → %d W", def), func() error { return source.SetPowerLimit(def) }),
			live.Action("Clocks unlocked", source.ResetClocks),
			live.Action("Fans → auto", func() error { return source.SetFans("auto") }, v.fetch()),
		)

	case killAsk:
		p, ok := v.selected()
		if !ok {
			return &v, nil
		}
		if procs.IsProtected(p.Command) {
			return &v, live.Warn(p.Command + " is session-critical — killing it would end your session")
		}
		v.pending = p
		return &v, overlay.Ask("Kill GPU process", fmt.Sprintf("Send SIGTERM to %s (%d)?", p.Command, p.PID), "gpu.kill.confirmed", true)

	case killConfirmed:
		p := v.pending
		v.pending = pcgpu.Process{}
		if p.PID == 0 {
			return &v, nil
		}
		signal := v.signal
		return &v, live.Action(fmt.Sprintf("Killed %s (%d)", p.Command, p.PID), func() error { return signal.Signal(p.PID, syscall.SIGTERM) }, v.fetch())
	}
	return &v, nil
}

func (v View) selected() (pcgpu.Process, bool) {
	i := v.table.Cursor()
	if i < 0 || i >= len(v.procs) {
		return pcgpu.Process{}, false
	}
	return v.procs[i], true
}

// Render lays out sensors over the process table and the tuning panel.
func (v *View) Render(rc render.Context) string {
	area := rc.Rect
	rows := layout.Rows(area, layout.Fixed(sensorsHeight), layout.Flex(1))
	bottom := layout.Cols(rows[1], layout.Flex(1), layout.Fixed(min(tuningWidth, area.Width/3)))
	v.rects[regionProcs] = bottom[0]

	table := v.table.SetHeight(inner(rc, bottom[0]).Height)
	processes := ui.Panel{
		Title:    "Processes",
		Subtitle: fmt.Sprint(len(v.procs)),
		Focused:  rc.Focused(regionProcs),
		Footer:   []ui.Hint{{Key: "x", Label: "Kill"}},
		Scroll:   table.ScrollPos(),
		Content:  v.processes(rc.For(inner(rc, bottom[0])), table),
	}

	return render.Compose(area,
		render.At(rows[0], ui.Panel{Title: v.title(), Subtitle: v.stats.PState, Content: v.sensors(rc.For(inner(rc, rows[0])))}.Render(rc.For(rows[0]))),
		render.At(bottom[0], processes.Render(rc.For(bottom[0]))),
		render.At(bottom[1], ui.Panel{Title: "Tuning", Content: v.tuning(rc.For(inner(rc, bottom[1])))}.Render(rc.For(bottom[1]))),
	)
}

func (v *View) title() string {
	if v.stats.Name == "" {
		return "GPU"
	}
	return v.stats.Name
}

func (v *View) sensors(rc render.Context) string {
	switch {
	case v.err != nil && !v.ready:
		title := "nvidia-smi failed"
		if errors.Is(v.err, pcgpu.ErrDriverMismatch) {
			title = "Driver/library version mismatch"
		}
		return ui.ErrorState{Title: title, Detail: v.err.Error(), Retry: ui.Hint{Key: "ctrl+r", Label: "Retry"}}.Render(rc)
	case !v.ready:
		return ui.EmptyState{Title: "Reading nvidia-smi…"}.Render(rc)
	}
	s := v.stats
	powerWarn, powerHot := s.PowerLimit*70/100, s.PowerLimit*90/100
	gauges := []widgets.Gauge{
		{Label: "temp", Value: s.Temp, Max: 90, Text: fmt.Sprintf("%d°C", s.Temp), Severity: widgets.Heat(s.Temp, 65, 80), History: v.temp},
		{Label: "fan", Value: s.Fan, Max: 100, Text: "duty cycle", Severity: widgets.Heat(s.Fan, 60, 85)},
		{Label: "power", Value: s.Power, Max: s.PowerLimit, Text: fmt.Sprintf("%d / %d W", s.Power, s.PowerLimit), Severity: widgets.Heat(s.Power, powerWarn, powerHot), History: v.power},
		{Label: "util", Value: s.Util, Max: 100, History: v.util},
		{Label: "vram", Value: s.MemUsed, Max: s.MemTotal, Text: fmt.Sprintf("%d / %d MiB", s.MemUsed, s.MemTotal)},
		{Label: "clock", Value: s.Clock, Max: s.ClockMax, Text: fmt.Sprintf("%d / %d MHz", s.Clock, s.ClockMax)},
	}
	lines := make([]string, 0, len(gauges)+2)
	for _, g := range gauges {
		g.Spark = true
		lines = append(lines, g.Render(rc))
	}
	lines = append(lines, "", v.throttle(rc))
	return strings.Join(lines, "\n")
}

func (v *View) throttle(rc render.Context) string {
	st := rc.Styles()
	if len(v.stats.Throttle) == 0 {
		return st.Success.Render(rc.Glyphs.Success + " not throttling")
	}
	return st.Danger.Render(rc.Glyphs.Warning + " throttling: " + strings.Join(v.stats.Throttle, ", "))
}

func (v *View) tuning(rc render.Context) string {
	if !v.ready {
		return ""
	}
	s := v.stats
	power := widgets.Field{Label: "Power limit", Value: fmt.Sprintf("%d W", s.PowerLimit)}
	if s.PowerLimit != s.PowerDefault {
		power.Value += fmt.Sprintf(" (default %d)", s.PowerDefault)
		power.Severity = ui.SeverityWarning
	}
	clock := widgets.Field{Label: "Clock cap", Value: "unlocked"}
	if v.clockCap > 0 {
		clock = widgets.Field{Label: "Clock cap", Value: fmt.Sprintf("≤ %d MHz", v.clockCap), Severity: ui.SeverityWarning}
	}
	fans := widgets.Field{Label: "Fans", Value: fanLabel(pcgpu.FanModes[v.fanIndex])}
	if v.fanIndex > 0 {
		fans.Severity = ui.SeverityWarning
	}
	fields := widgets.Fields{power, clock, fans}.Render(rc.For(kernel.Rect{Width: rc.Rect.Width, Height: 3}))
	keys := widgets.Keys(rc, []ui.Hint{
		{Key: "- =", Label: "power ±10 W"},
		{Key: "{ }", Label: "clocks ±100 MHz"},
		{Key: "f", Label: "cycle fans"},
		{Key: "r", Label: "reset all"},
	})
	return strings.Join([]string{fields, "", keys}, "\n")
}

func (v *View) processes(rc render.Context, table ui.Table) string {
	if !v.ready {
		return ""
	}
	if len(v.procs) == 0 {
		return ui.EmptyState{Title: "Nothing is using the GPU"}.Render(rc)
	}
	return table.Render(rc)
}

func fanLabel(mode string) string {
	if mode == "auto" {
		return "auto"
	}
	return mode + "%"
}

func inner(rc render.Context, r kernel.Rect) kernel.Rect {
	return r.Inset(1).InsetXY(rc.Theme.Chrome.Density.Pad(), 0)
}
