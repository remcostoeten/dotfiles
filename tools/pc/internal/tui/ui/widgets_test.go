package ui_test

import (
	"strings"
	"testing"

	tea "charm.land/bubbletea/v2"

	"pc/internal/tui/core/render"
	"pc/internal/tui/kernel"
	"pc/internal/tui/theme/themes"
	"pc/internal/tui/ui"
)

func listOf(n int) ui.List {
	items := make([]ui.ListItem, n)
	for i := range items {
		items[i] = ui.ListItem{ID: kernel.ID(string(rune('a' + i))), Title: string(rune('a' + i))}
	}
	list := ui.NewList(items...)
	list.Focused = true
	return list.SetHeight(3)
}

func TestListCursorMovement(t *testing.T) {
	tests := []struct {
		name   string
		keys   []string
		cursor int
		offset int
	}{
		{name: "starts at the top", cursor: 0, offset: 0},
		{name: "down", keys: []string{"j"}, cursor: 1, offset: 0},
		{name: "scrolls once the cursor leaves the window", keys: []string{"j", "j", "j"}, cursor: 3, offset: 1},
		{name: "clamps at the top", keys: []string{"k", "k"}, cursor: 0, offset: 0},
		{name: "end jumps to the last item", keys: []string{"end"}, cursor: 7, offset: 5},
		{name: "home returns to the first", keys: []string{"end", "home"}, cursor: 0, offset: 0},
		{name: "page down moves a screenful", keys: []string{"pgdown"}, cursor: 3, offset: 1},
		{name: "arrow keys match hjkl", keys: []string{"down", "down"}, cursor: 2, offset: 0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			list := listOf(8)
			for _, k := range tt.keys {
				list, _ = list.Update(keyPress(k))
			}
			if list.Cursor() != tt.cursor {
				t.Errorf("cursor = %d, want %d", list.Cursor(), tt.cursor)
			}
			if got := list.ScrollPos().Offset; got != tt.offset {
				t.Errorf("offset = %d, want %d", got, tt.offset)
			}
		})
	}
}

func TestListIgnoresKeysWhenUnfocused(t *testing.T) {
	list := listOf(8)
	list.Focused = false

	list, _ = list.Update(keyPress("j"))
	if list.Cursor() != 0 {
		t.Errorf("an unfocused list moved its cursor to %d", list.Cursor())
	}
}

func TestListSetItemsClampsTheCursor(t *testing.T) {
	list := listOf(8)
	for range 7 {
		list, _ = list.Update(keyPress("j"))
	}

	list = list.SetItems([]ui.ListItem{{Title: "only"}})
	if list.Cursor() != 0 {
		t.Errorf("cursor = %d, want 0 after the list shrank", list.Cursor())
	}
	if _, ok := list.Selected(); !ok {
		t.Error("Selected() must resolve after the cursor is clamped")
	}

	empty := list.SetItems(nil)
	if _, ok := empty.Selected(); ok {
		t.Error("an empty list must have no selection")
	}
}

func TestTableCursorAccountsForItsHeaderRow(t *testing.T) {
	columns := []ui.Column{{Title: "NAME"}}
	rows := [][]string{{"a"}, {"b"}, {"c"}, {"d"}, {"e"}}

	table := ui.NewTable(columns, rows)
	table.Focused = true
	table = table.SetHeight(3)

	if got := table.ScrollPos().Visible; got != 2 {
		t.Fatalf("body height = %d, want 2 — the header takes a row", got)
	}

	for range 3 {
		table, _ = table.Update(keyPress("j"))
	}
	if got := table.ScrollPos().Offset; got != 2 {
		t.Errorf("offset = %d, want 2", got)
	}
}

func TestTreeExpandCollapse(t *testing.T) {
	tree := ui.NewTree(
		ui.TreeNode{ID: "root", Label: "root", Children: []ui.TreeNode{{ID: "child", Label: "child"}}},
		ui.TreeNode{ID: "sibling", Label: "sibling"},
	)
	tree.Focused = true
	tree = tree.SetHeight(5)

	if got := tree.ScrollPos().Total; got != 2 {
		t.Fatalf("collapsed tree has %d visible rows, want 2", got)
	}

	tree, _ = tree.Update(keyPress("right"))
	if got := tree.ScrollPos().Total; got != 3 {
		t.Fatalf("expanded tree has %d visible rows, want 3", got)
	}

	tree, _ = tree.Update(keyPress("left"))
	if got := tree.ScrollPos().Total; got != 2 {
		t.Fatalf("collapsed tree has %d visible rows, want 2", got)
	}
}

func TestTreeSelectionFollowsTheFlattenedOrder(t *testing.T) {
	tree := ui.NewTree(
		ui.TreeNode{ID: "root", Label: "root", Children: []ui.TreeNode{{ID: "child", Label: "child"}}},
		ui.TreeNode{ID: "sibling", Label: "sibling"},
	)
	tree.Focused = true
	tree = tree.Toggle("root").SetHeight(5)

	tree, _ = tree.Update(keyPress("j"))
	node, ok := tree.Selected()
	if !ok || node.ID != "child" {
		t.Fatalf("selected %q, want \"child\"", node.ID)
	}
}

func TestInputEditing(t *testing.T) {
	tests := []struct {
		name string
		keys []string
		want string
	}{
		{name: "types", keys: []string{"a", "b", "c"}, want: "abc"},
		{name: "backspace", keys: []string{"a", "b", "backspace"}, want: "a"},
		{name: "backspace at the start is inert", keys: []string{"backspace"}, want: ""},
		{name: "inserts at the cursor", keys: []string{"a", "c", "left", "b"}, want: "abc"},
		{name: "delete removes forwards", keys: []string{"a", "b", "left", "delete"}, want: "a"},
		{name: "ctrl+u cuts to the start", keys: []string{"a", "b", "c", "left", "ctrl+u"}, want: "c"},
		{name: "ctrl+k cuts to the end", keys: []string{"a", "b", "c", "left", "ctrl+k"}, want: "ab"},
		{name: "space is text, not a command", keys: []string{"a", "space", "b"}, want: "a b"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			in := ui.NewInput("")
			in.Focused = true
			for _, k := range tt.keys {
				in, _ = in.Update(keyPress(k))
			}
			if in.Value() != tt.want {
				t.Errorf("value = %q, want %q", in.Value(), tt.want)
			}
		})
	}
}

func TestInputIgnoresKeysWhenUnfocused(t *testing.T) {
	in := ui.NewInput("")
	in, _ = in.Update(keyPress("a"))
	if in.Value() != "" {
		t.Errorf("an unfocused input accepted %q", in.Value())
	}
}

func TestSelectOpensAndChooses(t *testing.T) {
	s := ui.NewSelect("Theme", "dark", "dim", "ascii")
	s.Focused = true

	if s.IsOpen() {
		t.Fatal("a select must start closed")
	}
	if got := s.Height(); got != 1 {
		t.Errorf("closed height = %d, want 1", got)
	}

	s, _ = s.Update(keyPress("enter"))
	if !s.IsOpen() {
		t.Fatal("enter must open the select")
	}
	if got := s.Height(); got != 4 {
		t.Errorf("open height = %d, want 4", got)
	}

	s, _ = s.Update(keyPress("j"))
	if s.Value() != "dim" {
		t.Errorf("value = %q, want \"dim\"", s.Value())
	}

	s, _ = s.Update(keyPress("esc"))
	if s.IsOpen() {
		t.Error("esc must close the select")
	}
}

func TestScrollAreaScrolling(t *testing.T) {
	content := strings.Join([]string{"1", "2", "3", "4", "5", "6"}, "\n")

	area := ui.NewScrollArea(content)
	area.Focused = true
	area = area.SetHeight(2)

	if area.AtBottom() {
		t.Fatal("a fresh scroll area must not report itself at the bottom")
	}

	area, _ = area.Update(keyPress("end"))
	if !area.AtBottom() {
		t.Fatal("end must scroll to the bottom")
	}
	if got := area.ScrollPos().Offset; got != 4 {
		t.Errorf("offset = %d, want 4", got)
	}

	area, _ = area.Update(tea.MouseWheelMsg{Button: tea.MouseWheelUp})
	if got := area.ScrollPos().Offset; got != 1 {
		t.Errorf("offset after a wheel-up = %d, want 1", got)
	}

	area, _ = area.Update(keyPress("home"))
	if got := area.ScrollPos().Offset; got != 0 {
		t.Errorf("offset after home = %d, want 0", got)
	}
}

func TestScrollPosIndicator(t *testing.T) {
	tests := []struct {
		name string
		pos  ui.ScrollPos
		want string
	}{
		{name: "everything fits", pos: ui.ScrollPos{Visible: 10, Total: 4}, want: ""},
		{name: "no viewport yet", pos: ui.ScrollPos{Total: 40}, want: ""},
		{name: "at the top", pos: ui.ScrollPos{Offset: 0, Visible: 4, Total: 40}, want: "[=  ]"},
		{name: "at the bottom", pos: ui.ScrollPos{Offset: 36, Visible: 4, Total: 40}, want: "[  =]"},
		{name: "in the middle", pos: ui.ScrollPos{Offset: 18, Visible: 4, Total: 40}, want: "[ = ]"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := tt.pos.Indicator(); got != tt.want {
				t.Errorf("Indicator() = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestStatusBarPinsTheEscapeHatch(t *testing.T) {
	bar := ui.StatusBar{
		Hints: []ui.Hint{
			{Key: "tab", Label: "Focus"},
			{Key: "v", Label: "Jump"},
			{Key: "c", Label: "Cycle tabs"},
			{Key: "?", Label: "Help"},
		},
		Pinned: ui.Hint{Key: "^k", Label: "palette"},
	}

	for _, width := range []int{20, 30, 40, 80} {
		rc := contextFor(themes.ASCII(), width, 1)
		got := bar.Render(rc)

		if w := render.Width(got); w != width {
			t.Fatalf("width %d: status bar rendered %d cells", width, w)
		}
		if !strings.Contains(got, "palette") {
			t.Fatalf("width %d: the pinned hint was truncated away: %q", width, got)
		}
	}
}

func TestWindowKeepsTheCursorVisible(t *testing.T) {
	tests := []struct {
		name                           string
		offset, cursor, visible, total int
		want                           int
	}{
		{name: "already visible", offset: 0, cursor: 1, visible: 3, total: 10, want: 0},
		{name: "scrolls down to reach the cursor", offset: 0, cursor: 5, visible: 3, total: 10, want: 3},
		{name: "scrolls up to reach the cursor", offset: 5, cursor: 2, visible: 3, total: 10, want: 2},
		{name: "clamps at the end", offset: 9, cursor: 9, visible: 3, total: 10, want: 7},
		{name: "no viewport", offset: 4, cursor: 4, visible: 0, total: 10, want: 0},
		{name: "no content", offset: 4, cursor: 0, visible: 3, total: 0, want: 0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := ui.Window(tt.offset, tt.cursor, tt.visible, tt.total); got != tt.want {
				t.Errorf("Window(%d, %d, %d, %d) = %d, want %d",
					tt.offset, tt.cursor, tt.visible, tt.total, got, tt.want)
			}
		})
	}
}
