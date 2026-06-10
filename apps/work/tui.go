package main

import (
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/charmbracelet/bubbles/textinput"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

// ---- styles ----

// palette
const (
	colAccent = "141" // violet
	colCyan   = "45"
	colGreen  = "78"
	colAmber  = "214"
	colRed    = "203"
	colMute   = "244"
	colFaint  = "239"
	colInk    = "235" // dark text for badges
	colWhite  = "231"
)

var (
	cTitle  = lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color(colWhite)).Background(lipgloss.Color(colAccent)).Padding(0, 1)
	cDim    = lipgloss.NewStyle().Foreground(lipgloss.Color(colMute))
	cGreen  = lipgloss.NewStyle().Foreground(lipgloss.Color(colGreen))
	cYellow = lipgloss.NewStyle().Foreground(lipgloss.Color(colAmber))
	cRed    = lipgloss.NewStyle().Foreground(lipgloss.Color(colRed))
	cCyan   = lipgloss.NewStyle().Foreground(lipgloss.Color(colCyan))
	cBold   = lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color(colAccent))
	cCursor = lipgloss.NewStyle().Foreground(lipgloss.Color(colCyan)).Bold(true)

	stApp = lipgloss.NewStyle().Border(lipgloss.RoundedBorder()).
		BorderForeground(lipgloss.Color(colFaint)).Padding(1, 2)
	stBar  = lipgloss.NewStyle().Foreground(lipgloss.Color(colAccent))
	stSel  = lipgloss.NewStyle().Foreground(lipgloss.Color(colGreen)).Bold(true)
	stURL  = lipgloss.NewStyle().Foreground(lipgloss.Color(colMute))
	stCur  = lipgloss.NewStyle().Foreground(lipgloss.Color(colWhite)).Bold(true)
)

// badge renders a small pill with dark text on a colored background.
func badge(text, bg string) string {
	return lipgloss.NewStyle().Background(lipgloss.Color(bg)).
		Foreground(lipgloss.Color(colInk)).Bold(true).Padding(0, 1).Render(text)
}

// hint renders "key desc · key desc · …" with colored keys.
func hint(pairs ...[2]string) string {
	parts := make([]string, 0, len(pairs))
	for _, p := range pairs {
		parts = append(parts, cCyan.Render(p[0])+" "+cDim.Render(p[1]))
	}
	return strings.Join(parts, cDim.Render("  ·  "))
}

// ---- view states ----

type view int

const (
	viewMain view = iota
	viewGit
	viewBranches
	viewCommit
	viewNewBranch
	viewSetPath
	viewCommands
	viewJira
	viewHelp
)

// ---- messages ----

type refreshMsg struct {
	running map[string]bool
	reload  map[int]bool       // service index -> live-reload port accepting connections
	reloads map[int]reloadInfo // service index -> reload count / last-event time
	branch  string
	dirty   int
	files   []string
	ahead   int
	behind  int
}
type doneMsg struct{ msg string }
type tickMsg struct{}

// ---- model ----

type model struct {
	cfg  *Config
	proj *Project
	dir  string
	web  string

	view view

	cursor   int
	selected map[int]bool
	running  map[string]bool
	reload   map[int]bool
	reloads  map[int]reloadInfo
	branch   string
	dirty    int
	files    []string
	ahead    int
	behind   int

	branches []string
	bcursor  int
	ccursor  int

	ti      textinput.Model
	msg     string
	busy    bool
	w, h    int
}

func runTUI(cfg *Config, p *Project) {
	dir := p.ResolvedPath()
	ti := textinput.New()
	ti.CharLimit = 200
	ti.Prompt = "› "
	m := model{
		cfg: cfg, proj: p, dir: dir,
		web:      bitbucketWeb(dir, p.RepoURL),
		selected: map[int]bool{},
		running:  map[string]bool{},
		reload:   map[int]bool{},
		reloads:  map[int]reloadInfo{},
		ti:       ti,
	}
	// Subscribe to each configured live-reload stream to count reload events
	// (unless disabled — the subscriber holds a connection open per port).
	if cfg.TrackReloadsEnabled() {
		for _, s := range p.Services {
			if s.ReloadPort != 0 {
				go tracker.watch(s.ReloadPort)
			}
		}
	}
	prog := tea.NewProgram(m, tea.WithAltScreen())
	_, _ = prog.Run()
}

func (m model) Init() tea.Cmd {
	return tea.Batch(m.refresh(), tickCmd())
}

// previewTUI renders each screen to stdout (a dev aid; colors degrade when piped).
func previewTUI(cfg *Config, p *Project) {
	dir := p.ResolvedPath()
	ti := textinput.New()
	ti.Prompt = "› "
	m := model{
		cfg: cfg, proj: p, dir: dir, web: bitbucketWeb(dir, p.RepoURL),
		selected: map[int]bool{0: true}, running: runningContainers(),
		reload: map[int]bool{},
		branch: gitBranch(dir), dirty: gitDirty(dir), files: gitStatusFiles(dir),
		ti: ti, w: 80,
	}
	for i, s := range p.Services {
		if s.ReloadPort != 0 {
			m.reload[i] = portActive(s.ReloadPort)
		}
	}
	m.ahead, m.behind = gitAheadBehind(dir)
	m.branches = gitBranches(dir)
	for _, v := range []view{viewMain, viewGit, viewBranches, viewCommands, viewJira, viewHelp} {
		m.view = v
		println()
		print(m.View())
		println()
	}
}

// ---- commands ----

func tickCmd() tea.Cmd {
	return tea.Tick(3*time.Second, func(time.Time) tea.Msg { return tickMsg{} })
}

func (m model) refresh() tea.Cmd {
	dir := m.dir
	svcs := m.proj.Services
	return func() tea.Msg {
		reload := map[int]bool{}
		reloads := map[int]reloadInfo{}
		for i, s := range svcs {
			if s.ReloadPort != 0 {
				reload[i] = portActive(s.ReloadPort)
				if c, last, ok := tracker.snapshot(s.ReloadPort); ok {
					reloads[i] = reloadInfo{count: c, last: last}
				}
			}
		}
		ahead, behind := gitAheadBehind(dir)
		return refreshMsg{
			running: runningContainers(),
			reload:  reload,
			reloads: reloads,
			branch:  gitBranch(dir),
			dirty:   gitDirty(dir),
			files:   gitStatusFiles(dir),
			ahead:   ahead, behind: behind,
		}
	}
}

func firstLine(s string) string {
	if i := strings.IndexByte(s, '\n'); i >= 0 {
		return s[:i]
	}
	return s
}

func action(label string, fn func() (string, error)) tea.Cmd {
	return func() tea.Msg {
		out, err := fn()
		if err != nil {
			detail := firstLine(strings.TrimSpace(out))
			if detail == "" {
				detail = err.Error()
			}
			return doneMsg{msg: cRed.Render("✗ ") + label + ": " + detail}
		}
		return doneMsg{msg: cGreen.Render("✓ ") + label}
	}
}

// targets returns the selected service indices, or the cursor row if none.
func (m model) targets() []int {
	var t []int
	for i := range m.proj.Services {
		if m.selected[i] {
			t = append(t, i)
		}
	}
	if len(t) == 0 {
		t = []int{m.cursor}
	}
	return t
}

func (m model) jiraTicket() string { return jiraTicketURL(m.proj, m.branch) }

// ---- update ----

func (m model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.w, m.h = msg.Width, msg.Height
		return m, nil
	case refreshMsg:
		m.running = msg.running
		m.reload = msg.reload
		m.reloads = msg.reloads
		m.branch = msg.branch
		m.dirty = msg.dirty
		m.files = msg.files
		m.ahead, m.behind = msg.ahead, msg.behind
		return m, nil
	case tickMsg:
		return m, tea.Batch(m.refresh(), tickCmd())
	case doneMsg:
		m.busy = false
		m.msg = msg.msg
		return m, m.refresh()
	case tea.KeyMsg:
		return m.handleKey(msg)
	}
	// let the text input consume other messages while focused
	if m.view == viewCommit || m.view == viewNewBranch || m.view == viewSetPath {
		var cmd tea.Cmd
		m.ti, cmd = m.ti.Update(msg)
		return m, cmd
	}
	return m, nil
}

func (m model) handleKey(msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	// text-input views first
	if m.view == viewCommit || m.view == viewNewBranch || m.view == viewSetPath {
		switch msg.String() {
		case "esc":
			m.ti.Blur()
			if m.view == viewSetPath {
				m.view = viewMain
			} else {
				m.view = viewGit
			}
			return m, nil
		case "enter":
			val := strings.TrimSpace(m.ti.Value())
			if m.view == viewSetPath {
				// empty is meaningful here: it clears the override.
				return m.applyBasePath(val)
			}
			if val == "" {
				m.view = viewGit
				return m, nil
			}
			dir := m.dir
			if m.view == viewCommit {
				m.view, m.busy, m.msg = viewGit, true, "committing…"
				m.ti.Blur()
				return m, action("commit", func() (string, error) { return gitCommitAll(dir, val) })
			}
			m.view, m.busy, m.msg = viewGit, true, "creating branch…"
			m.ti.Blur()
			return m, action("branch "+val, func() (string, error) { return gitCreateBranch(dir, val) })
		}
		var cmd tea.Cmd
		m.ti, cmd = m.ti.Update(msg)
		return m, cmd
	}

	switch m.view {
	case viewMain:
		return m.keyMain(msg)
	case viewGit:
		return m.keyGit(msg)
	case viewBranches:
		return m.keyBranches(msg)
	case viewCommands:
		return m.keyCommands(msg)
	case viewJira:
		return m.keyJira(msg)
	case viewHelp:
		m.view = viewMain
		return m, nil
	}
	return m, nil
}

func (m model) keyMain(msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	dir := m.dir
	n := len(m.proj.Services)
	switch msg.String() {
	case "q", "ctrl+c":
		// 'q' stops targets; capital Q / ctrl+c quits.
		var cmds []tea.Cmd
		for _, i := range m.targets() {
			s := m.proj.Services[i]
			cmds = append(cmds, action("stop "+s.Label, func() (string, error) { return stopService(dir, s) }))
		}
		m.busy, m.msg = true, "stopping…"
		return m, tea.Batch(cmds...)
	case "Q":
		return m, tea.Quit
	case "esc":
		if len(m.selected) > 0 {
			m.selected = map[int]bool{}
			m.msg = cDim.Render("selection cleared")
			return m, nil
		}
		return m, tea.Quit
	case "up":
		m.cursor = (m.cursor - 1 + n) % n
	case "down":
		m.cursor = (m.cursor + 1) % n
	case " ":
		if m.selected[m.cursor] {
			delete(m.selected, m.cursor)
		} else {
			m.selected[m.cursor] = true
		}
	case "a":
		if len(m.selected) == n {
			m.selected = map[int]bool{}
		} else {
			for i := 0; i < n; i++ {
				m.selected[i] = true
			}
		}
	case "1", "2", "3", "4", "5", "6", "7", "8", "9":
		i := int(msg.String()[0]-'1')
		if i < n {
			m.cursor = i
			if m.selected[i] {
				delete(m.selected, i)
			} else {
				m.selected[i] = true
			}
		}
	case "enter":
		var cmds []tea.Cmd
		for _, i := range m.targets() {
			s := m.proj.Services[i]
			cmds = append(cmds, action("start "+s.Label, func() (string, error) { return startService(dir, s) }))
		}
		m.busy, m.msg = true, "starting…"
		return m, tea.Batch(cmds...)
	case "o":
		var last string
		for _, i := range m.targets() {
			last = openURL(m.proj.Services[i].URL)
		}
		m.msg = cCyan.Render(last)
	case "r":
		var cmds []tea.Cmd
		for _, i := range m.targets() {
			s := m.proj.Services[i]
			cmds = append(cmds, action("restart "+s.Label, func() (string, error) { return restartService(dir, s) }))
		}
		m.busy, m.msg = true, "restarting…"
		return m, tea.Batch(cmds...)
	case "g":
		m.view = viewGit
	case "c":
		m.ccursor, m.view = 0, viewCommands
	case "j":
		m.view = viewJira
	case "b":
		m.msg = cCyan.Render(openURL(m.web))
	case "p":
		// edit the base path under which repos are found
		base := projectRoot
		if base == "" {
			base = filepath.Dir(m.dir)
		}
		m.ti.SetValue(base)
		m.ti.Placeholder = "~/dev"
		m.ti.CursorEnd()
		m.ti.Focus()
		m.view = viewSetPath
	case "?", "h":
		m.view = viewHelp
	}
	return m, nil
}

// applyBasePath persists the base path (empty clears it), re-resolves the
// current project's directory under the new root, and refreshes.
func (m model) applyBasePath(val string) (tea.Model, tea.Cmd) {
	m.ti.Blur()
	m.view = viewMain
	if err := saveRootOverride(val); err != nil {
		m.msg = cRed.Render("✗ ") + "save base path: " + err.Error()
		return m, nil
	}
	if val == "" {
		projectRoot = ""
		m.msg = cDim.Render("base path cleared")
	} else {
		projectRoot = expandPath(val)
		m.msg = cGreen.Render("✓ ") + "base path " + projectRoot
	}
	m.dir = m.proj.ResolvedPath()
	m.web = bitbucketWeb(m.dir, m.proj.RepoURL)
	return m, m.refresh()
}

func (m model) keyGit(msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	dir := m.dir
	switch msg.String() {
	case "esc", "q":
		m.view = viewMain
	case "c":
		m.ti.SetValue("")
		m.ti.Placeholder = "commit message"
		m.ti.Focus()
		m.view = viewCommit
	case "b":
		m.branches = gitBranches(dir)
		m.bcursor, m.view = 0, viewBranches
	case "n":
		m.ti.SetValue("")
		m.ti.Placeholder = "new-branch-name"
		m.ti.Focus()
		m.view = viewNewBranch
	case "s":
		m.busy, m.msg = true, "stashing…"
		return m, action("stash", func() (string, error) { return gitStash(dir) })
	case "S":
		m.busy, m.msg = true, "stash pop…"
		return m, action("stash pop", func() (string, error) { return gitStashPop(dir) })
	case "p":
		m.busy, m.msg = true, "pulling…"
		return m, action("pull", func() (string, error) { return gitPull(dir) })
	case "P":
		br := m.branch
		m.busy, m.msg = true, "pushing…"
		return m, action("push "+br, func() (string, error) { return gitPush(dir, br) })
	case "o":
		m.msg = cCyan.Render(openURL(bitbucketPRNew(m.web, m.branch)))
	case "B":
		m.msg = cCyan.Render(openURL(m.web))
	}
	return m, nil
}

func (m model) keyBranches(msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	dir := m.dir
	n := len(m.branches)
	switch msg.String() {
	case "esc", "q":
		m.view = viewGit
	case "up", "k":
		if n > 0 {
			m.bcursor = (m.bcursor - 1 + n) % n
		}
	case "down", "j":
		if n > 0 {
			m.bcursor = (m.bcursor + 1) % n
		}
	case "n":
		m.ti.SetValue("")
		m.ti.Placeholder = "new-branch-name"
		m.ti.Focus()
		m.view = viewNewBranch
	case "enter":
		if n == 0 {
			return m, nil
		}
		br := m.branches[m.bcursor]
		m.view, m.busy, m.msg = viewGit, true, "checking out…"
		return m, action("checkout "+br, func() (string, error) { return gitCheckout(dir, br) })
	}
	return m, nil
}

func (m model) keyCommands(msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	n := len(m.proj.Commands)
	switch msg.String() {
	case "esc", "q":
		m.view = viewMain
	case "up", "k":
		if n > 0 {
			m.ccursor = (m.ccursor - 1 + n) % n
		}
	case "down", "j":
		if n > 0 {
			m.ccursor = (m.ccursor + 1) % n
		}
	case "enter":
		if n == 0 {
			return m, nil
		}
		c := m.proj.Commands[m.ccursor]
		cmd := exec.Command("sh", "-c", c.Run)
		cmd.Dir = m.dir
		// suspend the TUI, run attached to the terminal, then resume.
		return m, tea.ExecProcess(cmd, func(err error) tea.Msg {
			if err != nil {
				return doneMsg{msg: cRed.Render("✗ ") + c.Label + ": " + err.Error()}
			}
			return doneMsg{msg: cGreen.Render("✓ ") + c.Label}
		})
	}
	return m, nil
}

func (m model) keyJira(msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	switch msg.String() {
	case "esc", "q":
		m.view = viewMain
	case "t":
		m.msg = cCyan.Render(openURL(m.jiraTicket()))
		m.view = viewMain
	case "b":
		m.msg = cCyan.Render(openURL(m.proj.JiraBoard))
		m.view = viewMain
	}
	return m, nil
}

// ---- view ----

func dotFor(s svcState) string {
	switch s {
	case stRunning:
		return cGreen.Render("●")
	case stPartial:
		return cYellow.Render("◐")
	default:
		return cDim.Render("○")
	}
}

func (m model) header() string {
	line1 := cTitle.Render(" work ") + "  " + cBold.Render(m.proj.Name)
	if m.branch == "" {
		return line1
	}
	info := cDim.Render("branch ") + cCyan.Render(m.branch)
	if m.dirty > 0 {
		info += "  " + badge(itoa(m.dirty)+" changed", colAmber)
	} else {
		info += "  " + cGreen.Render("clean")
	}
	if m.ahead > 0 {
		info += "  " + cDim.Render("↑"+itoa(m.ahead))
	}
	if m.behind > 0 {
		info += "  " + cDim.Render("↓"+itoa(m.behind))
	}
	return line1 + "\n" + info
}

// agoShort renders a compact "time since" like 4s / 3m / 2h / 5d.
func agoShort(t time.Time) string {
	d := time.Since(t)
	switch {
	case d < time.Minute:
		return itoa(int(d.Seconds())) + "s"
	case d < time.Hour:
		return itoa(int(d.Minutes())) + "m"
	case d < 24*time.Hour:
		return itoa(int(d.Hours())) + "h"
	default:
		return itoa(int(d.Hours()/24)) + "d"
	}
}

func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	neg := n < 0
	if neg {
		n = -n
	}
	var buf [20]byte
	i := len(buf)
	for n > 0 {
		i--
		buf[i] = byte('0' + n%10)
		n /= 10
	}
	if neg {
		i--
		buf[i] = '-'
	}
	return string(buf[i:])
}

// frame draws the header and body inside a rounded box with a full-width divider
// under the header. Two-pass: render once so lipgloss auto-sizes the border to the
// widest line, read the true inner width from the (pure box-drawing) top border,
// then draw a divider that exactly matches it.
func frame(header, body string) string {
	first := stApp.Render(header + "\n\n" + body)
	top := first
	if nl := strings.IndexByte(first, '\n'); nl >= 0 {
		top = first[:nl]
	}
	inner := lipgloss.Width(top) - 6 // 2 border + 2*2 padding
	if inner < 10 {
		inner = 10
	}
	div := lipgloss.NewStyle().Foreground(lipgloss.Color(colFaint)).Render(strings.Repeat("─", inner))
	return stApp.Render(header + "\n" + div + "\n\n" + body)
}

func truncate(s string, n int) string {
	r := []rune(s)
	if len(r) <= n {
		return s
	}
	if n <= 1 {
		return string(r[:n])
	}
	return string(r[:n-1]) + "…"
}

func (m model) View() string {
	var b strings.Builder

	switch m.view {
	case viewMain:
		m.viewMainBody(&b)
	case viewGit:
		m.viewGitBody(&b)
	case viewBranches:
		m.viewBranchesBody(&b)
	case viewCommit:
		b.WriteString(cBold.Render("Commit") + cDim.Render("   all changes will be staged") + "\n\n")
		m.writeFiles(&b)
		b.WriteString("\n" + m.ti.View() + "\n\n" + hint([2]string{"↵", "commit"}, [2]string{"esc", "cancel"}))
	case viewNewBranch:
		b.WriteString(cBold.Render("New branch") + "\n\n" + m.ti.View() + "\n\n" +
			hint([2]string{"↵", "create & checkout"}, [2]string{"esc", "cancel"}))
	case viewSetPath:
		b.WriteString(cBold.Render("Set base path") + "\n\n")
		b.WriteString(cDim.Render("Where your repos live — each project is looked for under this dir,") + "\n")
		b.WriteString(cDim.Render("so you can point work at a clone installed elsewhere.") + "\n\n")
		b.WriteString(m.ti.View() + "\n\n")
		cur := projectRoot
		if cur == "" {
			cur = cDim.Render("(none — using config paths)")
		} else {
			cur = stURL.Render(cur)
		}
		b.WriteString(cDim.Render("current ") + cur + "\n")
		b.WriteString(cDim.Render("saved to ") + stURL.Render(overridesPath()) + cDim.Render("  ·  config.toml untouched") + "\n\n")
		b.WriteString(hint([2]string{"↵", "save"}, [2]string{"empty ↵", "clear"}, [2]string{"esc", "cancel"}))
	case viewCommands:
		m.viewCommandsBody(&b)
	case viewJira:
		b.WriteString(cBold.Render("Jira") + "\n\n")
		b.WriteString("  " + cCyan.Render("t") + cDim.Render(" ticket  ") + stURL.Render(m.jiraTicket()) + "\n")
		b.WriteString("  " + cCyan.Render("b") + cDim.Render(" board   ") + stURL.Render(m.proj.JiraBoard) + "\n\n")
		b.WriteString(hint([2]string{"esc", "back"}))
	case viewHelp:
		m.viewHelpBody(&b)
	}

	if m.msg != "" {
		b.WriteString("\n\n" + cDim.Render("›") + " " + m.msg)
	}
	return frame(m.header(), b.String())
}

// row renders a selectable list row with a cursor bar + selection box.
func row(cursor, selected bool, body string) string {
	bar := "  "
	if cursor {
		bar = stBar.Render("▌") + " "
	}
	box := cDim.Render("▢")
	if selected {
		box = stSel.Render("▣")
	}
	return bar + box + " " + body
}

func (m model) viewMainBody(b *strings.Builder) {
	labelW := lipgloss.NewStyle().Width(22)
	statusW := lipgloss.NewStyle().Width(10)
	for i, s := range m.proj.Services {
		st := serviceState(m.dir, s, m.running)
		var status string
		switch st {
		case stRunning:
			status = badge("running", colGreen)
		case stPartial:
			status = badge("partial", colAmber)
		default:
			status = cDim.Render("idle")
		}
		label := truncate(s.Label, 22)
		if i == m.cursor {
			label = stCur.Render(label)
		}
		body := dotFor(st) + " " + cDim.Render(itoa(i+1)) + "  " +
			labelW.Render(label) + " " + statusW.Render(status) + " " + stURL.Render(s.URL)
		if s.ReloadPort != 0 {
			if m.reload[i] {
				txt := "⟳ live :" + itoa(s.ReloadPort)
				if ri, ok := m.reloads[i]; ok && ri.count > 0 {
					txt += " · " + itoa(ri.count) + " · " + agoShort(ri.last)
				}
				body += "  " + badge(txt, colCyan)
			} else {
				body += "  " + cDim.Render("⟳ off")
			}
		}
		b.WriteString(row(i == m.cursor, m.selected[i], body) + "\n")
	}
	b.WriteString("\n")
	b.WriteString(hint(
		[2]string{"↑↓", "move"}, [2]string{"space", "select"}, [2]string{"a", "all"},
		[2]string{"↵", "start"}, [2]string{"o", "open"}, [2]string{"r", "restart"}, [2]string{"q", "stop"}) + "\n")
	b.WriteString(hint(
		[2]string{"g", "git"}, [2]string{"c", "cmds"}, [2]string{"j", "jira"},
		[2]string{"b", "bucket"}, [2]string{"p", "base path"}, [2]string{"?", "help"}, [2]string{"Q", "quit"}))
}

func (m model) viewGitBody(b *strings.Builder) {
	b.WriteString(cBold.Render("Git") + "  " + cCyan.Render(m.branch))
	if m.dirty > 0 {
		b.WriteString("  " + badge(itoa(m.dirty)+" changed", colAmber))
	}
	b.WriteString("\n\n")
	if m.dirty == 0 {
		b.WriteString("  " + cGreen.Render("working tree clean") + "\n")
	} else {
		m.writeFiles(b)
	}
	b.WriteString("\n")
	b.WriteString(hint(
		[2]string{"c", "commit"}, [2]string{"b", "branch"}, [2]string{"n", "new"},
		[2]string{"s", "stash"}, [2]string{"S", "pop"}, [2]string{"p", "pull"}, [2]string{"P", "push"}) + "\n")
	b.WriteString(hint(
		[2]string{"o", "open PR"}, [2]string{"B", "bitbucket"}, [2]string{"esc", "back"}))
}

func (m model) writeFiles(b *strings.Builder) {
	max := 12
	for i, f := range m.files {
		if i >= max {
			b.WriteString("  " + cDim.Render("… and "+itoa(len(m.files)-max)+" more") + "\n")
			break
		}
		code, rest := "  ", f
		if len(f) > 3 {
			code, rest = f[:2], f[3:]
		}
		// staged (index) col green, worktree col amber
		x, y := " ", " "
		if len(code) == 2 {
			x, y = string(code[0]), string(code[1])
		}
		mark := cGreen.Render(x) + cYellow.Render(y)
		b.WriteString("  " + mark + "  " + rest + "\n")
	}
}

func (m model) viewBranchesBody(b *strings.Builder) {
	b.WriteString(cBold.Render("Branches") + "\n\n")
	if len(m.branches) == 0 {
		b.WriteString("  " + cDim.Render("(none)") + "\n")
	}
	for i, br := range m.branches {
		name := br
		if i == m.bcursor {
			name = stCur.Render(br)
		}
		marker := ""
		if br == m.branch {
			marker = "  " + badge("current", colGreen)
		}
		bar := "  "
		if i == m.bcursor {
			bar = stBar.Render("▌") + " "
		}
		b.WriteString(bar + name + marker + "\n")
	}
	b.WriteString("\n" + hint(
		[2]string{"↑↓", "move"}, [2]string{"↵", "checkout"}, [2]string{"n", "new"}, [2]string{"esc", "back"}))
}

func (m model) viewCommandsBody(b *strings.Builder) {
	b.WriteString(cBold.Render("Commands") + "\n\n")
	if len(m.proj.Commands) == 0 {
		b.WriteString("  " + cDim.Render("(none configured)") + "\n")
	}
	nameW := lipgloss.NewStyle().Width(18)
	for i, c := range m.proj.Commands {
		name := c.Name
		if i == m.ccursor {
			name = stCur.Render(name)
		}
		bar := "  "
		if i == m.ccursor {
			bar = stBar.Render("▌") + " "
		}
		b.WriteString(bar + nameW.Render(name) + cDim.Render(c.Label) + "\n")
	}
	b.WriteString("\n" + hint([2]string{"↑↓", "move"}, [2]string{"↵", "run"}, [2]string{"esc", "back"}))
}

func (m model) viewHelpBody(b *strings.Builder) {
	b.WriteString(cBold.Render("Help") + "\n\n")
	section := func(title string, rows ...[2]string) {
		b.WriteString("  " + cCyan.Render(title) + "\n")
		for _, r := range rows {
			b.WriteString("    " + cBold.Render(padKey(r[0])) + cDim.Render(r[1]) + "\n")
		}
		b.WriteString("\n")
	}
	section("Main",
		[2]string{"↑↓ / 1-9", "move / jump"},
		[2]string{"space / a", "select / all"},
		[2]string{"↵ o r q", "start · open · restart · stop"},
		[2]string{"g c j b", "git · cmds · jira · bitbucket"},
		[2]string{"p", "set base path (where repos live)"})
	section("Git (g)",
		[2]string{"c b n", "commit · switch branch · new branch"},
		[2]string{"s S p P", "stash · pop · pull · push"},
		[2]string{"o B", "open PR · open repo"})
	section("Jira (j)",
		[2]string{"t b", "ticket from branch · board"})
	b.WriteString("  " + cDim.Render("Commands run attached to the terminal, then return here.") + "\n")
	b.WriteString("  " + cDim.Render("Config: "+configPath()) + "\n\n")
	b.WriteString(hint([2]string{"any key", "back"}))
}

func padKey(s string) string {
	const n = 12
	if len(s) >= n {
		return s + "  "
	}
	return s + strings.Repeat(" ", n-len(s))
}
