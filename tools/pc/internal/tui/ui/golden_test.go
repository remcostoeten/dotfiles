package ui_test

import (
	"fmt"
	"strings"
	"testing"

	"github.com/charmbracelet/x/exp/golden"

	"pc/internal/tui/core/render"
	"pc/internal/tui/kernel"
	"pc/internal/tui/layout"
	"pc/internal/tui/theme"
	"pc/internal/tui/theme/themes"
	"pc/internal/tui/ui"
)

// widths are the three responsive bands every widget is snapshotted at.
var widths = []int{60, 80, 120}

type fakeFocus struct {
	current kernel.ID
}

func (f fakeFocus) Focused(id kernel.ID) bool {
	return f.current == id
}

func (f fakeFocus) Current() kernel.ID {
	return f.current
}

func contextFor(t theme.Theme, width, height int) render.Context {
	area := kernel.Rect{Width: width, Height: height}
	return render.NewContext(t, area, layout.BreakpointFor(area.Size()), fakeFocus{current: "focused"})
}

// snapshot renders one widget across every theme and width into a single
// golden file, so a layout regression in any band shows up as one diff.
func snapshot(t *testing.T, height int, draw func(rc render.Context) string) {
	t.Helper()

	var b strings.Builder
	for _, th := range themes.All() {
		for _, width := range widths {
			fmt.Fprintf(&b, "--- %s %dx%d ---\n", th.Name, width, height)
			b.WriteString(draw(contextFor(th, width, height)))
			b.WriteString("\n")
		}
	}
	golden.RequireEqual(t, []byte(b.String()))
}

func TestPanelGolden(t *testing.T) {
	body := "Welcome to the shell.\nAn application shell that lives in your terminal."

	t.Run("plain", func(t *testing.T) {
		snapshot(t, 8, func(rc render.Context) string {
			return ui.Panel{Title: "Overview", Content: body}.Render(rc)
		})
	})

	t.Run("focused with subtitle and hints", func(t *testing.T) {
		snapshot(t, 8, func(rc render.Context) string {
			return ui.Panel{
				Title:    "Pods",
				Subtitle: "42",
				Focused:  true,
				Footer:   []ui.Hint{{Key: "r", Label: "Refresh"}, {Key: "d", Label: "Delete"}},
				Scroll:   ui.ScrollPos{Offset: 4, Visible: 6, Total: 42},
				Content:  body,
			}.Render(rc)
		})
	})

	t.Run("title longer than the panel", func(t *testing.T) {
		snapshot(t, 4, func(rc render.Context) string {
			return ui.Panel{
				Title:    strings.Repeat("a very long title ", 12),
				Subtitle: "999",
				Content:  body,
			}.Render(rc)
		})
	})
}

func TestListGolden(t *testing.T) {
	items := []ui.ListItem{
		{ID: "one", Title: "default", Detail: "ready"},
		{ID: "two", Title: "pending", Detail: "0/1", Severity: ui.SeverityWarning},
		{ID: "three", Title: "crashloop", Detail: "3 restarts", Severity: ui.SeverityDanger},
		{ID: "four", Title: "disabled", Disabled: true},
		{ID: "five", Title: "last"},
	}

	t.Run("focused", func(t *testing.T) {
		snapshot(t, 4, func(rc render.Context) string {
			list := ui.NewList(items...)
			list.Focused = true
			list = list.SetHeight(4)
			return list.Render(rc)
		})
	})

	t.Run("empty", func(t *testing.T) {
		snapshot(t, 4, func(rc render.Context) string {
			return ui.NewList().SetHeight(4).Render(rc)
		})
	})
}

func TestTableGolden(t *testing.T) {
	columns := []ui.Column{
		{Title: "NAME", Width: layout.Flex(2)},
		{Title: "STATUS", Width: layout.Fixed(12)},
		{Title: "AGE", Width: layout.Fixed(6), Align: render.Right},
	}
	rows := [][]string{
		{"api-server-7d9f", "Running", "4d"},
		{"worker-queue-2b1a", "Pending", "17m"},
		{"scheduler-0", "CrashLoopBackOff", "2h"},
	}

	snapshot(t, 4, func(rc render.Context) string {
		table := ui.NewTable(columns, rows)
		table.Focused = true
		return table.SetHeight(4).Render(rc)
	})
}

func TestTreeGolden(t *testing.T) {
	tree := ui.NewTree(
		ui.TreeNode{ID: "src", Label: "src", Children: []ui.TreeNode{
			{ID: "src/main.go", Label: "main.go"},
			{ID: "src/ui", Label: "ui", Children: []ui.TreeNode{{ID: "src/ui/panel.go", Label: "panel.go"}}},
		}},
		ui.TreeNode{ID: "docs", Label: "docs"},
	)
	tree.Focused = true
	tree = tree.Toggle("src").SetHeight(5)

	snapshot(t, 5, tree.Render)
}

func TestStatusBarGolden(t *testing.T) {
	bar := ui.StatusBar{
		Hints: []ui.Hint{
			{Key: "tab", Label: "Focus"},
			{Key: "v", Label: "Jump"},
			{Key: "c", Label: "Cycle tabs"},
			{Key: "?", Label: "Help"},
		},
		Items:  []string{"ready"},
		Pinned: ui.Hint{Key: "ctrl+k", Label: "palette"},
	}

	snapshot(t, 1, bar.Render)
}

func TestSmallWidgetsGolden(t *testing.T) {
	t.Run("tabs", func(t *testing.T) {
		snapshot(t, 2, ui.Tabs{Items: []string{"Active", "Archived", "All"}, Active: 1, Underline: true}.Render)
	})

	t.Run("empty state", func(t *testing.T) {
		snapshot(t, 5, ui.EmptyState{Title: "No pods in this namespace", Hint: "n to switch namespace"}.Render)
	})

	t.Run("error state", func(t *testing.T) {
		snapshot(t, 5, ui.ErrorState{
			Title:  "Could not reach the cluster",
			Detail: "dial tcp 10.0.0.1:6443: connection refused",
			Retry:  ui.Hint{Key: "r", Label: "Retry"},
		}.Render)
	})

	t.Run("controls", func(t *testing.T) {
		snapshot(t, 1, func(rc render.Context) string {
			return strings.Join([]string{
				ui.Button{Label: "Apply", Focused: true}.Render(rc),
				ui.Button{Label: "Delete", Danger: true}.Render(rc),
				ui.Checkbox{Label: "Follow logs", Checked: true}.Render(rc),
				ui.Checkbox{Label: "Wrap lines"}.Render(rc),
				ui.Badge{Text: "beta", Accent: true}.Render(rc),
				ui.Spinner{Label: "Listing pods", Frame: 3}.Render(rc),
			}, " ")
		})
	})

	t.Run("sparkline", func(t *testing.T) {
		snapshot(t, 1, ui.Sparkline{Values: []float64{1, 4, 2, 8, 5, 3, 9, 6, 2, 7, 4, 1}}.Render)
	})

	t.Run("toast", func(t *testing.T) {
		snapshot(t, 1, ui.Toast{Severity: ui.SeverityDanger, Text: "Deleting pod scheduler-0 failed"}.Render)
	})
}

func TestInputGolden(t *testing.T) {
	t.Run("placeholder", func(t *testing.T) {
		snapshot(t, 1, ui.NewInput("Search commands…").Render)
	})

	t.Run("focused with a cursor", func(t *testing.T) {
		snapshot(t, 1, func(rc render.Context) string {
			in := ui.NewInput("Search commands…").SetValue("git fet")
			in.Focused = true
			return in.Render(rc)
		})
	})
}

func TestSelectGolden(t *testing.T) {
	snapshot(t, 5, func(rc render.Context) string {
		s := ui.NewSelect("Theme", "dark", "dim", "high-contrast", "ascii")
		s.Focused = true
		s = s.SetIndex(2)
		s, _ = s.Update(keyPress(" "))
		return s.Render(rc)
	})
}
