package board

import (
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"testing"
	"time"

	tea "charm.land/bubbletea/v2"

	"todo-tui/internal/todo"
	"todo-tui/internal/tui/core/registry"
	"todo-tui/internal/tui/focus"
	"todo-tui/internal/tui/kernel"
	"todo-tui/internal/tui/ui"
)

// fixture points the view at a temp data dir and at the real Bun CLI, so
// every board mutation runs exactly as it does for the user.
func fixture(t *testing.T) *View {
	t.Helper()
	bun, err := exec.LookPath("bun")
	if err != nil {
		t.Skip("bun is not installed")
	}
	_, file, _, _ := runtime.Caller(0)
	entry := filepath.Join(filepath.Dir(file), "..", "..", "..", "cli", "todo.ts")

	boardTick = time.Millisecond
	t.Cleanup(func() { boardTick = time.Minute })
	root := t.TempDir()
	t.Setenv("DOTFILES_DATA_DIR", root)
	dir := filepath.Join(root, "todo")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		t.Fatal(err)
	}
	tasks := `[
  {"id":"2","description":"ship release","status":"pending","priority":"high","createdAt":1,"updatedAt":1,"kind":"epic","reminderOffsets":[],"notificationsSent":{"reminders":[],"overdue":false}},
  {"id":"3","description":"write notes","status":"pending","priority":"none","createdAt":2,"updatedAt":2,"parentId":"2","reminderOffsets":[],"notificationsSent":{"reminders":[],"overdue":false}},
  {"id":"4","description":"old chore","status":"completed","priority":"none","createdAt":3,"updatedAt":3,"reminderOffsets":[],"notificationsSent":{"reminders":[],"overdue":false}}
]`
	write(t, filepath.Join(dir, "tasks.json"), tasks)
	write(t, filepath.Join(dir, "config.json"), `{"showNotificationsOnStartup":false,"autocorrect":false}`)
	cli := filepath.Join(root, "todo-cli")
	write(t, cli, "#!/bin/sh\nexec "+bun+" "+entry+" \"$@\"\n")
	if err := os.Chmod(cli, 0o755); err != nil {
		t.Fatal(err)
	}
	return newView(&todo.Store{Path: filepath.Join(dir, "tasks.json")}, &todo.BoardStore{Path: filepath.Join(dir, "boards.json")}, &todo.CLI{Bin: cli})
}

func write(t *testing.T, path, content string) {
	t.Helper()
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}
}

func testContext() registry.Context {
	return registry.Context{Notify: func(ui.Toast) tea.Cmd { return nil }}
}

// settle feeds a command's result back until the view stops producing
// store or CLI round-trips, leaving a pending tick (which would block) uncalled.
func settle(t *testing.T, v registry.View, cmd tea.Cmd) *View {
	t.Helper()
	for cmd != nil {
		msg := cmd()
		switch msg.(type) {
		case loadedMsg, resultMsg, wrappedMsg:
			v, cmd = v.Update(testContext(), msg)
		default:
			cmd = nil
		}
	}
	return v.(*View)
}

func do(t *testing.T, v *View, a action) *View {
	t.Helper()
	next, cmd := v.Update(testContext(), a)
	return settle(t, next, cmd)
}

func show(v *View, key string) {
	v.selectWorkspace(key)
	v.pane().cursor = 0
	v.rebuild("")
}

func started(t *testing.T) *View {
	t.Helper()
	v := fixture(t)
	return settle(t, v, v.Init())
}

func TestTimedBoardLifecycle(t *testing.T) {
	v := started(t)
	if len(v.pane().rows) != 2 || v.workspace() != "all" {
		t.Fatalf("baseline: %d rows on %q", len(v.pane().rows), v.workspace())
	}

	v = settle(t, v, v.submit(modeBoard, "", "2h deploy"))
	if v.workspace() != boardPrefix+"deploy" || len(v.pane().rows) != 0 {
		t.Fatalf("a new board must be selected and empty: %q with %d rows", v.workspace(), len(v.pane().rows))
	}
	title := v.workspaces.Items[len(todo.Workspaces)].Title
	if title != "* deploy · 2h" && title != "* deploy · 1h59m" {
		t.Errorf("sidebar entry = %q", title)
	}

	show(v, "all")
	v = do(t, v, "board.toggle")
	show(v, boardPrefix+"deploy")
	if len(v.pane().rows) != 2 {
		t.Fatalf("f must put the epic and its subtree on the board, got %d rows", len(v.pane().rows))
	}

	v = do(t, v, "board.lane")
	if len(v.pane().rows) != 0 {
		t.Fatalf("L must move the epic out of Now, %d rows left", len(v.pane().rows))
	}
	show(v, laterPrefix+"deploy")
	if len(v.pane().rows) != 2 {
		t.Fatalf("Later must hold the epic and its child, got %d rows", len(v.pane().rows))
	}

	v.pane().cursor = 1
	next, cmd := v.Update(testContext(), action("board.lane"))
	if msg := cmd(); msg.(resultMsg).err == nil || !strings.Contains(msg.(resultMsg).err.Error(), "move #2 instead") {
		t.Fatalf("a child must not move on its own, got %+v", msg)
	}
	v = next.(*View)

	v = do(t, v, "board.end")
	if len(v.boards.Boards) != 0 || v.workspace() != "all" || len(v.workspaces.Items) != len(todo.Workspaces) {
		t.Fatalf("ending must drop the board and land on all tasks: %+v on %q", v.boards, v.workspace())
	}
}

func TestAddingFollowsTheLaneInView(t *testing.T) {
	v := started(t)
	v = settle(t, v, v.submit(modeBoard, "", "1h sprint"))

	show(v, laterPrefix+"sprint")
	v = settle(t, v, v.submit(modeAdd, "", "read paper"))
	show(v, "all")
	v = settle(t, v, v.submit(modeAdd, "", "elsewhere"))

	b, _ := v.boards.Find("sprint")
	if len(b.Later) != 1 || len(b.Now) != 0 {
		t.Fatalf("a in Later must pass --later and a in all tasks --off-board: %+v", b)
	}
	if b.LaneOf(v.all, b.Later[0]) != todo.LaneLater {
		t.Fatalf("the new task must sit in Later: %+v", b)
	}
}

func TestAddingToABoardThatIsNotActive(t *testing.T) {
	v := started(t)
	if _, err := v.cli.Run("board", "new", "werk"); err != nil {
		t.Fatal(err)
	}
	if _, err := v.cli.Run("board", "new", "thuis"); err != nil {
		t.Fatal(err)
	}
	v = settle(t, v, v.load(""))

	show(v, boardPrefix+"werk")
	v = settle(t, v, v.submit(modeAdd, "", "one, two"))
	werk, _ := v.boards.Find("werk")
	thuis, _ := v.boards.Find("thuis")
	if len(werk.Now) != 2 || len(thuis.Now) != 0 {
		t.Fatalf("tasks added in view of werk must land on werk only: werk=%+v thuis=%+v", werk, thuis)
	}
}

func TestMovingATaskToAnotherBoard(t *testing.T) {
	v := started(t)
	for _, args := range [][]string{{"board", "new", "werk"}, {"board", "new", "cleanup"}, {"board", "later", "2"}} {
		if _, err := v.cli.Run(args...); err != nil {
			t.Fatal(err)
		}
	}
	v = settle(t, v, v.load(""))

	show(v, laterPrefix+"cleanup")
	next, _ := v.Update(testContext(), action("board.move"))
	v = next.(*View)
	if v.mode != modeMove || v.prompt.Value() != "werk" {
		t.Fatalf("m must prompt with the other board filled in: mode=%q value=%q", v.mode, v.prompt.Value())
	}
	v = settle(t, v, v.submit(modeMove, v.target, "werk"))

	werk, _ := v.boards.Find("werk")
	cleanup, _ := v.boards.Find("cleanup")
	if len(cleanup.Later) != 0 || len(werk.Later) != 1 || werk.Later[0] != "2" {
		t.Fatalf("the epic must leave cleanup and keep its Later lane on werk: werk=%+v cleanup=%+v", werk, cleanup)
	}
}

func TestSwitchCyclesBoardsThenAllTasks(t *testing.T) {
	v := started(t)
	for _, name := range []string{"a", "b"} {
		if _, err := v.cli.Run("board", "new", name); err != nil {
			t.Fatal(err)
		}
	}
	v = settle(t, v, v.load(""))

	v = do(t, v, "board.switch")
	if v.boards.Active != "" || v.workspace() != "all" {
		t.Fatalf("b after the last board must switch boards off: active=%q on %q", v.boards.Active, v.workspace())
	}
	v = do(t, v, "board.switch")
	if v.boards.Active != "a" || v.workspace() != boardPrefix+"a" {
		t.Fatalf("b must activate the first board: active=%q on %q", v.boards.Active, v.workspace())
	}
	v = do(t, v, "board.off")
	if v.boards.Active != "" || v.workspace() != "all" {
		t.Fatalf("B must turn the board off: active=%q on %q", v.boards.Active, v.workspace())
	}
}

func TestStartupLandsOnTheActiveBoard(t *testing.T) {
	v := fixture(t)
	if _, err := v.cli.Run("board", "new", "werk"); err != nil {
		t.Fatal(err)
	}
	v = settle(t, v, v.Init())
	if v.workspace() != boardPrefix+"werk" {
		t.Fatalf("the first view must be the active board, got %q", v.workspace())
	}
}

func TestExpiredBoardIsWrappedUpByTheCLI(t *testing.T) {
	v := fixture(t)
	now := time.Now().UnixMilli()
	write(t, v.boardStore.Path, `{"active":"sprint","boards":[{"name":"sprint","createdAt":0,"expiresAt":`+itoa(now-1000)+`,"now":["2"],"later":[]}]}`)
	v = settle(t, v, v.Init())
	if len(v.boards.Boards) != 0 || v.workspace() != "all" {
		t.Fatalf("an expired board must be gone: %+v on %q", v.boards, v.workspace())
	}
	var epic *todo.Task
	for i, task := range v.all {
		if task.Description == "sprint" {
			epic = &v.all[i]
		}
	}
	if epic == nil {
		t.Fatalf("the CLI must nest the session under an epic named sprint: %+v", v.all)
	}
}

func TestLegacyFocusFileIsMigratedOnLoad(t *testing.T) {
	v := fixture(t)
	now := time.Now().UnixMilli()
	write(t, filepath.Join(filepath.Dir(v.boardStore.Path), "focus.json"), `{"title":"deploy","startedAt":`+itoa(now-1000)+`,"expiresAt":`+itoa(now+3600000)+`,"pinned":["2"]}`)
	v = settle(t, v, v.Init())
	if _, ok := v.boards.Find("deploy"); !ok || v.workspace() != boardPrefix+"deploy" {
		t.Fatalf("focus.json must become the active board deploy: %+v on %q", v.boards, v.workspace())
	}
}

func TestFailingWrapUpDoesNotLoop(t *testing.T) {
	v := fixture(t)
	v.cli = &todo.CLI{Bin: "false"}
	write(t, v.boardStore.Path, `{"boards":[{"name":"old","createdAt":0,"expiresAt":1,"now":[],"later":[]}]}`)
	v = settle(t, v, v.Init())
	if !v.wrapFailed || len(v.boards.Boards) != 0 {
		t.Fatalf("a failed wrap-up must hide the expired board and stop retrying: failed=%v boards=%+v", v.wrapFailed, v.boards)
	}
}

func itoa(n int64) string {
	return strconv.FormatInt(n, 10)
}

func focusedOn(v *View, id kernel.ID) registry.Context {
	ctx := testContext()
	ctx.Focus = focus.NewState("root").EnterScope("board", v.FocusRegions()).Set(id)
	return ctx
}

func TestSplitShowsASecondBoardAndActsOnTheFocusedOne(t *testing.T) {
	v := started(t)
	for _, name := range []string{"werk", "thuis"} {
		if _, err := v.cli.Run("board", "new", name); err != nil {
			t.Fatal(err)
		}
	}
	v = settle(t, v, v.load(""))
	first := v.workspace()

	v = do(t, v, "board.split")
	other := v.panes[1].key
	if v.shown != 2 || other == first || !strings.HasPrefix(other, boardPrefix) {
		t.Fatalf("| must open another board beside %q, got %d panes, other=%q", first, v.shown, other)
	}

	next, _ := v.Update(focusedOn(v, regionSplit), tea.KeyPressMsg{})
	v = next.(*View)
	if v.workspace() != other {
		t.Fatalf("focusing the split pane must make it the one the sidebar and verbs act on: %q", v.workspace())
	}
	v = settle(t, v, v.submit(modeAdd, "", "elsewhere"))
	b, _ := v.boards.Find(strings.TrimPrefix(other, boardPrefix))
	if len(b.Now) != 1 || len(v.panes[1].rows) != 1 || len(v.panes[0].rows) != 3 {
		t.Fatalf("a in the split pane must add to its board, and all tasks beside it must show it: %+v, rows %d/%d", b, len(v.panes[0].rows), len(v.panes[1].rows))
	}

	v = do(t, v, "board.split.close")
	if v.shown != 1 || v.workspace() != first || len(v.pane().rows) != 3 {
		t.Fatalf("closing the focused pane must leave the first one: %d panes on %q with %d rows", v.shown, v.workspace(), len(v.pane().rows))
	}
}

func TestSplitOpensUpToThreePanes(t *testing.T) {
	v := started(t)
	for _, name := range []string{"a", "b", "c"} {
		if _, err := v.cli.Run("board", "new", name); err != nil {
			t.Fatal(err)
		}
	}
	v = settle(t, v, v.load(""))
	show(v, boardPrefix+"a")
	v = do(t, v, "board.split")
	v = do(t, v, "board.split")
	keys := [maxPanes]string{v.panes[0].key, v.panes[1].key, v.panes[2].key}
	if v.shown != 3 || v.active != 2 || keys != [maxPanes]string{boardPrefix + "a", boardPrefix + "b", boardPrefix + "c"} {
		t.Fatalf("two splits must show three boards and focus the newest: %d panes, active %d, %v", v.shown, v.active, keys)
	}
	if len(v.FocusRegions()) != 4 {
		t.Fatalf("every pane must be focusable: %+v", v.FocusRegions())
	}

	next, _ := v.Update(focusedOn(v, regionSplit), tea.KeyPressMsg{})
	v = next.(*View)
	v = do(t, v, "board.split.close")
	if v.shown != 2 || v.panes[1].key != boardPrefix+"c" || v.workspace() != boardPrefix+"c" {
		t.Fatalf("closing the middle pane must slide the third one in: %d panes, %q in use", v.shown, v.workspace())
	}

	v = do(t, v, "board.split")
	v = do(t, v, "board.split")
	if v.shown != 1 || v.workspace() != boardPrefix+"b" {
		t.Fatalf("| with three open must keep only the focused pane: %d panes on %q", v.shown, v.workspace())
	}
}

func TestSplitWithOneBoardShowsItsOtherLane(t *testing.T) {
	v := started(t)
	if _, err := v.cli.Run("board", "new", "solo"); err != nil {
		t.Fatal(err)
	}
	v = settle(t, v, v.load(""))
	show(v, boardPrefix+"solo")
	v = do(t, v, "board.split")
	if v.panes[1].key != laterPrefix+"solo" {
		t.Fatalf("with one board the split shows its Later lane, got %q", v.panes[1].key)
	}
}

func TestSplitClosesWhenItsBoardEnds(t *testing.T) {
	v := started(t)
	for _, name := range []string{"a", "b"} {
		if _, err := v.cli.Run("board", "new", name); err != nil {
			t.Fatal(err)
		}
	}
	v = settle(t, v, v.load(""))
	v = do(t, v, "board.split")
	if _, err := v.cli.Run("board", "end", strings.TrimPrefix(v.panes[1].key, boardPrefix)); err != nil {
		t.Fatal(err)
	}
	v = settle(t, v, v.load(""))
	if v.shown != 1 {
		t.Fatal("a split whose board is gone must close")
	}
}
