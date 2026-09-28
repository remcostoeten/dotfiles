// Package rgb is the lighting screen: openrgb devices and one-key colours.
package rgb

import (
	"fmt"
	"strings"

	tea "charm.land/bubbletea/v2"
	lipgloss "charm.land/lipgloss/v2"

	"pc/internal/modules/live"
	pcrgb "pc/internal/pc/rgb"
	"pc/internal/tui/command"
	"pc/internal/tui/core/registry"
	"pc/internal/tui/core/render"
	"pc/internal/tui/focus"
	"pc/internal/tui/kernel"
	"pc/internal/tui/layout"
	navigation "pc/internal/tui/navigation"
	"pc/internal/tui/theme"
	"pc/internal/tui/ui"
)

const (
	regionDevices kernel.ID = "rgb.devices"
)

const (
	paletteWidth = 30
)

type paint struct {
	hex  string
	name string
	all  bool
}

type rescan struct{}

type scan struct {
	devices []pcrgb.Device
	err     error
}

// Module is the lighting screen.
type Module struct {
	source pcrgb.Source
}

// New builds the screen around its source.
func New(source pcrgb.Source) *Module {
	return &Module{source: source}
}

// ID names the module.
func (m *Module) ID() registry.ModuleID {
	return "rgb"
}

// Register installs the route and its verbs.
func (m *Module) Register(r *registry.Registrar) {
	verbs := make([]live.Verb, 0, len(pcrgb.Presets)+3)
	for i, c := range pcrgb.Presets {
		v := live.Verb{
			ID: command.ID("rgb.color." + strings.ToLower(c.Name)), Title: "Set Device " + c.Name,
			Description: "Set the selected device to #" + c.Hex, Keys: []string{c.Key},
			Msg: paint{hex: c.Hex, name: c.Name},
		}
		if i == 0 {
			v.Hint, v.Priority = "Colour", 60
		}
		verbs = append(verbs, v)
	}
	verbs = append(verbs,
		live.Verb{ID: "rgb.off", Title: "Turn Device Off", Keys: []string{"x"}, Hint: "Off", Priority: 55, Msg: paint{hex: pcrgb.Off, name: "off"}},
		live.Verb{ID: "rgb.all.off", Title: "Turn All Lighting Off", Keys: []string{"X"}, Hint: "All off", Priority: 50, Msg: paint{hex: pcrgb.Off, name: "off", all: true}},
		live.Verb{ID: "rgb.all.white", Title: "Set All Lighting White", Keys: []string{"W"}, Msg: paint{hex: "FFFFFF", name: "White", all: true}},
		live.Verb{ID: "rgb.rescan", Title: "Rescan RGB Devices", Description: "openrgb is slow; this takes a few seconds", Keys: []string{"R"}, Msg: rescan{}},
	)

	live.RegisterScreen(r, live.Screen{
		Route:    navigation.Route{ID: "rgb", Title: "RGB", Order: 30},
		Key:      "3",
		Category: "RGB",
		Build:    func(registry.Context) registry.View { return newView(m.source) },
		Verbs:    verbs,
	})
}

// View is the lighting screen.
type View struct {
	source   pcrgb.Source
	devices  []pcrgb.Device
	scanning bool
	err      error
	table    ui.Table
	rects    map[kernel.ID]kernel.Rect
}

func newView(source pcrgb.Source) *View {
	return &View{
		source:   source,
		scanning: true,
		table: ui.NewTable([]ui.Column{
			{Title: "#", Width: layout.Fixed(3), Align: render.Right},
			{Title: "DEVICE", Width: layout.Flex(1)},
			{Title: "TYPE", Width: layout.Fixed(12)},
		}, nil),
		rects: map[kernel.ID]kernel.Rect{},
	}
}

// Init scans for devices. The list does not change on its own, so the screen
// ignores the refresh tick and rescans only when asked.
func (v *View) Init() tea.Cmd {
	return v.scan()
}

func (v *View) scan() tea.Cmd {
	source := v.source
	return func() tea.Msg {
		devices, err := source.Devices()
		return scan{devices: devices, err: err}
	}
}

// FocusRegions declares the device table.
func (v *View) FocusRegions() []focus.Region {
	return []focus.Region{{ID: regionDevices, Order: 1, Label: "Devices", JumpKey: 'd'}}
}

// RegionRects reports where the device table was drawn.
func (v *View) RegionRects(kernel.Rect) map[kernel.ID]kernel.Rect {
	return v.rects
}

// Update folds in scans and acts on verbs.
func (v *View) Update(ctx registry.Context, msg tea.Msg) (registry.View, tea.Cmd) {
	next := *v
	next.table.Focused = ctx.Focus.Focused(regionDevices)

	switch msg := msg.(type) {
	case scan:
		next.scanning = false
		next.err = msg.err
		next.devices = msg.devices
		rows := make([][]string, len(msg.devices))
		for i, d := range msg.devices {
			rows[i] = []string{fmt.Sprint(d.Index), d.Name, strings.ToLower(d.Kind)}
		}
		next.table = next.table.SetRows(rows)
		return &next, nil
	case rescan:
		next.scanning = true
		return &next, next.scan()
	case paint:
		return &next, next.paint(msg)
	}
	next.table, _ = next.table.Update(msg)
	return &next, nil
}

func (v View) paint(p paint) tea.Cmd {
	source := v.source
	if p.all {
		return live.Action("All lighting → "+strings.ToLower(p.name), func() error { return source.SetAll(p.hex) })
	}
	i := v.table.Cursor()
	if i < 0 || i >= len(v.devices) {
		return nil
	}
	d := v.devices[i]
	return live.Action(d.Name+" → "+strings.ToLower(p.name), func() error { return source.SetDevice(d.Index, p.hex) })
}

// Render lays out the device table beside the colour legend.
func (v *View) Render(rc render.Context) string {
	area := rc.Rect
	cols := layout.Cols(area, layout.Flex(1), layout.Fixed(paletteWidth))
	v.rects[regionDevices] = cols[0]

	table := v.table.SetHeight(inner(rc, cols[0]).Height)
	devices := ui.Panel{
		Title:    "Devices",
		Subtitle: fmt.Sprint(len(v.devices)),
		Focused:  rc.Focused(regionDevices),
		Footer:   []ui.Hint{{Key: "R", Label: "Rescan"}},
		Scroll:   table.ScrollPos(),
		Content:  v.devicesView(rc.For(inner(rc, cols[0])), table),
	}

	return render.Compose(area,
		render.At(cols[0], devices.Render(rc.For(cols[0]))),
		render.At(cols[1], ui.Panel{Title: "Colours", Content: v.legend(rc)}.Render(rc.For(cols[1]))),
	)
}

func (v *View) devicesView(rc render.Context, table ui.Table) string {
	switch {
	case v.scanning:
		return ui.EmptyState{Title: "Scanning with openrgb…", Hint: "it is slow, hang on"}.Render(rc)
	case v.err != nil:
		return ui.ErrorState{Title: "openrgb failed", Detail: v.err.Error(), Retry: ui.Hint{Key: "R", Label: "Rescan"}}.Render(rc)
	case len(v.devices) == 0:
		return ui.EmptyState{Title: "No RGB devices found", Hint: "R rescans"}.Render(rc)
	}
	return table.Render(rc)
}

func (v *View) legend(rc render.Context) string {
	st := rc.Styles()
	lines := make([]string, 0, len(pcrgb.Presets)+6)
	for _, c := range pcrgb.Presets {
		lines = append(lines, swatch(rc, c.Hex)+" "+st.KeyHintKey.Render(c.Key)+"  "+st.KeyHintLabel.Render(c.Name))
	}
	lines = append(lines,
		"",
		st.KeyHintKey.Render("x")+"  "+st.KeyHintLabel.Render("device off"),
		st.KeyHintKey.Render("X")+"  "+st.KeyHintLabel.Render("all off"),
		st.KeyHintKey.Render("W")+"  "+st.KeyHintLabel.Render("all white"),
	)
	return strings.Join(lines, "\n")
}

// swatch shows the preset in the colour it sets the LEDs to — data, not a
// theme hue — falling back to a plain glyph when the theme has no colour.
func swatch(rc render.Context, hex string) string {
	block := rc.Glyphs.Bullet
	if rc.Theme.Mono {
		return block
	}
	return lipgloss.NewStyle().Foreground(theme.Color("#" + hex)).Render(block)
}

func inner(rc render.Context, r kernel.Rect) kernel.Rect {
	return r.Inset(1).InsetXY(rc.Theme.Chrome.Density.Pad(), 0)
}
