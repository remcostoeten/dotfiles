package todo

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func tasks() []Task {
	return []Task{
		{ID: "1", Description: "epic", Status: "pending", CreatedAt: 1, Kind: "epic"},
		{ID: "2", Description: "child a", Status: "completed", CreatedAt: 2, ParentID: "1"},
		{ID: "3", Description: "child b", Status: "pending", CreatedAt: 3, ParentID: "1"},
		{ID: "4", Description: "grandchild", Status: "pending", CreatedAt: 4, ParentID: "3"},
	}
}

func TestBuildRowsNestsAndCountsProgress(t *testing.T) {
	all := tasks()
	rows := BuildRows(all, all, nil)
	if len(rows) != 4 {
		t.Fatalf("rows = %d, want 4", len(rows))
	}
	if rows[0].Done != 1 || rows[0].Total != 3 {
		t.Errorf("epic progress = %d/%d, want 1/3", rows[0].Done, rows[0].Total)
	}
	if got := rows[3].Prefix(); got != "   └─ " {
		t.Errorf("grandchild prefix = %q", got)
	}
}

func TestCollapsedRowHidesItsSubtree(t *testing.T) {
	all := tasks()
	rows := BuildRows(all, all, map[string]bool{"1": true})
	if len(rows) != 1 || !rows[0].Collapsed {
		t.Fatalf("collapsed epic should render alone, got %d rows", len(rows))
	}
}

func TestOrphanedMatchBecomesARoot(t *testing.T) {
	all := tasks()
	rows := BuildRows(Search(Filter(all, "all", time.Now()), "grand"), all, nil)
	if len(rows) != 1 || rows[0].Depth != 0 {
		t.Fatalf("a filtered child must surface as a root, got %+v", rows)
	}
}

func TestPatchKeepsUnmodelledFields(t *testing.T) {
	path := filepath.Join(t.TempDir(), "tasks.json")
	raw := `[{"id":"1","description":"x","status":"completed","priority":"none","createdAt":1,"updatedAt":1,"reminderOffsets":[10],"notificationsSent":{"reminders":[],"overdue":false}}]`
	if err := os.WriteFile(path, []byte(raw), 0o644); err != nil {
		t.Fatal(err)
	}
	store := &Store{Path: path}
	if err := store.Patch("1", map[string]any{"status": "pending"}); err != nil {
		t.Fatal(err)
	}
	out, _ := os.ReadFile(path)
	for _, want := range []string{`"reminderOffsets"`, `"notificationsSent"`, `"status": "pending"`} {
		if !strings.Contains(string(out), want) {
			t.Errorf("patched file lost %s:\n%s", want, out)
		}
	}
	loaded, err := store.Load()
	if err != nil || !loaded[0].Pending() {
		t.Errorf("reload = %+v, %v", loaded, err)
	}
}
