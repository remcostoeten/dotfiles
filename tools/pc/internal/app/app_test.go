package app_test

import (
	"reflect"
	"slices"
	"strings"
	"testing"
	"time"

	tea "charm.land/bubbletea/v2"
	"github.com/charmbracelet/x/exp/golden"

	"pc/internal/app"
	"pc/internal/pc/pcfake"
	"pc/internal/tui/core/config"
	"pc/internal/tui/core/render"
	"pc/internal/tui/core/runtime"
)

func build(t *testing.T, themeName string) runtime.Model {
	t.Helper()
	m, _ := buildRecorded(t, themeName)
	return m
}

func buildRecorded(t *testing.T, themeName string) (runtime.Model, *pcfake.Recorder) {
	t.Helper()

	cfg := config.Defaults()
	cfg.Theme = themeName
	cfg.Mouse = false

	system, rec := pcfake.New()
	m, err := app.Build(app.Options{Name: "pc", Version: "0.1.0", Config: cfg, System: system})
	if err != nil {
		t.Fatalf("Build(): %v", err)
	}
	return m, rec
}

// resize drives the model the way the terminal would, loads the first screen,
// then applies a key sequence, returning the model that results.
func resize(t *testing.T, m runtime.Model, w, h int, keys ...string) runtime.Model {
	t.Helper()

	model, _ := m.Update(tea.WindowSizeMsg{Width: w, Height: h})
	model = drain(model, m.ActiveView().Init())
	for _, k := range keys {
		next, cmd := model.Update(keyPress(k))
		model = drain(next, cmd)
	}
	return model.(runtime.Model)
}

// drain runs the commands a message produced and feeds the results back, the
// way the event loop does, so a test sees the state the user would.
func drain(model tea.Model, cmd tea.Cmd) tea.Model {
	for range 8 {
		if cmd == nil {
			return model
		}
		msg := settle(cmd)
		if msg == nil {
			return model
		}
		if cmds, ok := compound(msg); ok {
			for _, c := range cmds {
				model = drain(model, c)
			}
			return model
		}
		model, cmd = model.Update(msg)
	}
	return model
}

// settle runs a command, abandoning timers: a toast's expiry tick would
// otherwise stall the test and then delete the toast it wants to read.
func settle(cmd tea.Cmd) tea.Msg {
	done := make(chan tea.Msg, 1)
	go func() { done <- cmd() }()
	select {
	case msg := <-done:
		return msg
	case <-time.After(200 * time.Millisecond):
		return nil
	}
}

// compound unpacks tea.Batch and tea.Sequence results. Sequence's message type
// is unexported, so it is recognised by shape.
func compound(msg tea.Msg) ([]tea.Cmd, bool) {
	if batch, ok := msg.(tea.BatchMsg); ok {
		return batch, true
	}
	v := reflect.ValueOf(msg)
	if v.Kind() != reflect.Slice || v.Type().Elem() != reflect.TypeFor[tea.Cmd]() {
		return nil, false
	}
	cmds := make([]tea.Cmd, v.Len())
	for i := range cmds {
		cmds[i], _ = v.Index(i).Interface().(tea.Cmd)
	}
	return cmds, true
}

func TestBuildSucceedsWithNoKeymapConflicts(t *testing.T) {
	build(t, "dark")
}

func TestFrameFillsTheTerminal(t *testing.T) {
	sizes := []struct{ w, h int }{
		{60, 20}, {80, 24}, {120, 40}, {200, 60},
	}

	for _, size := range sizes {
		m := resize(t, build(t, "dark"), size.w, size.h)
		lines := render.Lines(m.Render())

		if len(lines) != size.h {
			t.Fatalf("%dx%d: frame is %d rows, want %d", size.w, size.h, len(lines), size.h)
		}
		for i, l := range lines {
			if w := render.Width(l); w > size.w {
				t.Fatalf("%dx%d: row %d is %d cells, want at most %d", size.w, size.h, i, w, size.w)
			}
		}
	}
}

func TestTerminalTooSmall(t *testing.T) {
	m := resize(t, build(t, "ascii"), 30, 8)
	if !strings.Contains(m.Render(), "too small") {
		t.Errorf("a terminal below the minimum must say so, got:\n%s", m.Render())
	}
}

func TestNavigationChangesTheRoute(t *testing.T) {
	tests := []struct {
		name string
		keys []string
		want string
	}{
		{name: "starts on the gpu", want: "gpu"},
		{name: "next section", keys: []string{"]"}, want: "procs"},
		{name: "twice", keys: []string{"]", "]"}, want: "rgb"},
		{name: "wraps", keys: []string{"]", "]", "]", "]", "]"}, want: "gpu"},
		{name: "previous wraps backwards", keys: []string{"["}, want: "sys"},
		{name: "number jumps", keys: []string{"4"}, want: "audio"},
		{name: "number jumps back", keys: []string{"5", "1"}, want: "gpu"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			m := resize(t, build(t, "dark"), 120, 40, tt.keys...)
			if got := string(m.Route().Route); got != tt.want {
				t.Errorf("route = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestTabCyclesFocusWithinTheRoute(t *testing.T) {
	m := resize(t, build(t, "dark"), 120, 40, "4")
	first := m.Focus().Current()

	m = resize(t, build(t, "dark"), 120, 40, "4", "tab")
	second := m.Focus().Current()

	if first == second {
		t.Fatalf("tab did not move focus; it stayed on %q", first)
	}
	if first.IsZero() || second.IsZero() {
		t.Fatalf("focus landed nowhere: %q then %q", first, second)
	}
}

func TestPaletteOpensAndCloses(t *testing.T) {
	m := resize(t, build(t, "dark"), 120, 40, "ctrl+k")
	if got := m.Overlay(); got != "palette" {
		t.Fatalf("overlay = %q, want \"palette\"", got)
	}
	if !strings.Contains(m.Render(), "Commands") {
		t.Error("the palette did not draw over the frame")
	}
	if got := m.Focus().Depth(); got != 2 {
		t.Errorf("focus depth = %d, want 2 — the overlay must trap focus", got)
	}

	m = resize(t, build(t, "dark"), 120, 40, "ctrl+k", "esc")
	if got := m.Overlay(); got != "" {
		t.Errorf("overlay = %q, want none after esc", got)
	}
	if got := m.Focus().Depth(); got != 1 {
		t.Errorf("focus depth = %d, want 1 restored", got)
	}
}

func TestHelpIsGeneratedFromTheRegistry(t *testing.T) {
	m := resize(t, build(t, "ascii"), 120, 40, "?")
	frame := m.Render()

	for _, want := range []string{"Command Palette", "Quit", "APPLICATION", "ctrl+k"} {
		if !strings.Contains(frame, want) {
			t.Errorf("the help overlay is missing %q", want)
		}
	}
}

func TestThemeCycling(t *testing.T) {
	tests := []struct {
		presses int
		want    string
	}{
		{presses: 0, want: "dark"},
		{presses: 1, want: "dim"},
		{presses: 2, want: "high-contrast"},
		{presses: 3, want: "ascii"},
		{presses: 4, want: "dark"},
	}

	for _, tt := range tests {
		keys := make([]string, tt.presses)
		for i := range keys {
			keys[i] = "ctrl+t"
		}
		m := resize(t, build(t, "dark"), 120, 40, keys...)
		if got := m.Theme().Name; got != tt.want {
			t.Errorf("after %d presses theme = %q, want %q", tt.presses, got, tt.want)
		}
	}
}

func TestEscAtTheRootDoesNotNavigate(t *testing.T) {
	m := resize(t, build(t, "dark"), 120, 40, "esc")
	if got := string(m.Route().Route); got != "gpu" {
		t.Errorf("route = %q, want \"gpu\" — esc has nowhere to go at the root", got)
	}
}

func TestTerminatingAProcessAsksFirst(t *testing.T) {
	m, rec := buildRecorded(t, "dark")
	m = resize(t, m, 120, 40, "2", "x")
	if got := m.Overlay(); got != "confirm" {
		t.Fatalf("overlay = %q, want \"confirm\" — a dangerous command must ask", got)
	}
	if !strings.Contains(m.Render(), "SIGTERM to firefox") {
		t.Error("the confirmation does not name the target")
	}
	if len(rec.Calls()) != 0 {
		t.Fatalf("signalled before confirming: %v", rec.Calls())
	}

	resize(t, m, 120, 40, "y")
	if want := []string{"signal 2001 15"}; !slices.Equal(rec.Calls(), want) {
		t.Errorf("calls = %v, want %v", rec.Calls(), want)
	}
}

func TestSessionCriticalProcessesAreRefused(t *testing.T) {
	m, rec := buildRecorded(t, "dark")
	m = resize(t, m, 120, 40, "2", "G", "X")
	if got := m.Overlay(); got != "" {
		t.Errorf("overlay = %q, want none for a protected process", got)
	}
	if !strings.Contains(m.Render(), "session-critical") {
		t.Error("refusing did not explain why")
	}
	if len(rec.Calls()) != 0 {
		t.Errorf("calls = %v, want none", rec.Calls())
	}
}

func TestScreenVerbsReachTheMachine(t *testing.T) {
	tests := []struct {
		name string
		keys []string
		want []string
	}{
		{name: "gpu power down", keys: []string{"-"}, want: []string{"gpu.power 210"}},
		{name: "gpu power up is capped", keys: []string{"+"}, want: []string{"gpu.power 220"}},
		{name: "gpu clock cap", keys: []string{"{", "{"}, want: []string{"gpu.clock 2000", "gpu.clock 1900"}},
		{name: "gpu fans cycle", keys: []string{"f", "f"}, want: []string{"gpu.fans 40", "gpu.fans 60"}},
		{name: "rgb colours the selected device", keys: []string{"3", "j", "p"}, want: []string{"rgb 1 AA00FF"}},
		{name: "rgb all off", keys: []string{"3", "X"}, want: []string{"rgb all 000000"}},
		{name: "audio default output", keys: []string{"4", "j", "enter"}, want: []string{"audio.default hdmi"}},
		{name: "audio bluetooth toggles", keys: []string{"4", "tab", "enter"}, want: []string{"audio.bluetooth AA:BB false"}},
		{name: "audio volume and media", keys: []string{"4", "-", "=", "m", "space", ">"}, want: []string{"audio.volume -5", "audio.volume +5", "audio.mute", "audio.media play-pause", "audio.media next"}},
		{name: "sys brightness", keys: []string{"5", "="}, want: []string{"sys.brightness 1 80"}},
		{name: "sys next session", keys: []string{"5", "tab", "j", "enter"}, want: []string{"sys.session /s/hyprland.desktop"}},
		{name: "sys logout confirms", keys: []string{"5", "L", "y"}, want: []string{"sys.logout"}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			m, rec := buildRecorded(t, "dark")
			resize(t, m, 120, 40, tt.keys...)
			if got := rec.Calls(); !slices.Equal(got, tt.want) {
				t.Errorf("calls = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestEveryScreenRenders(t *testing.T) {
	for key, want := range map[string]string{"1": "Tuning", "2": "Your processes", "3": "Colours", "4": "Now playing", "5": "Temperatures"} {
		m := resize(t, build(t, "ascii"), 120, 40, key)
		if frame := m.Render(); !strings.Contains(frame, want) {
			t.Errorf("screen %s is missing %q:\n%s", key, want, frame)
		}
	}
}

func TestJumpModeBadgesEveryRegion(t *testing.T) {
	m := resize(t, build(t, "ascii"), 120, 40, "v")
	if got := m.Overlay(); got != "jump" {
		t.Fatalf("overlay = %q, want \"jump\"", got)
	}

	frame := m.Render()
	if !strings.Contains(frame, "Processes") {
		t.Error("jump mode painted over the frame instead of badging it")
	}
}

func TestEveryCommandIsReachable(t *testing.T) {
	m := resize(t, build(t, "dark"), 120, 40)
	ctx := m.Context()

	commands := ctx.Commands.All()
	if len(commands) == 0 {
		t.Fatal("no commands were registered")
	}

	// The palette is always bound, and it lists everything available, so a
	// command is reachable as long as it carries a title to find it by.
	for _, c := range commands {
		if c.Title == "" {
			t.Errorf("command %q has no title, so the palette cannot offer it", c.ID)
		}
		if c.Run == nil {
			t.Errorf("command %q has no implementation", c.ID)
		}
	}
}

func TestFrameGolden(t *testing.T) {
	var b strings.Builder
	for _, size := range []struct{ w, h int }{{80, 24}, {120, 40}} {
		for _, name := range []string{"dark", "ascii"} {
			m := resize(t, build(t, name), size.w, size.h)
			b.WriteString("--- " + name + " ---\n")
			b.WriteString(m.Render())
			b.WriteString("\n")
		}
	}
	golden.RequireEqual(t, []byte(b.String()))
}
