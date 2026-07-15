package main

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"strings"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/remcostoeten/bpr/internal/bitbucket"
	"github.com/remcostoeten/bpr/internal/cache"
	"github.com/remcostoeten/bpr/internal/jira"
)

type tab int

const (
	tabPRs tab = iota
	tabTickets
)

type prRow struct {
	pr       bitbucket.PR
	ci       ciSummary
	ciLoaded bool
}

// inputState captures a single line of text (comment, etc).
type inputState struct {
	prompt string
	value  string
	submit func(m *model, val string) tea.Cmd
}

type model struct {
	a      *app
	ctx    context.Context
	branch string

	tab           tab
	width, height int

	prs          []prRow
	prCursor     int
	prOffset     int
	prsLoading   bool
	filteredPRs  []int

	issues        []jira.Issue
	isCursor      int
	isOffset      int
	issuesLoading bool
	filteredIssues []int

	detail      bool
	comments    []bitbucket.Comment
	transitions []jira.Transition
	loadingSub  bool // detail sub-resource loading

	input      *inputState
	choosing   []choice // transition picker
	chCursor   int
	wantPicker bool

	filtering bool
	filter    string

	status   string
	errMsg   string
	quitting bool
}

type choice struct {
	label string
	id    string
}

// --- messages ---

type prsMsg struct {
	prs []bitbucket.PR
	err error
}
type ciMsg struct {
	id int
	ci ciSummary
}
type issuesMsg struct {
	issues []jira.Issue
	err    error
}
type commentsMsg struct {
	comments []bitbucket.Comment
	err      error
}
type transitionsMsg struct {
	transitions []jira.Transition
	err         error
}
type actionMsg struct {
	text  string
	err   error
	after tea.Cmd
}
type editorDoneMsg struct {
	id   int
	path string
	err  error
}

// --- commands ---

func (m *model) loadPRs() tea.Cmd {
	a, ctx := m.a, m.ctx
	return func() tea.Msg {
		prs, err := a.bb.ListOpenPRs(ctx, a.slug)
		return prsMsg{prs, err}
	}
}

func (m *model) loadCI(id int, sha string) tea.Cmd {
	a, ctx := m.a, m.ctx
	return func() tea.Msg {
		st, _ := a.bb.Statuses(ctx, a.slug, sha)
		return ciMsg{id, summarizeCI(st)}
	}
}

func (m *model) loadIssues() tea.Cmd {
	a, ctx := m.a, m.ctx
	if !a.hasJira() {
		return func() tea.Msg { return issuesMsg{nil, nil} }
	}
	return func() tea.Msg {
		is, err := a.jira.MyIssues(ctx, a.settings.JiraProject)
		return issuesMsg{is, err}
	}
}

func (m *model) loadComments(id int) tea.Cmd {
	a, ctx := m.a, m.ctx
	return func() tea.Msg {
		cs, err := a.bb.Comments(ctx, a.slug, id)
		return commentsMsg{cs, err}
	}
}

func (m *model) loadTransitions(key string) tea.Cmd {
	a, ctx := m.a, m.ctx
	return func() tea.Msg {
		ts, err := a.jira.Transitions(ctx, key)
		return transitionsMsg{ts, err}
	}
}

// editorCommand resolves which binary to launch for editing: $EDITOR, then
// $VISUAL, falling back to nvim.
func editorCommand() string {
	if e := os.Getenv("EDITOR"); e != "" {
		return e
	}
	if e := os.Getenv("VISUAL"); e != "" {
		return e
	}
	return "nvim"
}

// editDescription opens the PR's description in $EDITOR/nvim via a temp
// file, suspending the TUI until the editor exits.
func (m *model) editDescription(id int, description string) tea.Cmd {
	f, err := os.CreateTemp("", fmt.Sprintf("bpr-pr-%d-*.md", id))
	if err != nil {
		return func() tea.Msg { return editorDoneMsg{id: id, err: err} }
	}
	path := f.Name()
	_, werr := f.WriteString(description)
	f.Close()
	if werr != nil {
		os.Remove(path)
		return func() tea.Msg { return editorDoneMsg{id: id, err: werr} }
	}

	cmd := exec.Command(editorCommand(), path)
	return tea.ExecProcess(cmd, func(err error) tea.Msg {
		return editorDoneMsg{id: id, path: path, err: err}
	})
}

// act wraps a mutating call, reporting a status line and an optional follow-up.
func act(text string, fn func() error, after tea.Cmd) tea.Cmd {
	return func() tea.Msg {
		err := fn()
		return actionMsg{text: text, err: err, after: after}
	}
}

func (m model) Init() tea.Cmd {
	return tea.Batch(m.loadPRs(), m.loadIssues())
}

func (m *model) prCacheKey() string    { return "prs-" + m.a.slug }
func (m *model) issueCacheKey() string { return "issues-" + m.a.slug }

func runTUI(a *app) error {
	m := model{
		a:             a,
		ctx:           context.Background(),
		branch:        currentBranch(a.dir),
		width:         80,
		height:        24,
		prsLoading:    true,
		issuesLoading: a.hasJira(),
	}
	// Paint instantly from the last known state; live loads replace it.
	var cachedPRs []bitbucket.PR
	if _, ok := cache.Load(m.prCacheKey(), &cachedPRs); ok && len(cachedPRs) > 0 {
		m.prs = make([]prRow, len(cachedPRs))
		for i, pr := range cachedPRs {
			m.prs[i] = prRow{pr: pr}
		}
		m.prsLoading = false
	}
	if a.hasJira() {
		var cachedIssues []jira.Issue
		if _, ok := cache.Load(m.issueCacheKey(), &cachedIssues); ok && len(cachedIssues) > 0 {
			m.issues = cachedIssues
			m.issuesLoading = false
		}
	}
	_, err := tea.NewProgram(m, tea.WithAltScreen()).Run()
	return err
}

// --- current selections ---

func (m *model) curPR() *prRow {
	if m.tab != tabPRs || m.prCursor < 0 || m.prCursor >= len(m.filteredPRs) {
		return nil
	}
	return &m.prs[m.filteredPRs[m.prCursor]]
}

func (m *model) curIssue() *jira.Issue {
	if m.tab != tabTickets || m.isCursor < 0 || m.isCursor >= len(m.filteredIssues) {
		return nil
	}
	return &m.issues[m.filteredIssues[m.isCursor]]
}

// --- update ---

func (m model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width, m.height = msg.Width, msg.Height
		return m, nil

	case prsMsg:
		m.prsLoading = false
		if msg.err != nil {
			m.errMsg = msg.err.Error()
			return m, nil
		}
		cache.Save(m.prCacheKey(), msg.prs)
		m.prs = make([]prRow, len(msg.prs))
		var cmds []tea.Cmd
		for i, pr := range msg.prs {
			m.prs[i] = prRow{pr: pr}
			cmds = append(cmds, m.loadCI(pr.ID, pr.Source.Commit.Hash))
		}
		if m.prCursor >= len(m.prs) {
			m.prCursor = 0
		}
		m.applyFilter()
		m.adjustPROffset()
		return m, tea.Batch(cmds...)

	case ciMsg:
		for i := range m.prs {
			if m.prs[i].pr.ID == msg.id {
				m.prs[i].ci = msg.ci
				m.prs[i].ciLoaded = true
				break
			}
		}
		return m, nil

	case issuesMsg:
		m.issuesLoading = false
		if msg.err != nil {
			m.errMsg = msg.err.Error()
			return m, nil
		}
		cache.Save(m.issueCacheKey(), msg.issues)
		m.issues = msg.issues
		if m.isCursor >= len(m.issues) {
			m.isCursor = 0
		}
		m.applyFilter()
		m.adjustIsOffset()
		return m, nil

	case commentsMsg:
		m.loadingSub = false
		m.comments = msg.comments
		return m, nil

	case transitionsMsg:
		m.loadingSub = false
		m.transitions = msg.transitions
		if msg.err != nil {
			m.errMsg = msg.err.Error()
			m.wantPicker = false
			return m, nil
		}
		if m.wantPicker {
			m.wantPicker = false
			m.status = ""
			m.choosing = make([]choice, len(msg.transitions))
			for i, t := range msg.transitions {
				label := t.Name
				if t.To.Name != "" && t.To.Name != t.Name {
					label = t.Name + " → " + t.To.Name
				}
				m.choosing[i] = choice{label: label, id: t.ID}
			}
			m.chCursor = 0
		}
		return m, nil

	case actionMsg:
		if msg.err != nil {
			m.errMsg = msg.err.Error()
		} else {
			m.status = msg.text
		}
		if msg.after != nil {
			return m, msg.after
		}
		return m, nil

	case editorDoneMsg:
		if msg.path != "" {
			defer os.Remove(msg.path)
		}
		if msg.err != nil {
			m.errMsg = "editor: " + msg.err.Error()
			return m, nil
		}
		raw, err := os.ReadFile(msg.path)
		if err != nil {
			m.errMsg = err.Error()
			return m, nil
		}
		description := strings.TrimRight(string(raw), "\n")
		pr := &prRow{}
		for i := range m.prs {
			if m.prs[i].pr.ID == msg.id {
				pr = &m.prs[i]
				break
			}
		}
		title := pr.pr.Title
		id := msg.id
		return m, act(fmt.Sprintf("updated description on #%d", id),
			func() error { return m.a.bb.UpdatePR(m.ctx, m.a.slug, id, title, description) },
			m.loadPRs())

	case tea.KeyMsg:
		return m.handleKey(msg)
	}
	return m, nil
}

func (m model) handleKey(msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	// Text input mode swallows keys.
	if m.input != nil {
		switch msg.Type {
		case tea.KeyEsc:
			m.input = nil
		case tea.KeyEnter:
			in := m.input
			val := strings.TrimSpace(in.value)
			m.input = nil
			if val != "" {
				return m, in.submit(&m, val)
			}
		case tea.KeyBackspace:
			if len(m.input.value) > 0 {
				m.input.value = m.input.value[:len(m.input.value)-1]
			}
		case tea.KeyRunes, tea.KeySpace:
			m.input.value += string(msg.Runes)
		}
		return m, nil
	}

	// Filter mode.
	if m.filtering {
		switch msg.Type {
		case tea.KeyEsc:
			m.filtering = false
			m.filter = ""
			m.applyFilter()
		case tea.KeyEnter:
			m.filtering = false
		case tea.KeyBackspace:
			if len(m.filter) > 0 {
				m.filter = m.filter[:len(m.filter)-1]
				m.applyFilter()
			}
		case tea.KeyRunes, tea.KeySpace:
			m.filter += string(msg.Runes)
			m.applyFilter()
		}
		return m, nil
	}

	// Transition picker mode.
	if m.choosing != nil {
		switch msg.String() {
		case "esc", "q":
			m.choosing = nil
		case "up", "k":
			if m.chCursor > 0 {
				m.chCursor--
			}
		case "down", "j":
			if m.chCursor < len(m.choosing)-1 {
				m.chCursor++
			}
		case "enter":
			ch := m.choosing[m.chCursor]
			key := ""
			if is := m.curIssue(); is != nil {
				key = is.Key
			}
			m.choosing = nil
			if key != "" {
				return m, act("moved "+key+" → "+ch.label,
					func() error { return m.a.jira.Transition(m.ctx, key, ch.id) },
					m.loadIssues())
			}
		}
		return m, nil
	}

	switch msg.String() {
	case "q", "ctrl+c":
		m.quitting = true
		return m, tea.Quit
	case "esc", "backspace":
		if m.detail {
			m.detail = false
			m.comments = nil
			m.transitions = nil
			return m, nil
		}
		if m.tab != tabPRs {
			m.tab = tabPRs
			return m, nil
		}
		return m, nil
	case "tab", "right", "l":
		if !m.detail {
			m.tab = tabTickets
		}
		return m, nil
	case "shift+tab", "left", "h":
		if !m.detail {
			m.tab = tabPRs
		}
		return m, nil
	case "1":
		if !m.detail { m.moveTo(0) }
		return m, nil
	case "2":
		if !m.detail { m.moveTo(1) }
		return m, nil
	case "3":
		if !m.detail { m.moveTo(2) }
		return m, nil
	case "4":
		if !m.detail { m.moveTo(3) }
		return m, nil
	case "5":
		if !m.detail { m.moveTo(4) }
		return m, nil
	case "6":
		if !m.detail { m.moveTo(5) }
		return m, nil
	case "7":
		if !m.detail { m.moveTo(6) }
		return m, nil
	case "8":
		if !m.detail { m.moveTo(7) }
		return m, nil
	case "9":
		if !m.detail { m.moveTo(8) }
		return m, nil
	case "up", "k":
		m.moveCursor(-1)
		return m, nil
	case "down", "j":
		m.moveCursor(1)
		return m, nil
	case "/", "f":
		if !m.detail {
			m.filtering = true
		}
		return m, nil
	case "?":
		m.status = "↑↓ nav · enter detail · a approve · u unapprove · m merge · d decline · c comment · e edit description · t transition · o web · r refresh · / filter · tab switch · q quit"
		m.quitting = false
		return m, nil
	case "r":
		m.status = "refreshing…"
		m.prsLoading = true
		m.issuesLoading = m.a.hasJira()
		return m, tea.Batch(m.loadPRs(), m.loadIssues())
	case "enter":
		return m.openDetail()
	case "o":
		return m.openWeb()
	}

	if m.tab == tabPRs {
		return m.prAction(msg)
	}
	return m.issueAction(msg)
}

func (m model) maxPRsVisible() int {
	h := m.height - 7
	if h < 2 {
		return 1
	}
	return max((h+1)/3, 1)
}

func (m model) maxIssuesVisible() int {
	h := m.height - 7
	if h < 1 {
		return 1
	}
	return max((h+1)/2, 1)
}

func (m *model) applyFilter() {
	m.filteredPRs = nil
	for i := range m.prs {
		if m.filter == "" || strings.Contains(strings.ToLower(m.prs[i].pr.Title), strings.ToLower(m.filter)) {
			m.filteredPRs = append(m.filteredPRs, i)
		}
	}
	m.filteredIssues = nil
	for i := range m.issues {
		if m.filter == "" || strings.Contains(strings.ToLower(m.issues[i].Summary()), strings.ToLower(m.filter)) {
			m.filteredIssues = append(m.filteredIssues, i)
		}
	}
	if m.prCursor >= len(m.filteredPRs) {
		m.prCursor = max(len(m.filteredPRs)-1, 0)
	}
	if m.isCursor >= len(m.filteredIssues) {
		m.isCursor = max(len(m.filteredIssues)-1, 0)
	}
}

func (m *model) adjustPROffset() {
	n := len(m.filteredPRs)
	v := m.maxPRsVisible()
	if m.prCursor < m.prOffset {
		m.prOffset = m.prCursor
	}
	if m.prCursor >= m.prOffset+v {
		m.prOffset = m.prCursor - v + 1
	}
	m.prOffset = clamp(m.prOffset, 0, max(n-v, 0))
}

func (m *model) adjustIsOffset() {
	n := len(m.filteredIssues)
	v := m.maxIssuesVisible()
	if m.isCursor < m.isOffset {
		m.isOffset = m.isCursor
	}
	if m.isCursor >= m.isOffset+v {
		m.isOffset = m.isCursor - v + 1
	}
	m.isOffset = clamp(m.isOffset, 0, max(n-v, 0))
}

func (m *model) moveCursor(d int) {
	if m.tab == tabPRs {
		m.prCursor = clamp(m.prCursor+d, 0, len(m.filteredPRs)-1)
		m.adjustPROffset()
	} else {
		m.isCursor = clamp(m.isCursor+d, 0, len(m.filteredIssues)-1)
		m.adjustIsOffset()
	}
}

func (m *model) moveTo(idx int) {
	if m.tab == tabPRs {
		if idx < len(m.filteredPRs) {
			m.prCursor = idx
			m.adjustPROffset()
		}
	} else {
		if idx < len(m.filteredIssues) {
			m.isCursor = idx
			m.adjustIsOffset()
		}
	}
}

func (m model) openDetail() (tea.Model, tea.Cmd) {
	if m.tab == tabPRs {
		if pr := m.curPR(); pr != nil {
			m.detail = true
			m.loadingSub = true
			return m, m.loadComments(pr.pr.ID)
		}
	} else {
		if is := m.curIssue(); is != nil {
			m.detail = true
			m.loadingSub = false
		}
	}
	return m, nil
}

func (m model) openWeb() (tea.Model, tea.Cmd) {
	if pr := m.curPR(); pr != nil {
		openURL(pr.pr.Links.HTML.Href)
		m.status = "opened PR in browser"
	} else if is := m.curIssue(); is != nil && m.a.hasJira() {
		openURL(m.a.jira.BrowseURL(is.Key))
		m.status = "opened issue in browser"
	}
	return m, nil
}

func (m model) prAction(msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	pr := m.curPR()
	if pr == nil {
		return m, nil
	}
	id := pr.pr.ID
	switch msg.String() {
	case "a":
		return m, act(fmt.Sprintf("approved #%d", id),
			func() error { return m.a.bb.Approve(m.ctx, m.a.slug, id) }, m.loadPRs())
	case "u":
		return m, act(fmt.Sprintf("unapproved #%d", id),
			func() error { return m.a.bb.Unapprove(m.ctx, m.a.slug, id) }, m.loadPRs())
	case "m":
		return m, act(fmt.Sprintf("merged #%d", id),
			func() error {
				return m.a.bb.Merge(m.ctx, m.a.slug, id, bitbucket.MergeOptions{CloseSourceBranch: true})
			}, m.loadPRs())
	case "d":
		return m, act(fmt.Sprintf("declined #%d", id),
			func() error { return m.a.bb.Decline(m.ctx, m.a.slug, id) }, m.loadPRs())
	case "c":
		m.input = &inputState{
			prompt: fmt.Sprintf("Comment on #%d", id),
			submit: func(mm *model, val string) tea.Cmd {
				return act("commented", func() error {
					return mm.a.bb.AddComment(mm.ctx, mm.a.slug, id, val)
				}, mm.loadComments(id))
			},
		}
		return m, nil
	case "e":
		return m, m.editDescription(id, pr.pr.Description)
	}
	return m, nil
}

func (m model) issueAction(msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	is := m.curIssue()
	if is == nil || !m.a.hasJira() {
		return m, nil
	}
	key := is.Key
	switch msg.String() {
	case "t":
		m.wantPicker = true
		m.loadingSub = true
		m.choosing = []choice{}
		m.status = "loading transitions…"
		return m, m.loadTransitions(key)
	case "c":
		m.input = &inputState{
			prompt: "Comment on " + key,
			submit: func(mm *model, val string) tea.Cmd {
				return act("commented on "+key, func() error {
					return mm.a.jira.AddComment(mm.ctx, key, val)
				}, nil)
			},
		}
		return m, nil
	case "b":
		branch := key + "-" + slugify(is.Summary())
		return m, act("created branch "+branch,
			func() error { _, err := git(m.a.dir, "checkout", "-b", branch); return err }, nil)
	}
	return m, nil
}

func clamp(v, lo, hi int) int {
	if hi < lo {
		return lo
	}
	if v < lo {
		return lo
	}
	if v > hi {
		return hi
	}
	return v
}

// --- view ---

var selRow = lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("6"))

func (m model) View() string {
	if m.quitting {
		return ""
	}
	var b strings.Builder
	b.WriteString(m.header() + "\n")

	if m.filtering {
		b.WriteString(cCyan.Render("  filter: ") + m.filter + cCyan.Render("▏") + strings.Repeat(" ", max(m.width-len(m.filter)-12, 0)) + "\n")
	} else if m.filter != "" {
		b.WriteString(cDim.Render(fmt.Sprintf("  filter: %s   clear: esc", m.filter)) + "\n")
	}
	b.WriteString("\n")

	if m.choosing != nil {
		b.WriteString(m.pickerView())
	} else if m.detail {
		b.WriteString(m.detailView())
	} else if m.tab == tabPRs {
		b.WriteString(m.prsView())
	} else {
		b.WriteString(m.ticketsView())
	}

	b.WriteString("\n" + m.footer())
	return b.String()
}

func (m model) header() string {
	sep := cDim.Render(strings.Repeat("━", max(m.width, 1)))
	prLabel := " PRs "
	tkLabel := " Tickets "
	if m.tab == tabPRs {
		prLabel = cBold.Render("PRs")
		tkLabel = cDim.Render("Tickets")
	} else {
		prLabel = cDim.Render("PRs")
		tkLabel = cBold.Render("Tickets")
	}
	right := cDim.Render(m.a.slug)
	if m.a.settings.JiraProject != "" {
		right += cDim.Render(" · ") + cPurple.Render(m.a.settings.JiraProject)
	}
	line := cDim.Render("bpr") + "  " + prLabel + " " + tkLabel + "   " + right
	return sep + "\n" + line
}

func (m model) prsView() string {
	if m.prsLoading {
		return cDim.Render("  loading pull requests…")
	}
	if len(m.prs) == 0 {
		return cYellow.Render("  No open pull requests.")
	}
	n := len(m.filteredPRs)
	if n == 0 {
		return cYellow.Render(fmt.Sprintf("  No PRs match \"%s\".", m.filter))
	}
	v := m.maxPRsVisible()
	end := min(m.prOffset+v, n)
	var b strings.Builder
	for i := m.prOffset; i < end; i++ {
		idx := m.filteredPRs[i]
		row := m.prs[idx]
		if i > m.prOffset {
			b.WriteString(cDim.Render("  " + strings.Repeat("─", max(m.width-4, 0))) + "\n")
		}
		num := fmt.Sprintf("%2d.", idx+1)
		title := row.pr.Title
		if i == m.prCursor {
			num = selRow.Render(num)
			title = selRow.Render(title)
		} else {
			num = cDim.Render(num)
		}
		ci := cDim.Render("…")
		if row.ciLoaded {
			ci = row.ci.short()
		}
		appr := cDim.Render(fmt.Sprintf("✓%d", row.pr.Approvals()))
		meta := cBranch.Render(row.pr.Source.Branch.Name) + cDim.Render(" · ") + cGrayB.Render(row.pr.Author.DisplayName)
		b.WriteString(fmt.Sprintf("%s %s  %-11s %s  %s\n     %s\n",
			num, cBlue.Render(fmt.Sprintf("#%-4d", row.pr.ID)), ci, appr, title, meta))
	}
	if n-end > 0 {
		b.WriteString(cDim.Render(fmt.Sprintf("  ↓ %d more", n-end)) + "\n")
	}
	return b.String()
}

func (m model) ticketsView() string {
	if !m.a.hasJira() {
		return cYellow.Render("  Jira not configured. Run `bpr auth` to add a Jira token.")
	}
	if m.issuesLoading {
		return cDim.Render("  loading issues…")
	}
	if len(m.issues) == 0 {
		jql := "resolution = unresolved"
		if m.a.settings.JiraProject != "" {
			jql = fmt.Sprintf("project = %q AND %s", m.a.settings.JiraProject, jql)
		}
		return cGreen.Render("  No open issues.") + "\n" + cDim.Render("  JQL: assignee = currentUser() AND "+jql)
	}
	n := len(m.filteredIssues)
	if n == 0 {
		return cYellow.Render(fmt.Sprintf("  No issues match \"%s\".", m.filter))
	}
	v := m.maxIssuesVisible()
	end := min(m.isOffset+v, n)
	var b strings.Builder
	for i := m.isOffset; i < end; i++ {
		idx := m.filteredIssues[i]
		is := m.issues[idx]
		if i > m.isOffset {
			b.WriteString(cDim.Render("  " + strings.Repeat("─", max(m.width-4, 0))) + "\n")
		}
		num := fmt.Sprintf("%2d.", idx+1)
		summary := is.Summary()
		if i == m.isCursor {
			num = selRow.Render(num)
			summary = selRow.Render(summary)
		} else {
			num = cDim.Render(num)
		}
		cat := is.Fields.Status.Category.Key
		statusColor := cDim
		switch cat {
		case "done", "completed":
			statusColor = cGreen
		case "indeterminate", "in-flight", "in_progress":
			statusColor = cYellow
		case "todo", "new":
			statusColor = cGrayB
		}
		b.WriteString(fmt.Sprintf("%s %s  %s  %s\n",
			num, cKey.Render(is.Key),
			statusColor.Render(trunc(is.Status(), 13)),
			summary))
	}
	if n-end > 0 {
		b.WriteString(cDim.Render(fmt.Sprintf("  ↓ %d more", n-end)) + "\n")
	}
	return b.String()
}

func (m model) detailView() string {
	var b strings.Builder
	div := cDim.Render(strings.Repeat("─", max(m.width-2, 0)))

	if m.tab == tabPRs {
		pr := m.curPR()
		if pr == nil {
			return ""
		}
		b.WriteString(div + "\n")
		b.WriteString(cBold.Render(cBlue.Render(fmt.Sprintf("  PR #%-4d", pr.pr.ID))) + cGrayB.Render("  by ") + cCyan.Render(pr.pr.Author.DisplayName) + "\n")
		b.WriteString(cBold.Render("  " + pr.pr.Title) + "\n")
		b.WriteString("  " + cBranch.Render(pr.pr.Source.Branch.Name) + cDim.Render(" → ") + cBranch.Render(pr.pr.Destination.Branch.Name) + "\n")
		if pr.ciLoaded {
			b.WriteString("  " + cDim.Render("ci: ") + pr.ci.short() + "\n")
		}
		b.WriteString(cBold.Render("\n  Reviewers") + "\n")
		hasRev := false
		for _, p := range pr.pr.Participants {
			if p.Role != "REVIEWER" && !p.Approved {
				continue
			}
			hasRev = true
			mark := "  ·"
			if p.Approved {
				mark = cGreen.Render("  ✓")
			} else if p.State == "changes_requested" {
				mark = cRed.Render("  ✗")
			}
			b.WriteString(fmt.Sprintf("  %s %s\n", mark, cBold.Render(p.User.DisplayName)))
		}
		if !hasRev {
			b.WriteString(cDim.Render("  none\n"))
		}
		if d := strings.TrimSpace(pr.pr.Description); d != "" {
			b.WriteString(cBold.Render("\n  Description") + "\n")
			b.WriteString(cDim.Render("  " + strings.ReplaceAll(trunc(d, 500), "\n", "\n  ")) + "\n")
		}
		b.WriteString(cBold.Render("\n  Comments") + "\n")
		b.WriteString(div + "\n")
		if m.loadingSub {
			b.WriteString(cDim.Render("  loading…\n"))
		} else if len(m.comments) == 0 {
			b.WriteString(cDim.Render("  none\n"))
		} else {
			for _, c := range m.comments {
				who := cCyan.Render(c.User.DisplayName)
				loc := ""
				if c.Inline != nil {
					loc = cDim.Render(" (" + c.Inline.Path + ")")
				}
				b.WriteString(fmt.Sprintf("  %s%s  %s\n", who, loc, cDim.Render(trunc(strings.TrimSpace(c.Content.Raw), 200))))
			}
		}
		return b.String()
	}

	is := m.curIssue()
	if is == nil {
		return ""
	}
	b.WriteString(div + "\n")
	color := issueStatusColor(is.Fields.Status.Category.Key)
	b.WriteString(cBold.Render(cKey.Render("  "+is.Key)) + "  " + is.Summary() + "\n")
	b.WriteString("  " + cDim.Render("status: ") + color(is.Status()) + cDim.Render("  type: ") + cGrayB.Render(is.Fields.IssueType.Name) + "\n")
	if d := is.DescriptionText(); d != "" {
		b.WriteString(cBold.Render("\n  Description") + "\n")
		b.WriteString(cDim.Render("  " + strings.ReplaceAll(trunc(d, 800), "\n", "\n  ")) + "\n")
	}
	return b.String()
}

func (m model) pickerView() string {
	var b strings.Builder
	b.WriteString(cBold.Render("Move to…") + "\n\n")
	if m.loadingSub {
		return b.String() + cDim.Render("  loading transitions…")
	}
	for i, ch := range m.choosing {
		cursor := "  "
		label := ch.label
		if i == m.chCursor {
			cursor = selRow.Render("▶ ")
			label = selRow.Render(label)
		}
		b.WriteString(cursor + label + "\n")
	}
	return b.String()
}

func (m model) footer() string {
	sep := cDim.Render(strings.Repeat("━", max(m.width, 1)))

	if m.errMsg != "" {
		return sep + "\n" + cRed.Render("✗ " + m.errMsg)
	}
	if m.input != nil {
		return sep + "\n" + cCyan.Render(m.input.prompt+": ") + m.input.value + cCyan.Render("▏")
	}
	var keys string
	if m.choosing != nil {
		keys = "↑↓ move · enter select · esc cancel"
	} else if m.detail {
		keys = "esc/←/⌫ back · o open · r refresh · q quit"
	} else if m.tab == tabPRs {
		keys = "↑↓ · 1-9 jump · / filter · enter detail · a approve · u unappr · m merge · d decline · c comment · e edit · ? help"
	} else {
		keys = "↑↓ · 1-9 jump · / filter · enter detail · t transition · c comment · b branch · o web · ? help"
	}
	line := cDim.Render(keys)
	if m.status != "" {
		line = cGreen.Render("✓ "+m.status) + "   " + line
	}
	return sep + "\n" + line
}

func trunc(s string, n int) string {
	s = strings.ReplaceAll(s, "\r", "")
	if len(s) <= n {
		return s
	}
	return s[:n] + "…"
}
