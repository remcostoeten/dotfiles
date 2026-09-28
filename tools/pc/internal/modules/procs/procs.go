// Package procs is the process screen: memory pressure and the user's largest
// processes, with terminate and force-kill.
package procs

import (
	"fmt"
	"syscall"

	tea "charm.land/bubbletea/v2"

	"pc/internal/modules/live"
	pcprocs "pc/internal/pc/procs"
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
	regionList kernel.ID = "procs.list"
)

const (
	listLimit    = 100
	historyLen   = 60
	memoryHeight = 4
)

type request uint8

const (
	terminateAsk request = iota
	forceAsk
	confirmed
)

type sample struct {
	list   []pcprocs.Process
	memory pcprocs.Memory
	err    error
}

// Module is the process screen.
type Module struct {
	source pcprocs.Source
}

// New builds the screen around its source.
func New(source pcprocs.Source) *Module {
	return &Module{source: source}
}

// ID names the module.
func (m *Module) ID() registry.ModuleID {
	return "procs"
}

// Register installs the route and its verbs.
func (m *Module) Register(r *registry.Registrar) {
	live.RegisterScreen(r, live.Screen{
		Route:    navigation.Route{ID: "procs", Title: "Processes", Order: 20},
		Key:      "2",
		Category: "Processes",
		Build:    func(registry.Context) registry.View { return newView(m.source) },
		Verbs: []live.Verb{
			{ID: "procs.terminate", Title: "Terminate Process", Description: "Send SIGTERM to the selected process", Keys: []string{"x"}, Hint: "Terminate", Priority: 60, Dangerous: true, Msg: terminateAsk},
			{ID: "procs.kill", Title: "Force Kill Process", Description: "Send SIGKILL to the selected process", Keys: []string{"X"}, Hint: "Force kill", Priority: 55, Dangerous: true, Msg: forceAsk},
			{ID: "procs.signal.confirmed", Title: "Signal Process (confirmed)", Confirmed: true, Msg: confirmed},
		},
	})
}

type pending struct {
	process pcprocs.Process
	signal  syscall.Signal
	verb    string
}

// View is the process screen.
type View struct {
	source  pcprocs.Source
	list    []pcprocs.Process
	memory  pcprocs.Memory
	ram     []float64
	err     error
	ready   bool
	pending pending
	table   ui.Table
	rects   map[kernel.ID]kernel.Rect
}

func newView(source pcprocs.Source) *View {
	return &View{
		source: source,
		table: ui.NewTable([]ui.Column{
			{Title: "PROCESS", Width: layout.Flex(1)},
			{Title: "PID", Width: layout.Fixed(8), Align: render.Right},
			{Title: "MEM", Width: layout.Fixed(7), Align: render.Right},
			{Title: "CPU", Width: layout.Fixed(5), Align: render.Right},
			{Title: "", Width: layout.Fixed(8)},
		}, nil),
		rects: map[kernel.ID]kernel.Rect{},
	}
}

// Init reads the process list.
func (v *View) Init() tea.Cmd {
	return v.fetch()
}

func (v *View) fetch() tea.Cmd {
	source := v.source
	return func() tea.Msg {
		list, err := source.List(listLimit)
		return sample{list: list, memory: source.Memory(), err: err}
	}
}

// FocusRegions declares the process table.
func (v *View) FocusRegions() []focus.Region {
	return []focus.Region{{ID: regionList, Order: 1, Label: "Processes", JumpKey: 'p'}}
}

// RegionRects reports where the process table was drawn.
func (v *View) RegionRects(kernel.Rect) map[kernel.ID]kernel.Rect {
	return v.rects
}

// Update folds in samples and acts on verbs.
func (v *View) Update(ctx registry.Context, msg tea.Msg) (registry.View, tea.Cmd) {
	next := *v
	next.table.Focused = ctx.Focus.Focused(regionList)

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
	v.list = s.list
	v.memory = s.memory
	v.ram = widgets.Push(v.ram, widgets.Percent(s.memory.UsedKB, s.memory.TotalKB), historyLen)

	rows := make([][]string, len(s.list))
	for i, p := range s.list {
		lock := ""
		if p.Protected {
			lock = "session"
		}
		rows[i] = []string{p.Command, fmt.Sprint(p.PID), pcprocs.HumanKB(p.RSSKB), fmt.Sprintf("%d%%", p.CPU), lock}
	}
	v.table = v.table.SetRows(rows)
	return &v
}

func (v View) handle(r request) (registry.View, tea.Cmd) {
	switch r {
	case terminateAsk, forceAsk:
		p, ok := v.selected()
		if !ok {
			return &v, nil
		}
		if p.Protected {
			return &v, live.Warn(p.Command + " is session-critical — killing it can end your session, refusing")
		}
		v.pending = pending{process: p, signal: syscall.SIGTERM, verb: "Terminated"}
		title, question := "Terminate process", fmt.Sprintf("Send SIGTERM to %s (%d)?", p.Command, p.PID)
		if r == forceAsk {
			v.pending = pending{process: p, signal: syscall.SIGKILL, verb: "Force-killed"}
			title, question = "Force kill process", fmt.Sprintf("Send SIGKILL to %s (%d)? It gets no chance to clean up.", p.Command, p.PID)
		}
		return &v, overlay.Ask(title, question, "procs.signal.confirmed", true)

	case confirmed:
		p := v.pending
		v.pending = pending{}
		if p.process.PID == 0 {
			return &v, nil
		}
		source := v.source
		return &v, live.Action(fmt.Sprintf("%s %s (%d)", p.verb, p.process.Command, p.process.PID),
			func() error { return source.Signal(p.process.PID, p.signal) }, v.fetch())
	}
	return &v, nil
}

func (v View) selected() (pcprocs.Process, bool) {
	i := v.table.Cursor()
	if i < 0 || i >= len(v.list) {
		return pcprocs.Process{}, false
	}
	return v.list[i], true
}

// Render lays out memory over the process table.
func (v *View) Render(rc render.Context) string {
	area := rc.Rect
	rows := layout.Rows(area, layout.Fixed(memoryHeight), layout.Flex(1))
	v.rects[regionList] = rows[1]

	table := v.table.SetHeight(inner(rc, rows[1]).Height)
	list := ui.Panel{
		Title:    "Your processes",
		Subtitle: "by memory",
		Focused:  rc.Focused(regionList),
		Footer:   []ui.Hint{{Key: "x", Label: "Terminate"}, {Key: "X", Label: "Force kill"}},
		Scroll:   table.ScrollPos(),
		Content:  v.listView(rc.For(inner(rc, rows[1])), table),
	}

	return render.Compose(area,
		render.At(rows[0], ui.Panel{Title: "Memory", Content: v.memoryView(rc.For(inner(rc, rows[0])))}.Render(rc.For(rows[0]))),
		render.At(rows[1], list.Render(rc.For(rows[1]))),
	)
}

func (v *View) listView(rc render.Context, table ui.Table) string {
	if !v.ready {
		return ""
	}
	return table.Render(rc)
}

func (v *View) memoryView(rc render.Context) string {
	switch {
	case v.err != nil:
		return ui.ErrorState{Title: "ps failed", Detail: v.err.Error()}.Render(rc)
	case !v.ready:
		return ui.EmptyState{Title: "Reading processes…"}.Render(rc)
	}
	m := v.memory
	ram := widgets.Gauge{
		Label: "ram", Value: m.UsedKB, Max: m.TotalKB,
		Text:     pcprocs.HumanKB(m.UsedKB) + " / " + pcprocs.HumanKB(m.TotalKB),
		Severity: widgets.Heat(m.UsedKB, m.TotalKB*70/100, m.TotalKB*90/100),
		Spark:    true,
		History:  v.ram,
	}
	swap := widgets.Gauge{Label: "swap", Value: m.SwapUsedKB, Max: m.SwapTotalKB, Text: "none", Spark: true}
	if m.SwapTotalKB > 0 {
		swap.Text = pcprocs.HumanKB(m.SwapUsedKB) + " / " + pcprocs.HumanKB(m.SwapTotalKB)
		swap.Severity = widgets.Heat(m.SwapUsedKB, m.SwapTotalKB/2, m.SwapTotalKB*80/100)
	}
	return render.Join(ram.Render(rc), swap.Render(rc))
}

func inner(rc render.Context, r kernel.Rect) kernel.Rect {
	return r.Inset(1).InsetXY(rc.Theme.Chrome.Density.Pad(), 0)
}
