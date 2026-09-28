// Package sys is the system screen: temperatures, monitor brightness over
// DDC/CI and the SDDM session for the next login.
package sys

import (
	"fmt"
	"strings"

	tea "charm.land/bubbletea/v2"

	"pc/internal/modules/live"
	pcsys "pc/internal/pc/sys"
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
	regionDisplays kernel.ID = "sys.displays"
	regionSessions kernel.ID = "sys.sessions"
)

const (
	barWidth = 20
)

type request uint8

const (
	brightnessDown request = iota
	brightnessUp
	setSession
	logoutAsk
	logoutConfirmed
	rescan
)

type temperatures []pcsys.Temperature

type displays []pcsys.Display

// Module is the system screen.
type Module struct {
	source pcsys.Source
}

// New builds the screen around its source.
func New(source pcsys.Source) *Module {
	return &Module{source: source}
}

// ID names the module.
func (m *Module) ID() registry.ModuleID {
	return "sys"
}

// Register installs the route and its verbs.
func (m *Module) Register(r *registry.Registrar) {
	live.RegisterScreen(r, live.Screen{
		Route:    navigation.Route{ID: "sys", Title: "System", Order: 50},
		Key:      "5",
		Category: "System",
		Build:    func(registry.Context) registry.View { return newView(m.source) },
		Verbs: []live.Verb{
			{ID: "sys.brightness.down", Title: "Dim Display", Description: "Lower the selected display's brightness by 10%", Keys: []string{"-"}, Hint: "Brightness", Priority: 60, Msg: brightnessDown},
			{ID: "sys.brightness.up", Title: "Brighten Display", Description: "Raise the selected display's brightness by 10%", Keys: []string{"=", "+"}, Msg: brightnessUp},
			{ID: "sys.session.next", Title: "Use Session at Next Login", Description: "Preselect the session in SDDM", Keys: []string{"enter"}, Hint: "Use next login", Priority: 60, Msg: setSession},
			{ID: "sys.logout", Title: "Log Out", Description: "End the current session", Keys: []string{"L"}, Hint: "Log out", Priority: 40, Dangerous: true, Msg: logoutAsk},
			{ID: "sys.logout.confirmed", Title: "Log Out (confirmed)", Confirmed: true, Msg: logoutConfirmed},
			{ID: "sys.displays.rescan", Title: "Rescan Displays", Description: "ddcutil is slow; this takes a few seconds", Keys: []string{"r"}, Msg: rescan},
		},
	})
}

// View is the system screen.
type View struct {
	source    pcsys.Source
	temps     []pcsys.Temperature
	displays  []pcsys.Display
	sessions  []pcsys.Session
	detecting bool
	display   ui.Table
	session   ui.List
	rects     map[kernel.ID]kernel.Rect
}

func newView(source pcsys.Source) *View {
	v := &View{
		source:    source,
		sessions:  source.Sessions(),
		detecting: true,
		display: ui.NewTable([]ui.Column{
			{Title: "DISPLAY", Width: layout.Flex(1)},
			{Title: "BRIGHTNESS", Width: layout.Fixed(barWidth + 6)},
		}, nil),
		rects: map[kernel.ID]kernel.Rect{},
	}
	items := make([]ui.ListItem, len(v.sessions))
	for i, s := range v.sessions {
		items[i] = ui.ListItem{ID: kernel.ID(s.Path), Title: s.Name}
		if s.Current {
			items[i].Detail = "current"
		}
	}
	v.session = ui.NewList(items...)
	return v
}

// Init reads sensors and detects displays.
func (v *View) Init() tea.Cmd {
	return tea.Batch(v.readTemps(), v.detect())
}

func (v *View) readTemps() tea.Cmd {
	source := v.source
	return func() tea.Msg { return temperatures(source.Temperatures()) }
}

func (v *View) detect() tea.Cmd {
	source := v.source
	return func() tea.Msg { return displays(source.Displays()) }
}

// FocusRegions declares the display table and the session list.
func (v *View) FocusRegions() []focus.Region {
	return []focus.Region{
		{ID: regionDisplays, Order: 1, Label: "Displays", JumpKey: 'd', Skip: !v.detecting && len(v.displays) == 0},
		{ID: regionSessions, Order: 2, Label: "Sessions", JumpKey: 's', Skip: len(v.sessions) == 0},
	}
}

// RegionRects reports where the display table and session list were drawn.
func (v *View) RegionRects(kernel.Rect) map[kernel.ID]kernel.Rect {
	return v.rects
}

// Update folds in readings and acts on verbs. Only temperatures follow the
// refresh tick; ddcutil is too slow to poll.
func (v *View) Update(ctx registry.Context, msg tea.Msg) (registry.View, tea.Cmd) {
	next := *v
	next.display.Focused = ctx.Focus.Focused(regionDisplays)
	next.session.Focused = ctx.Focus.Focused(regionSessions)

	switch msg := msg.(type) {
	case live.Tick:
		return &next, next.readTemps()
	case temperatures:
		next.temps = msg
		return &next, nil
	case displays:
		next.detecting = false
		next.displays = msg
		next.display = next.display.SetRows(next.displayRows())
		return &next, nil
	case request:
		return next.handle(msg)
	}
	next.display, _ = next.display.Update(msg)
	next.session, _ = next.session.Update(msg)
	return &next, nil
}

func (v View) handle(r request) (registry.View, tea.Cmd) {
	source := v.source
	switch r {
	case brightnessDown, brightnessUp:
		i := v.display.Cursor()
		if i < 0 || i >= len(v.displays) || v.displays[i].Brightness < 0 {
			return &v, nil
		}
		step := pcsys.BrightnessStep
		if r == brightnessDown {
			step = -step
		}
		d := v.displays[i]
		target := min(max(d.Brightness+step, 0), 100)
		v.displays = append([]pcsys.Display(nil), v.displays...)
		v.displays[i].Brightness = target
		v.display = v.display.SetRows(v.displayRows())
		return &v, live.Action(fmt.Sprintf("Display %d brightness → %d%%", d.Number, target), func() error { return source.SetBrightness(d.Number, target) })

	case setSession:
		i := v.session.Cursor()
		if i < 0 || i >= len(v.sessions) {
			return &v, nil
		}
		s := v.sessions[i]
		return &v, live.Action("Next login → "+s.Name+" (L logs out)", func() error { return source.SetNextSession(s) })

	case logoutAsk:
		return &v, overlay.Ask("Log out", "End this session now? Unsaved work in every app is lost.", "sys.logout.confirmed", true)

	case logoutConfirmed:
		return &v, live.Action("Logging out", source.Logout)

	case rescan:
		v.detecting = true
		return &v, tea.Batch(v.readTemps(), v.detect())
	}
	return &v, nil
}

func (v View) displayRows() [][]string {
	rows := make([][]string, len(v.displays))
	for i, d := range v.displays {
		model := d.Model
		if model == "" {
			model = fmt.Sprintf("Display %d", d.Number)
		}
		level := "n/a"
		if d.Brightness >= 0 {
			level = fmt.Sprintf("%d%%", d.Brightness)
		}
		rows[i] = []string{model, level}
	}
	return rows
}

// Render lays out temperatures beside displays and sessions.
func (v *View) Render(rc render.Context) string {
	area := rc.Rect
	cols := layout.Cols(area, layout.Flex(1), layout.Flex(1))
	right := layout.Rows(cols[1], layout.Flex(1), layout.Flex(1))
	v.rects[regionDisplays] = right[0]
	v.rects[regionSessions] = right[1]

	display := v.display.SetRows(v.barRows(rc)).SetHeight(inner(rc, right[0]).Height)
	session := v.session.SetHeight(inner(rc, right[1]).Height)

	return render.Compose(area,
		render.At(cols[0], ui.Panel{Title: "Temperatures", Subtitle: fmt.Sprint(len(v.temps)), Content: v.tempView(rc.For(inner(rc, cols[0])))}.Render(rc.For(cols[0]))),
		render.At(right[0], ui.Panel{
			Title: "Displays", Focused: rc.Focused(regionDisplays), Scroll: display.ScrollPos(),
			Footer:  []ui.Hint{{Key: "- =", Label: "Brightness"}, {Key: "r", Label: "Rescan"}},
			Content: v.displayView(rc.For(inner(rc, right[0])), display),
		}.Render(rc.For(right[0]))),
		render.At(right[1], ui.Panel{
			Title: "Session", Focused: rc.Focused(regionSessions), Scroll: session.ScrollPos(),
			Footer:  []ui.Hint{{Key: "enter", Label: "Use next login"}, {Key: "L", Label: "Log out"}},
			Content: v.sessionView(rc.For(inner(rc, right[1])), session),
		}.Render(rc.For(right[1]))),
	)
}

func (v *View) barRows(rc render.Context) [][]string {
	rows := v.displayRows()
	for i, d := range v.displays {
		if d.Brightness >= 0 {
			rows[i][1] = widgets.PlainBar(rc, d.Brightness, barWidth) + render.Pad(rows[i][1], 5, render.Right)
		}
	}
	return rows
}

func (v *View) tempView(rc render.Context) string {
	if len(v.temps) == 0 {
		return ui.EmptyState{Title: "No sensor data", Hint: "is lm_sensors installed?"}.Render(rc)
	}
	width := 0
	for _, t := range v.temps {
		width = max(width, render.Width(t.Label))
	}
	width = min(width, rc.Rect.Width/2)
	lines := make([]string, len(v.temps))
	for i, t := range v.temps {
		lines[i] = widgets.Gauge{
			Label: t.Label, LabelWidth: width, Value: t.Celsius, Max: 100, NoPercent: true,
			Text: fmt.Sprintf("%d°C", t.Celsius), TextWidth: 6, Severity: widgets.Heat(t.Celsius, 60, 80),
		}.Render(rc)
	}
	return strings.Join(lines, "\n")
}

func (v *View) displayView(rc render.Context, table ui.Table) string {
	switch {
	case v.detecting:
		return ui.EmptyState{Title: "Detecting displays…", Hint: "ddcutil is slow"}.Render(rc)
	case len(v.displays) == 0:
		return ui.EmptyState{Title: "No DDC-capable displays", Hint: "r rescans"}.Render(rc)
	}
	return table.Render(rc)
}

func (v *View) sessionView(rc render.Context, list ui.List) string {
	if len(v.sessions) == 0 {
		return ui.EmptyState{Title: "No Wayland sessions installed"}.Render(rc)
	}
	note := rc.Styles().Subtle.Render(render.Truncate("compositors can't be swapped live", rc.Rect.Width, rc.Glyphs.Ellipsis))
	rows := layout.Rows(rc.Rect, layout.Flex(1), layout.Fixed(1))
	return render.Compose(rc.Rect,
		render.At(rows[0], list.SetHeight(rows[0].Height).Render(rc.For(rows[0]))),
		render.At(rows[1], note),
	)
}

func inner(rc render.Context, r kernel.Rect) kernel.Rect {
	return r.Inset(1).InsetXY(rc.Theme.Chrome.Density.Pad(), 0)
}
