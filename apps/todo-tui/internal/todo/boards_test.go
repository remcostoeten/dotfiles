package todo

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func boardTasks() []Task {
	return []Task{
		{ID: "1", Status: "pending", Kind: "epic"},
		{ID: "2", Status: "pending", ParentID: "1"},
		{ID: "3", Status: "pending"},
		{ID: "4", Status: "completed"},
		{ID: "5", Status: "pending", ParentID: "2"},
	}
}

func TestLanesFollowTheNearestListedAncestor(t *testing.T) {
	all := boardTasks()
	b := Board{Name: "werk", Now: []string{"1", "4"}, Later: []string{"2", "3"}}

	if got := b.LaneOf(all, "5"); got != LaneLater {
		t.Errorf("#5 follows #2 into later, got %q", got)
	}
	if got := b.LaneOf(all, "1"); got != LaneNow {
		t.Errorf("#1 is listed in now, got %q", got)
	}
	if !b.Listed("2") || b.Listed("5") {
		t.Error("only ids named in a lane are listed")
	}
	if got := len(b.Members(all)); got != 5 {
		t.Errorf("members = %d, want 5", got)
	}
	now := FilterLane(all, b, LaneNow)
	if len(now) != 1 || now[0].ID != "1" {
		t.Errorf("Now lane = %v, want only the pending epic", now)
	}
	if later := FilterLane(all, b, LaneLater); len(later) != 3 {
		t.Errorf("Later lane = %v, want #2, #3 and #5", later)
	}
}

func TestBoardsFindActiveAndExpiry(t *testing.T) {
	now := time.Now()
	s := Boards{Active: "Sprint", Boards: []Board{
		{Name: "sprint", ExpiresAt: now.Add(-time.Minute).UnixMilli()},
		{Name: "werk"},
	}}
	if b, ok := s.ActiveBoard(); !ok || b.Name != "sprint" {
		t.Fatalf("active lookup ignores case, got %+v %v", b, ok)
	}
	if !s.AnyExpired(now) {
		t.Fatal("an expired timed board must be reported")
	}
	live := s.Live(now)
	if len(live.Boards) != 1 || live.Active != "" {
		t.Fatalf("Live must drop the expired board and its active mark: %+v", live)
	}
	if (Board{}).Expired(now) {
		t.Error("untimed boards never expire")
	}
	if got := (Board{ExpiresAt: now.Add(90 * time.Minute).UnixMilli()}).Remaining(now).Round(time.Minute); got != 90*time.Minute {
		t.Errorf("remaining = %v", got)
	}
}

func TestParseTimedSpec(t *testing.T) {
	tests := []struct {
		spec  string
		want  time.Duration
		title string
		err   bool
	}{
		{spec: "4h", want: 4 * time.Hour},
		{spec: "90m deploy day", want: 90 * time.Minute, title: "deploy day"},
		{spec: "2h30m", want: 150 * time.Minute},
		{spec: "1.5 bugs", want: 90 * time.Minute, title: "bugs"},
		{spec: "25h", err: true},
		{spec: "10s", err: true},
		{spec: "soon", err: true},
		{spec: "", err: true},
	}
	for _, tt := range tests {
		d, title, err := ParseTimedSpec(tt.spec)
		if (err != nil) != tt.err {
			t.Errorf("%q: err = %v, want error %v", tt.spec, err, tt.err)
			continue
		}
		if d != tt.want || title != tt.title {
			t.Errorf("%q = (%v, %q), want (%v, %q)", tt.spec, d, title, tt.want, tt.title)
		}
	}
}

func TestBoardStoreLoadsAndSpotsALegacyFocusFile(t *testing.T) {
	dir := t.TempDir()
	store := &BoardStore{Path: filepath.Join(dir, "boards.json")}
	if b, err := store.Load(); err != nil || len(b.Boards) != 0 {
		t.Fatalf("missing file must be no boards, got %+v, %v", b, err)
	}
	if store.NeedsMigration() {
		t.Fatal("nothing to migrate without focus.json")
	}
	if err := os.WriteFile(filepath.Join(dir, "focus.json"), []byte(`{"startedAt":1,"expiresAt":2}`), 0o644); err != nil {
		t.Fatal(err)
	}
	if !store.NeedsMigration() {
		t.Fatal("focus.json without boards.json needs the CLI to migrate it")
	}
	raw := `{"active":"werk","boards":[{"name":"werk","createdAt":1,"now":["3"],"later":[]}]}`
	if err := os.WriteFile(store.Path, []byte(raw), 0o644); err != nil {
		t.Fatal(err)
	}
	b, err := store.Load()
	if err != nil || b.Active != "werk" || len(b.Boards[0].Now) != 1 {
		t.Fatalf("load = %+v, %v", b, err)
	}
	if store.NeedsMigration() {
		t.Fatal("boards.json exists, so the migration already ran")
	}
}
