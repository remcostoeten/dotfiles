package board

import (
	"fmt"
	"maps"
	"strconv"
	"strings"
	"time"

	tea "charm.land/bubbletea/v2"
	"github.com/charmbracelet/x/ansi"

	"todo-tui/internal/todo"
	"todo-tui/internal/tui/core/registry"
	"todo-tui/internal/tui/core/render"
	"todo-tui/internal/tui/focus"
	"todo-tui/internal/tui/kernel"
	"todo-tui/internal/tui/layout"
	"todo-tui/internal/tui/ui"
)

const (
	regionWorkspaces kernel.ID = "board.workspaces"
	regionTasks      kernel.ID = "board.tasks"
	regionSplit      kernel.ID = "board.split"
	regionThird      kernel.ID = "board.third"
)

const maxPanes = 3

var paneRegions = [maxPanes]kernel.ID{regionTasks, regionSplit, regionThird}

type mode string

const (
	modeNone   mode = ""
	modeAdd    mode = "add"
	modeSub    mode = "sub"
	modeEpic   mode = "epic"
	modeEdit   mode = "edit"
	modeSnooze mode = "snooze"
	modeDue    mode = "due"
	modeSearch mode = "search"
	modeBoard  mode = "board"
	modeMove   mode = "move"
)

var prompts = map[mode]string{
	modeAdd:    "new task · comma separates several",
	modeSub:    "new subtask",
	modeEpic:   "new epic",
	modeEdit:   "edit",
	modeSnooze: "snooze · 30m, 1h, tomorrow, monday, next week",
	modeDue:    "due · tomorrow, 3,5h, next monday at 09:00, none",
	modeSearch: "search",
	modeBoard:  "timed board · duration up to 24h, then a name: 4h, 90m deploy day",
	modeMove:   "move to board",
}

type loadedMsg struct {
	tasks     []todo.Task
	boards    todo.Boards
	migrating bool
	err       error
	selectID  string
}

type tickMsg struct{}

// wrappedMsg reports the CLI run that wraps up expired boards or migrates focus.json.
type wrappedMsg struct {
	err error
}

var boardTick = time.Minute

const (
	boardPrefix = "board:"
	laterPrefix = "later:"
	selectAll   = "all"
	selectLive  = "active"
)

type resultMsg struct {
	text     string
	err      error
	selectID string
}

type pane struct {
	key    string
	rows   []todo.Row
	cursor int
	offset int
	height int
}

// View is the taskboard screen.
type View struct {
	store      *todo.Store
	boardStore *todo.BoardStore
	cli        *todo.CLI

	all        []todo.Task
	boards     todo.Boards
	ticking    bool
	started    bool
	wrapFailed bool
	pending    string
	loadErr    error
	workspaces ui.List
	collapsed  map[string]bool
	marked     map[string]bool
	panes      [maxPanes]pane
	shown      int
	active     int

	mode   mode
	target string
	prompt ui.Input
	query  string

	lastCompleted []string

	rects map[kernel.ID]kernel.Rect
}

func newView(store *todo.Store, boardStore *todo.BoardStore, cli *todo.CLI) *View {
	return &View{
		store:      store,
		boardStore: boardStore,
		cli:        cli,
		workspaces: ui.NewList(workspaceItems(todo.Boards{}, time.Now())...),
		panes:      [maxPanes]pane{{key: selectAll}},
		shown:      1,
		collapsed:  map[string]bool{},
		marked:     map[string]bool{},
		rects:      map[kernel.ID]kernel.Rect{},
	}
}

// Init loads the task file.
func (v *View) Init() tea.Cmd {
	return v.load("")
}

// Capturing hands raw keys to the prompt while one is open.
func (v *View) Capturing() bool {
	return v.mode != modeNone
}

// FocusRegions declares the sidebar, the task tree and the split panes that
// are open.
func (v *View) FocusRegions() []focus.Region {
	regions := []focus.Region{
		{ID: regionWorkspaces, Order: maxPanes + 1, Label: "Workspaces", JumpKey: 'w'},
		{ID: regionTasks, Order: 1, Label: "Tasks", JumpKey: 't'},
	}
	if v.shown > 1 {
		regions = append(regions, focus.Region{ID: regionSplit, Order: 2, Label: "Split", JumpKey: 's'})
	}
	if v.shown > 2 {
		regions = append(regions, focus.Region{ID: regionThird, Order: 3, Label: "Third", JumpKey: '3'})
	}
	return regions
}

// RegionRects reports where the panels were drawn.
func (v *View) RegionRects(kernel.Rect) map[kernel.ID]kernel.Rect {
	return v.rects
}

// workspaceItems lists the fixed workspaces, then one entry per board with
// its Later lane indented under it.
func workspaceItems(boards todo.Boards, now time.Time) []ui.ListItem {
	items := make([]ui.ListItem, 0, len(todo.Workspaces)+2*len(boards.Boards))
	for _, w := range todo.Workspaces {
		items = append(items, ui.ListItem{ID: kernel.ID(w.Key), Title: w.Label})
	}
	for _, b := range boards.Boards {
		title := b.Name
		if b.Timed() {
			title += " · " + remaining(b.Remaining(now))
		}
		if b.Name == boards.Active {
			title = "* " + title
		}
		items = append(items,
			ui.ListItem{ID: kernel.ID(boardPrefix + b.Name), Title: title},
			ui.ListItem{ID: kernel.ID(laterPrefix + b.Name), Title: "  later"})
	}
	return items
}

func remaining(d time.Duration) string {
	hours := int(d / time.Hour)
	minutes := int(d % time.Hour / time.Minute)
	switch {
	case hours > 0 && minutes > 0:
		return fmt.Sprintf("%dh%02dm", hours, minutes)
	case hours > 0:
		return fmt.Sprintf("%dh", hours)
	case minutes > 0:
		return fmt.Sprintf("%dm", minutes)
	default:
		return "<1m"
	}
}

func (v *View) load(selectID string) tea.Cmd {
	store, boardStore := v.store, v.boardStore
	return func() tea.Msg {
		tasks, err := store.Load()
		boards, boardErr := boardStore.Load()
		if err == nil {
			err = boardErr
		}
		return loadedMsg{tasks: tasks, boards: boards, migrating: boardStore.NeedsMigration(), err: err, selectID: selectID}
	}
}

// wrapUp asks the CLI to end expired boards (their session tasks move under
// an epic) or to migrate a legacy focus.json; any board command does both.
func (v *View) wrapUp() tea.Cmd {
	cli := v.cli
	return func() tea.Msg {
		_, err := cli.Run("board")
		return wrappedMsg{err: err}
	}
}

func (v *View) tick() tea.Cmd {
	v.ticking = true
	return tea.Tick(boardTick, func(time.Time) tea.Msg { return tickMsg{} })
}

func (v View) hasTimedBoard() bool {
	for _, b := range v.boards.Boards {
		if b.Timed() {
			return true
		}
	}
	return false
}

// viewedBoard returns the board whose lane the active pane shows, if any.
func (v View) viewedBoard() (todo.Board, string, bool) {
	return v.viewedBoardOf(v.workspace())
}

func (v View) viewedBoardOf(key string) (todo.Board, string, bool) {
	for prefix, lane := range map[string]string{boardPrefix: todo.LaneNow, laterPrefix: todo.LaneLater} {
		if name, ok := strings.CutPrefix(key, prefix); ok {
			b, found := v.boards.Find(name)
			return b, lane, found
		}
	}
	return todo.Board{}, "", false
}

// otherBoards lists every board name except the one a task is moving off.
func (v View) otherBoards(from string) []string {
	var names []string
	for _, b := range v.boards.Boards {
		if !strings.EqualFold(b.Name, from) {
			names = append(names, b.Name)
		}
	}
	return names
}

// moveSuggestion prefills m with the board open in another pane, else the
// first other board.
func (v View) moveSuggestion(from string, others []string) string {
	for i := range v.shown {
		if i == v.active {
			continue
		}
		if b, _, ok := v.viewedBoardOf(v.panes[i].key); ok && !strings.EqualFold(b.Name, from) {
			return b.Name
		}
	}
	return others[0]
}

// targetBoard is the board f and L act on: the one in view, else the active one.
func (v View) targetBoard() (todo.Board, bool) {
	if b, _, ok := v.viewedBoard(); ok {
		return b, true
	}
	return v.boards.ActiveBoard()
}

// syncWorkspaces rebuilds the sidebar from the boards, closing split panes
// whose board is gone and keeping the current selection when it still exists. The first load lands on the active board;
// a pending request (after F, b or B) lands where that command pointed.
func (v *View) syncWorkspaces(now time.Time) {
	v.workspaces = v.workspaces.SetItems(workspaceItems(v.boards, now))
	for i := v.shown - 1; i >= 0 && v.shown > 1; i-- {
		if !v.hasWorkspace(v.panes[i].key) {
			v.closePane(i)
		}
	}
	current := v.workspace()
	target := current
	switch {
	case v.pending == selectLive || (!v.started && v.pending == ""):
		target = selectAll
		if b, ok := v.boards.ActiveBoard(); ok {
			target = boardPrefix + b.Name
		} else if !v.started {
			target = current
		}
	case v.pending != "":
		target = v.pending
	}
	v.pending, v.started = "", true
	if !v.selectWorkspace(target) {
		v.selectWorkspace(selectAll)
	}
	if v.workspace() != current {
		v.pane().cursor, v.pane().offset, v.marked = 0, 0, map[string]bool{}
	}
}

func (v *View) selectWorkspace(key string) bool {
	for i, item := range v.workspaces.Items {
		if string(item.ID) == key {
			v.workspaces = v.workspaces.Select(i)
			v.pane().key = key
			return true
		}
	}
	return false
}

func (v View) hasWorkspace(key string) bool {
	for _, item := range v.workspaces.Items {
		if string(item.ID) == key {
			return true
		}
	}
	return false
}

func (v *View) pane() *pane {
	return &v.panes[v.active]
}

func (v *View) syncActive(ctx registry.Context) {
	active := v.active
	for i := range v.shown {
		if ctx.Focus.Focused(paneRegions[i]) {
			active = i
		}
	}
	if active != v.active {
		v.active = active
		v.selectWorkspace(v.pane().key)
	}
}

// splitKey picks the lane a new pane shows: a board's Now lane that is not
// open yet, then the Later lane of the board in view, then any other Later lane.
func (v View) splitKey() (string, bool) {
	open := map[string]bool{}
	for _, p := range v.panes[:v.shown] {
		open[p.key] = true
	}
	candidates := make([]string, 0, 2*len(v.boards.Boards)+1)
	for _, b := range v.boards.Boards {
		candidates = append(candidates, boardPrefix+b.Name)
	}
	if b, _, ok := v.viewedBoard(); ok {
		candidates = append(candidates, laterPrefix+b.Name)
	}
	for _, b := range v.boards.Boards {
		candidates = append(candidates, laterPrefix+b.Name)
	}
	for _, key := range candidates {
		if !open[key] {
			return key, true
		}
	}
	return "", false
}

func (v *View) openPane(key string) {
	v.panes[v.shown] = pane{key: key}
	v.active = v.shown
	v.shown++
	v.rebuild("")
}

func (v *View) closePane(index int) {
	copy(v.panes[index:], v.panes[index+1:])
	v.panes[maxPanes-1] = pane{}
	v.shown--
	if v.active > index || v.active == v.shown {
		v.active = max(0, v.active-1)
	}
	v.selectWorkspace(v.pane().key)
}

// closeOthers keeps only the pane in use.
func (v *View) closeOthers() {
	v.panes[0] = *v.pane()
	for i := 1; i < maxPanes; i++ {
		v.panes[i] = pane{}
	}
	v.shown, v.active = 1, 0
	v.selectWorkspace(v.panes[0].key)
}

func (v *View) run(selectID string, args ...string) tea.Cmd {
	cli := v.cli
	return func() tea.Msg {
		out, err := cli.Run(args...)
		return resultMsg{text: out, err: err, selectID: selectID}
	}
}

func (v *View) patch(id string, fields map[string]any, text string) tea.Cmd {
	store := v.store
	return func() tea.Msg {
		return resultMsg{text: text, err: store.Patch(id, fields), selectID: id}
	}
}

func (v View) workspace() string {
	return v.pane().key
}

func (v View) archive() bool {
	return v.workspace() == "archive"
}

func (v View) selected() (todo.Row, bool) {
	p := v.pane()
	if p.cursor < 0 || p.cursor >= len(p.rows) {
		return todo.Row{}, false
	}
	return p.rows[p.cursor], true
}

func (v View) filtered(key string, now time.Time) []todo.Task {
	for prefix, lane := range map[string]string{boardPrefix: todo.LaneNow, laterPrefix: todo.LaneLater} {
		if name, ok := strings.CutPrefix(key, prefix); ok {
			b, _ := v.boards.Find(name)
			return todo.FilterLane(v.all, b, lane)
		}
	}
	return todo.Filter(v.all, key, now)
}

func (v *View) rebuild(selectID string) {
	now := time.Now()
	for i := range v.shown {
		p := &v.panes[i]
		visible := v.filtered(p.key, now)
		if i == v.active {
			visible = todo.Search(visible, v.query)
		}
		p.rows = todo.BuildRows(visible, v.all, v.collapsed)
		if selectID != "" && i == v.active {
			for j, r := range p.rows {
				if r.Task.ID == selectID {
					p.cursor = j
				}
			}
		}
		p.cursor = min(max(p.cursor, 0), max(0, len(p.rows)-1))
		p.offset = ui.Window(p.offset, p.cursor, p.height, len(p.rows))
	}
}

func (v *View) move(delta int) {
	p := v.pane()
	p.cursor = min(max(p.cursor+delta, 0), max(0, len(p.rows)-1))
	p.offset = ui.Window(p.offset, p.cursor, p.height, len(p.rows))
}

// Update handles loads, verbs, prompt editing and tree navigation.
func (v *View) Update(ctx registry.Context, msg tea.Msg) (registry.View, tea.Cmd) {
	next := *v
	next.workspaces.Focused = ctx.Focus.Focused(regionWorkspaces)
	next.syncActive(ctx)

	switch msg := msg.(type) {
	case loadedMsg:
		next.all, next.loadErr = msg.tasks, msg.err
		now := time.Now()
		if (msg.boards.AnyExpired(now) || msg.migrating) && !next.wrapFailed {
			return &next, next.wrapUp()
		}
		next.boards = msg.boards.Live(now)
		next.syncWorkspaces(now)
		next.rebuild(msg.selectID)
		if next.hasTimedBoard() && !next.ticking {
			return &next, next.tick()
		}
		return &next, nil

	case wrappedMsg:
		if msg.err != nil {
			next.wrapFailed = true
			return &next, tea.Batch(ctx.Notify(ui.Toast{Severity: ui.SeverityDanger, Text: "boards not wrapped up: " + msg.err.Error()}), next.load(""))
		}
		return &next, next.load("")

	case tickMsg:
		next.ticking = false
		if !next.hasTimedBoard() {
			return &next, nil
		}
		return &next, next.load("")

	case resultMsg:
		if msg.err != nil {
			next.pending = ""
			return &next, tea.Batch(ctx.Notify(ui.Toast{Severity: ui.SeverityDanger, Text: msg.err.Error()}), next.load(msg.selectID))
		}
		var toast tea.Cmd
		if msg.text != "" {
			toast = ctx.Notify(ui.Toast{Severity: ui.SeveritySuccess, Text: msg.text})
		}
		return &next, tea.Batch(toast, next.load(msg.selectID))

	case action:
		return next.act(ctx, msg)

	case tea.KeyMsg:
		if next.mode != modeNone {
			return next.promptKey(msg)
		}
		if next.workspaces.Focused {
			before := next.workspaces.Cursor()
			next.workspaces, _ = next.workspaces.Update(msg)
			if next.workspaces.Cursor() != before {
				item, _ := next.workspaces.Selected()
				next.pane().key = string(item.ID)
				next.pane().cursor, next.pane().offset, next.marked = 0, 0, map[string]bool{}
				next.rebuild("")
			}
			return &next, nil
		}
		return next.treeKey(msg)
	}
	return &next, nil
}

func (v View) treeKey(key tea.KeyMsg) (registry.View, tea.Cmd) {
	p := v.pane()
	switch key.String() {
	case "up", "k":
		v.move(-1)
	case "down", "j":
		v.move(1)
	case "pgup":
		v.move(-max(1, p.height))
	case "pgdown":
		v.move(max(1, p.height))
	case "home", "g":
		v.move(-len(p.rows))
	case "end", "G":
		v.move(len(p.rows))
	case "left", "h":
		row, ok := v.selected()
		if !ok {
			break
		}
		if row.HasChildren && !row.Collapsed {
			v.setCollapsed(row.Task.ID, true)
			break
		}
		for i, r := range p.rows {
			if r.Task.ID == row.Task.ParentID {
				p.cursor = i
				v.move(0)
			}
		}
	case "right", "l":
		row, ok := v.selected()
		if !ok || !row.HasChildren {
			break
		}
		if row.Collapsed {
			v.setCollapsed(row.Task.ID, false)
		} else {
			v.move(1)
		}
	}
	return &v, nil
}

func (v *View) setCollapsed(id string, on bool) {
	v.collapsed = maps.Clone(v.collapsed)
	if on {
		v.collapsed[id] = true
	} else {
		delete(v.collapsed, id)
	}
	v.rebuild(id)
}

func (v View) open(m mode, target, value string) (registry.View, tea.Cmd) {
	return v.openLabeled(m, target, value, prompts[m])
}

func (v View) openLabeled(m mode, target, value, label string) (registry.View, tea.Cmd) {
	v.mode, v.target = m, target
	v.prompt = ui.NewInput(label).SetValue(value)
	v.prompt.Focused = true
	return &v, nil
}

func (v View) promptKey(key tea.KeyMsg) (registry.View, tea.Cmd) {
	switch key.String() {
	case "esc":
		if v.mode == modeSearch {
			v.query = ""
			v.rebuild("")
		}
		v.mode = modeNone
		return &v, nil
	case "enter":
		value := strings.TrimSpace(v.prompt.Value())
		m, target := v.mode, v.target
		v.mode = modeNone
		if m == modeSearch {
			return &v, nil
		}
		if value == "" {
			return &v, nil
		}
		return &v, v.submit(m, target, value)
	}
	v.prompt, _ = v.prompt.Update(key)
	if v.mode == modeSearch {
		v.query = v.prompt.Value()
		v.rebuild("")
	}
	return &v, nil
}

func (v *View) submit(m mode, target, value string) tea.Cmd {
	words := strings.Fields(value)
	switch m {
	case modeAdd:
		return v.create("", append([]string{"add"}, words...))
	case modeSub:
		return v.create(target, append([]string{"sub", target}, words...))
	case modeEpic:
		return v.create("", append([]string{"epic"}, words...))
	case modeEdit:
		return v.run(target, append([]string{"edit", target}, words...)...)
	case modeSnooze:
		return v.run(target, append([]string{"snooze", target}, words...)...)
	case modeDue:
		if value == "none" || value == "0" {
			return v.run(target, "due", target, "clear")
		}
		return v.run(target, append([]string{"due", target}, words...)...)
	case modeMove:
		from, ok := v.targetBoard()
		if !ok {
			return nil
		}
		return v.run(target, "board", "move", target, "--from", from.Name, "--to", value)
	case modeBoard:
		if _, _, err := todo.ParseTimedSpec(value); err != nil {
			return func() tea.Msg { return resultMsg{err: err} }
		}
		v.pending = selectLive
		return v.run("", append([]string{"focus"}, words...)...)
	}
	return nil
}

// create adds tasks where the view points: a board lane puts them in that
// lane, any other workspace keeps them off the active board. A board that is
// not the active one gets them through `board add`, since new tasks only
// join the active board by themselves.
func (v View) create(selectID string, args []string) tea.Cmd {
	b, lane, onBoard := v.viewedBoard()
	active, hasActive := v.boards.ActiveBoard()
	if !onBoard || (hasActive && active.Name == b.Name) {
		switch {
		case !onBoard:
			args = append(args, "--off-board")
		case lane == todo.LaneLater:
			args = append(args, "--later")
		}
		return v.run(selectID, args...)
	}
	cli := v.cli
	return func() tea.Msg {
		out, err := cli.RunAll(append(args, "--off-board")...)
		if err != nil {
			return resultMsg{err: err, selectID: selectID}
		}
		ids := todo.AddedIDs(out)
		place := append([]string{"board", lane}, ids...)
		if _, err := cli.Run(append(place, "--on", b.Name)...); err != nil {
			return resultMsg{err: err, selectID: selectID}
		}
		return resultMsg{text: fmt.Sprintf("Added %d to %s on %s", len(ids), laneTitle(lane), b.Name), selectID: selectID}
	}
}

func laneTitle(lane string) string {
	if lane == todo.LaneLater {
		return "Later"
	}
	return "Now"
}

func (v View) act(ctx registry.Context, a action) (registry.View, tea.Cmd) {
	row, hasRow := v.selected()
	id := row.Task.ID
	editable := hasRow && !v.archive()

	if a != "complete" && a != "undo" {
		v.lastCompleted = nil
	}

	switch a {
	case "complete":
		if v.workspaces.Focused {
			return &v, focus.Set(regionTasks)
		}
		if !hasRow {
			break
		}
		if v.archive() {
			v.lastCompleted = nil
			return &v, v.patch(id, map[string]any{"status": "pending"}, "Restored #"+id)
		}
		if row.Task.Pending() {
			v.lastCompleted = pendingSubtreeIDs(v.all, id)
		}
		return &v, v.run("", "done", id)
	case "add":
		return v.open(modeAdd, "", "")
	case "add.sub":
		if editable {
			return v.open(modeSub, id, "")
		}
	case "add.epic":
		return v.open(modeEpic, "", "")
	case "edit":
		if hasRow {
			return v.open(modeEdit, id, row.Task.Description)
		}
	case "snooze":
		if editable {
			return v.open(modeSnooze, id, "")
		}
	case "due":
		if editable {
			return v.open(modeDue, id, "")
		}
	case "search":
		v.query = ""
		return v.open(modeSearch, "", "")
	case "confirm.delete":
		if !hasRow {
			break
		}
		message := "Delete #" + id
		if n := len(todo.Descendants(v.all, id)); n > 0 {
			message += fmt.Sprintf(" and %d subtask%s", n, plural(n))
		}
		return &v, ask("Delete task", message+"? u undoes it.", "todo.delete.confirmed")
	case "delete":
		if hasRow {
			return &v, v.run("", "rm", id)
		}
	case "undo":
		if len(v.lastCompleted) > 0 {
			ids := v.lastCompleted
			v.lastCompleted = nil
			cmds := make([]tea.Cmd, len(ids))
			for i, tid := range ids {
				cmds[i] = v.patch(tid, map[string]any{"status": "pending"}, "")
			}
			return &v, tea.Sequence(append(cmds, ctx.Notify(ui.Toast{Severity: ui.SeveritySuccess, Text: "Undid complete #" + ids[0]}))...)
		}
		return &v, v.run("", "undo")
	case "priority":
		if editable {
			p := row.Task.Priority.Next()
			return &v, v.patch(id, map[string]any{"priority": string(p)}, "Priority #"+id+": "+string(p))
		}
	case "mark":
		if editable {
			v.marked = maps.Clone(v.marked)
			if v.marked[id] {
				delete(v.marked, id)
			} else {
				v.marked[id] = true
			}
			v.move(1)
		}
	case "complete.marked":
		if v.archive() {
			break
		}
		ids := make([]string, 0, len(v.marked))
		for markedID := range v.marked {
			ids = append(ids, markedID)
		}
		if len(ids) == 0 && hasRow {
			ids = []string{id}
		}
		v.marked = map[string]bool{}
		cmds := make([]tea.Cmd, len(ids))
		for i, markedID := range ids {
			cmds[i] = v.run("", "done", markedID)
		}
		return &v, tea.Sequence(cmds...)
	case "archive":
		if v.archive() {
			v.selectWorkspace(selectAll)
		} else {
			v.selectWorkspace("archive")
		}
		v.pane().cursor, v.pane().offset = 0, 0
		v.rebuild("")
	case "board.split":
		key, ok := v.splitKey()
		if v.shown == maxPanes || (!ok && v.shown > 1) {
			v.closeOthers()
			return &v, focus.Set(regionTasks)
		}
		if !ok {
			return &v, noBoards(ctx)
		}
		v.openPane(key)
		return &v, focus.Set(paneRegions[v.active])
	case "board.split.close":
		if v.shown == 1 {
			break
		}
		v.closePane(v.active)
		return &v, focus.Set(paneRegions[v.active])
	case "board.new":
		return v.open(modeBoard, "", "")
	case "board.switch":
		if len(v.boards.Boards) == 0 {
			return &v, noBoards(ctx)
		}
		next := 0
		for i, b := range v.boards.Boards {
			if b.Name == v.boards.Active {
				next = i + 1
			}
		}
		if next == len(v.boards.Boards) {
			v.pending = selectAll
			return &v, v.run("", "board", "off")
		}
		v.pending = selectLive
		return &v, v.run("", "board", "use", v.boards.Boards[next].Name)
	case "board.off":
		if _, ok := v.boards.ActiveBoard(); !ok {
			return &v, ctx.Notify(ui.Toast{Severity: ui.SeverityInfo, Text: "No active board · b picks one"})
		}
		v.pending = selectAll
		return &v, v.run("", "board", "off")
	case "board.toggle":
		b, ok := v.targetBoard()
		if !ok {
			return &v, noBoards(ctx)
		}
		if !editable {
			break
		}
		if b.Listed(id) {
			return &v, v.run(id, "board", "rm", id, "--on", b.Name)
		}
		args := []string{"board", "add", id, "--on", b.Name}
		if _, lane, onBoard := v.viewedBoard(); onBoard && lane == todo.LaneLater {
			args = append(args, "--later")
		}
		return &v, v.run(id, args...)
	case "board.move":
		b, ok := v.targetBoard()
		if !ok {
			return &v, noBoards(ctx)
		}
		if !editable {
			break
		}
		if b.LaneOf(v.all, id) == "" {
			return &v, ctx.Notify(ui.Toast{Severity: ui.SeverityWarning, Text: "#" + id + " is not on " + b.Name})
		}
		others := v.otherBoards(b.Name)
		if len(others) == 0 {
			return &v, ctx.Notify(ui.Toast{Severity: ui.SeverityInfo, Text: "No other board · todo board new <name>"})
		}
		return v.openLabeled(modeMove, id, v.moveSuggestion(b.Name, others), prompts[modeMove]+" · "+strings.Join(others, ", "))
	case "board.lane":
		b, ok := v.targetBoard()
		if !ok {
			return &v, noBoards(ctx)
		}
		if !editable {
			break
		}
		lane := todo.LaneLater
		if b.LaneOf(v.all, id) == todo.LaneLater {
			lane = todo.LaneNow
		}
		return &v, v.run(id, "board", lane, id, "--on", b.Name)
	case "confirm.board.end":
		b, ok := v.targetBoard()
		if !ok {
			return &v, noBoards(ctx)
		}
		message := "End " + b.Name + "? Its tasks stay in all tasks."
		if b.Timed() {
			message = "End " + b.Name + "? Tasks created on it move under an epic named after it."
		}
		return &v, ask("End board", message, "todo.board.end.confirmed")
	case "board.end":
		if b, ok := v.targetBoard(); ok {
			v.pending = selectAll
			return &v, v.run("", "board", "end", b.Name)
		}
	case "refresh":
		return &v, tea.Batch(v.load(id), ctx.Notify(ui.Toast{Severity: ui.SeverityInfo, Text: "Refreshed"}))
	case "indent":
		if !editable {
			break
		}
		p := v.pane()
		for i := p.cursor - 1; i >= 0; i-- {
			if p.rows[i].Depth < row.Depth {
				break
			}
			if p.rows[i].Depth == row.Depth {
				return &v, v.run(id, "move", id, p.rows[i].Task.ID)
			}
		}
		return &v, ctx.Notify(ui.Toast{Severity: ui.SeverityWarning, Text: "No task above to nest under"})
	case "outdent":
		if !editable {
			break
		}
		if row.Task.ParentID == "" {
			return &v, ctx.Notify(ui.Toast{Severity: ui.SeverityWarning, Text: "Already at the top level"})
		}
		grand := "root"
		for _, t := range v.all {
			if t.ID == row.Task.ParentID && t.ParentID != "" {
				grand = t.ParentID
			}
		}
		return &v, v.run(id, "move", id, grand)
	}
	return &v, nil
}

func noBoards(ctx registry.Context) tea.Cmd {
	return ctx.Notify(ui.Toast{Severity: ui.SeverityInfo, Text: "No board · F starts a timed one, todo board new <name> a lasting one"})
}

// Render lays the sidebar beside the tree, with the prompt under the tree.
// Each split pane adds another tree of equal width to the right; the sidebar
// gives way when the trees would get too narrow.
func (v *View) Render(rc render.Context) string {
	area := rc.Rect
	sidebar := 24
	if area.Width-sidebar < 40*v.shown {
		sidebar = 0
	}
	constraints := []layout.Constraint{layout.Fixed(sidebar)}
	for range v.shown {
		constraints = append(constraints, layout.Flex(1))
	}
	cols := layout.Cols(area, constraints...)
	v.rects[regionWorkspaces] = cols[0]
	for _, region := range paneRegions {
		delete(v.rects, region)
	}

	blocks := []render.Block{}
	if sidebar > 0 {
		blocks = append(blocks, render.At(cols[0], v.renderSidebar(rc.For(cols[0]))))
	}
	for i := range v.shown {
		v.rects[paneRegions[i]] = cols[i+1]
		blocks = append(blocks, render.At(cols[i+1], v.renderTasks(rc.For(cols[i+1]), i)))
	}
	return render.Compose(area, blocks...)
}

func (v *View) renderSidebar(rc render.Context) string {
	now := time.Now()
	items := make([]ui.ListItem, len(v.workspaces.Items))
	for i, item := range v.workspaces.Items {
		item.Detail = strconv.Itoa(len(v.filtered(string(item.ID), now)))
		items[i] = item
	}
	list := v.workspaces.SetItems(items).SetHeight(inner(rc.Rect).Height)
	return ui.Panel{
		Title:   "Workspaces",
		Focused: rc.Focused(regionWorkspaces),
		Content: list.Render(rc.For(inner(rc.Rect))),
	}.Render(rc)
}

func (v *View) renderTasks(rc render.Context, index int) string {
	p := &v.panes[index]
	region := paneRegions[index]
	isActive := index == v.active
	body := inner(rc.Rect)
	promptHeight := 0
	if isActive && (v.mode != modeNone || v.query != "") {
		promptHeight = 2
	}
	parts := layout.Rows(body, layout.Fixed(1), layout.Flex(1), layout.Fixed(promptHeight))
	p.height = parts[1].Height
	p.offset = ui.Window(p.offset, p.cursor, p.height, len(p.rows))

	st := rc.Styles()
	var content string
	switch {
	case v.loadErr != nil:
		content = ui.ErrorState{Title: "Could not read tasks", Detail: v.loadErr.Error()}.Render(rc.For(body))
	case len(p.rows) == 0 && promptHeight == 0:
		hint := "a adds a task · E adds an epic"
		_, lane, onBoard := v.viewedBoardOf(p.key)
		switch {
		case p.key == "archive":
			hint = "v returns to open tasks"
		case onBoard && lane == todo.LaneLater:
			hint = "a adds a task here · L moves the selected task between lanes"
		case onBoard:
			hint = "a adds a task here · f puts a task on this board from all tasks"
		}
		content = ui.EmptyState{Title: "All caught up", Hint: hint}.Render(rc.For(body))
	default:
		blocks := []render.Block{render.At(parts[0], st.Muted.Render(v.header(parts[0].Width)))}
		now := time.Now()
		focused := rc.Focused(region)
		for i := 0; i < p.height && p.offset+i < len(p.rows); i++ {
			row := p.offset + i
			line := rc.For(kernel.Rect{X: parts[1].X, Y: parts[1].Y + i, Width: parts[1].Width, Height: 1})
			blocks = append(blocks, render.At(line.Rect, v.renderRow(line, p.rows[row], row == p.cursor && focused, now)))
		}
		if promptHeight > 0 {
			blocks = append(blocks, render.At(parts[2], v.renderPrompt(rc.For(parts[2]))))
		}
		content = render.Compose(body, blocks...)
	}

	title := "Todos"
	subtitle := strconv.Itoa(len(p.rows))
	if b, lane, onBoard := v.viewedBoardOf(p.key); onBoard {
		title = b.Name + " · " + laneTitle(lane)
		if b.Timed() {
			subtitle += " · " + remaining(b.Remaining(time.Now())) + " left"
		}
	} else if p.key == "archive" {
		title = "Archive"
	}
	if isActive && len(v.marked) > 0 {
		subtitle += fmt.Sprintf(" · %d marked", len(v.marked))
	}
	return ui.Panel{
		Title:    title,
		Subtitle: subtitle,
		Focused:  rc.Focused(region),
		Scroll:   ui.ScrollPos{Offset: p.offset, Visible: p.height, Total: len(p.rows)},
		Content:  content,
	}.Render(rc)
}

func (v *View) renderPrompt(rc render.Context) string {
	st := rc.Styles()
	label := prompts[v.mode]
	if v.target != "" && v.mode != modeSearch {
		label += " · #" + v.target
	}
	if v.mode == modeNone {
		return st.Muted.Render(render.Fit("/ "+v.query, rc.Rect.Width, render.Left, rc.Glyphs.Ellipsis))
	}
	field := v.prompt.Render(rc.For(kernel.Rect{X: rc.Rect.X + 2, Y: rc.Rect.Y + 1, Width: rc.Rect.Width - 2, Height: 1}))
	return st.Accent.Render(render.Fit(label, rc.Rect.Width, render.Left, rc.Glyphs.Ellipsis)) + "\n" + st.Muted.Render("> ") + field
}

const (
	colID  = 5
	colPri = 5
	colDue = 14
)

func (v *View) header(width int) string {
	title := max(8, width-2-colID-colPri-colDue)
	return "  " + render.Pad("ID", colID, render.Left) + render.Pad("TASK", title, render.Left) +
		render.Pad("PRI", colPri, render.Left) + render.Pad("DUE", colDue, render.Right)
}

func (v *View) renderRow(rc render.Context, row todo.Row, selected bool, now time.Time) string {
	st := rc.Styles()
	t := row.Task
	width := rc.Rect.Width

	marker := "  "
	switch {
	case selected:
		marker = rc.Glyphs.Chevron + " "
	case v.marked[t.ID]:
		marker = "✓ "
	}

	toggle := ""
	if row.HasChildren {
		toggle = "▾ "
		if row.Collapsed {
			toggle = "▸ "
		}
	}
	badge := ""
	switch {
	case row.Collapsed:
		badge = fmt.Sprintf(" ● %d sub%s", row.ChildCount, plural(row.ChildCount))
	case row.Total > 0:
		badge = fmt.Sprintf(" [%d/%d]", row.Done, row.Total)
	case t.Epic():
		badge = " [epic]"
	}

	titleWidth := max(8, width-2-colID-colPri-colDue)
	prefix := row.Prefix() + toggle
	descWidth := max(1, titleWidth-render.Width(prefix)-render.Width(badge)-1)
	desc := render.Truncate(t.Description, descWidth, rc.Glyphs.Ellipsis)
	if row.HasChildren || t.Epic() {
		desc = st.Base.Bold(true).Render(desc)
	}
	titleCell := render.Pad(st.Subtle.Render(prefix)+desc+st.Info.Render(badge), titleWidth, render.Left)

	pri, priStyle := "—", st.Subtle
	switch t.Priority {
	case todo.PriorityHigh:
		pri, priStyle = "high", st.Danger
	case todo.PriorityMedium:
		pri, priStyle = "med", st.Warning
	case todo.PriorityLow:
		pri, priStyle = "low", st.Info
	}

	due, dueStyle := dueLabel(t, now), st.Muted
	if d, ok := t.Due(); ok && t.Pending() {
		switch {
		case d.Before(now):
			dueStyle = st.Danger
		case d.Sub(now) < 30*time.Minute:
			dueStyle = st.Warning
		}
	}

	line := marker + st.Muted.Render(render.Pad("#"+t.ID, colID, render.Left)) + titleCell +
		priStyle.Render(render.Pad(pri, colPri, render.Left)) + dueStyle.Render(render.Pad(due, colDue, render.Right))
	if !t.Pending() {
		line = marker + st.Subtle.Render(render.Pad("#"+t.ID, colID, render.Left)+render.Pad(prefix+t.Description, titleWidth+colPri, render.Left)) +
			st.Subtle.Render(render.Pad(shortDate(time.UnixMilli(t.UpdatedAt), now), colDue, render.Right))
	}
	line = render.Fit(line, width, render.Left, "")
	if selected {
		return st.Selection.Render(ansi.Strip(line))
	}
	return line
}

func dueLabel(t todo.Task, now time.Time) string {
	d, ok := t.Due()
	if !ok {
		return "—"
	}
	if d.Before(now) {
		return "overdue " + compact(now.Sub(d))
	}
	if todo.SameDay(d, now) {
		return "today " + d.Format("15:04")
	}
	if todo.SameDay(d, now.AddDate(0, 0, 1)) {
		return "tomorrow " + d.Format("15:04")
	}
	return shortDate(d, now)
}

func shortDate(d, now time.Time) string {
	if d.Year() != now.Year() {
		return d.Format("2 Jan 2006")
	}
	return d.Format("2 Jan 15:04")
}

func compact(d time.Duration) string {
	switch {
	case d >= 24*time.Hour:
		return strconv.Itoa(int(d/(24*time.Hour))) + "d"
	case d >= time.Hour:
		return strconv.Itoa(int(d/time.Hour)) + "h"
	default:
		return strconv.Itoa(max(1, int(d/time.Minute))) + "m"
	}
}

// pendingSubtreeIDs lists id plus every pending descendant — the set that
// "done" flips to completed, so undo knows exactly what to flip back.
func pendingSubtreeIDs(all []todo.Task, id string) []string {
	descendants := todo.Descendants(all, id)
	byID := make(map[string]todo.Task, len(all))
	for _, t := range all {
		byID[t.ID] = t
	}
	ids := []string{id}
	for did := range descendants {
		if t, ok := byID[did]; ok && t.Pending() {
			ids = append(ids, did)
		}
	}
	return ids
}

func plural(n int) string {
	if n == 1 {
		return ""
	}
	return "s"
}

func inner(r kernel.Rect) kernel.Rect {
	return r.Inset(1).InsetXY(1, 0)
}
