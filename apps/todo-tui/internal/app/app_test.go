package app_test

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	tea "charm.land/bubbletea/v2"
	"github.com/charmbracelet/x/exp/golden"

	"todo-tui/internal/app"
	"todo-tui/internal/tui/core/config"
	"todo-tui/internal/tui/core/render"
	"todo-tui/internal/tui/core/runtime"
)

func build(t *testing.T, themeName string) runtime.Model {
	t.Helper()

	cfg := config.Defaults()
	cfg.Theme = themeName
	cfg.Mouse = false

	t.Setenv("DOTFILES_DATA_DIR", fixtureDir(t))
	t.Setenv("TODO_BIN", "false")

	m, err := app.Build(app.Options{Name: "demo", Version: "0.1.0", Config: cfg})
	if err != nil {
		t.Fatalf("Build(): %v", err)
	}
	return m
}

// resize drives the model the way the terminal would, then applies a key
// sequence, returning the model that results.
func fixtureDir(t *testing.T) string {
	t.Helper()
	dir := t.TempDir()
	if err := os.MkdirAll(filepath.Join(dir, "todo"), 0o755); err != nil {
		t.Fatal(err)
	}
	tasks := `[
  {"id":"2","description":"ship release","status":"pending","priority":"high","createdAt":1,"updatedAt":1,"kind":"epic"},
  {"id":"3","description":"write notes","status":"pending","priority":"none","createdAt":2,"updatedAt":2,"parentId":"2"},
  {"id":"4","description":"old chore","status":"completed","priority":"none","createdAt":3,"updatedAt":3}
]`
	if err := os.WriteFile(filepath.Join(dir, "todo", "tasks.json"), []byte(tasks), 0o644); err != nil {
		t.Fatal(err)
	}
	return dir
}

func resize(t *testing.T, m runtime.Model, w, h int, keys ...string) runtime.Model {
	t.Helper()

	model := drain(m, m.Init())
	model, _ = model.Update(tea.WindowSizeMsg{Width: w, Height: h})
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
		msg := cmd()
		if msg == nil {
			return model
		}
		if batch, ok := msg.(tea.BatchMsg); ok {
			for _, c := range batch {
				model = drain(model, c)
			}
			return model
		}
		model, cmd = model.Update(msg)
	}
	return model
}

func TestBuildSucceedsWithNoKeymapConflicts(t *testing.T) {
	build(t, "dark")
}

func TestBuildRejectsAnUnknownTheme(t *testing.T) {
	cfg := config.Defaults()
	cfg.Theme = "does-not-exist"

	m, err := app.Build(app.Options{Name: "demo", Config: cfg})
	if err != nil {
		t.Fatalf("an unknown theme must fall back, not fail: %v", err)
	}
	if got := m.Theme().Name; got != "dark" {
		t.Errorf("theme = %q, want the default \"dark\"", got)
	}
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

func TestStartsOnTheBoard(t *testing.T) {
	m := resize(t, build(t, "dark"), 120, 40)
	if got := string(m.Route().Route); got != "board" {
		t.Errorf("route = %q, want \"board\"", got)
	}
}

func TestTabCyclesFocusWithinTheRoute(t *testing.T) {
	m := resize(t, build(t, "dark"), 120, 40)
	first := m.Focus().Current()

	m = resize(t, build(t, "dark"), 120, 40, "tab")
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
	if got := string(m.Route().Route); got != "board" {
		t.Errorf("route = %q, want \"board\" — esc has nowhere to go at the root", got)
	}
}

func TestDangerousCommandAsksFirst(t *testing.T) {
	m := resize(t, build(t, "dark"), 120, 40, "d")
	if got := m.Overlay(); got != "confirm" {
		t.Fatalf("overlay = %q, want \"confirm\" — a dangerous command must ask", got)
	}
	if !strings.Contains(m.Render(), "Delete #2 and 1 subtask") {
		t.Errorf("the confirmation did not name the subtree:\n%s", m.Render())
	}
}

func TestBoardShowsTheTaskTree(t *testing.T) {
	frame := resize(t, build(t, "ascii"), 120, 40).Render()
	for _, want := range []string{"ship release", "write notes", "[0/1]", "#3"} {
		if !strings.Contains(frame, want) {
			t.Errorf("the board is missing %q:\n%s", want, frame)
		}
	}
	if strings.Contains(frame, "old chore") {
		t.Error("a completed task leaked into the open list")
	}
}

func TestSplitShowsBoardsSideBySide(t *testing.T) {
	m := build(t, "ascii")
	boards := `{"active":"werk","boards":[{"name":"werk","createdAt":0,"now":["2"],"later":[]},{"name":"thuis","createdAt":0,"now":[],"later":[]}]}`
	if err := os.WriteFile(filepath.Join(os.Getenv("DOTFILES_DATA_DIR"), "todo", "boards.json"), []byte(boards), 0o644); err != nil {
		t.Fatal(err)
	}
	m = resize(t, m, 140, 40, "|")
	frame := m.Render()
	for _, want := range []string{"werk · Now", "thuis · Now", "ship release"} {
		if !strings.Contains(frame, want) {
			t.Errorf("the split is missing %q:\n%s", want, frame)
		}
	}
	if got := m.Focus().Current(); got != "board.split" {
		t.Errorf("focus = %q, want the new pane", got)
	}
	m = resize(t, m, 140, 40, "|")
	if frame := m.Render(); !strings.Contains(frame, "werk · Now") || !strings.Contains(frame, "thuis · Later") {
		t.Errorf("| again must open a third pane:\n%s", frame)
	}
	if frame := resize(t, m, 140, 40, "|").Render(); strings.Contains(frame, "werk · Now") || strings.Contains(frame, "thuis · Now") {
		t.Errorf("| with three panes must close the split, keeping the pane in use:\n%s", frame)
	}
}

func TestAddPromptCapturesKeys(t *testing.T) {
	m := resize(t, build(t, "ascii"), 120, 40, "a", "q", "v")
	if m.Overlay() != "" {
		t.Fatalf("typing into the prompt opened %q", m.Overlay())
	}
	if !strings.Contains(m.Render(), "qv") {
		t.Errorf("the prompt did not receive the typed keys:\n%s", m.Render())
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
