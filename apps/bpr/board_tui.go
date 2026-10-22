package main

import (
	"context"
	"errors"
	"fmt"
	"os"
	"sort"
	"strings"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/remcostoeten/bpr/internal/jira"
)

type boardAction int

const (
	actNone boardAction = iota
	actRefresh
	actNew
	actEpic
	actChild
	actMove
	actNest
	actEdit
	actStatus
	actAssign
	actDelete
)

type boardModel struct {
	cl        *jira.Client
	t         *boardTarget
	v         boardView
	rows      []boardRow
	shown     []int
	cursor    int
	offset    int
	people    []string
	person    int
	me        string
	filter    string
	filtering bool
	detail    bool
	width     int
	height    int
	status    string
	action    boardAction
	quit      bool
}

var (
	laneStyle = lipgloss.NewStyle().Foreground(lipgloss.Color("6"))
	selStyle  = lipgloss.NewStyle().Bold(true)
	chipStyle = lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("0")).Background(lipgloss.Color("39")).Padding(0, 1)
)

func newBoardModel(cl *jira.Client, t *boardTarget, v boardView, rows []boardRow, me, person, filter string) boardModel {
	m := boardModel{cl: cl, t: t, v: v, rows: rows, me: me, filter: filter, width: 100, height: 30}
	seen := map[string]bool{}
	var names []string
	for _, r := range rows {
		if n := r.issue.AssigneeName(); n != "" && !seen[n] {
			seen[n] = true
			names = append(names, n)
		}
	}
	sort.Strings(names)
	m.people = append([]string{"", "me", "none"}, names...)
	for i, p := range m.people {
		if strings.EqualFold(p, person) {
			m.person = i
		}
	}
	if m.person == 0 && person != "" {
		m.people = append(m.people, person)
		m.person = len(m.people) - 1
	}
	m.refilter()
	return m
}

func (m *boardModel) assignee() string { return m.people[m.person] }

func (m *boardModel) refilter() {
	m.shown = m.shown[:0]
	q := strings.ToLower(m.filter)
	for i, r := range m.rows {
		if !matchAssignee(r.issue, m.assignee(), m.me) {
			continue
		}
		hay := strings.ToLower(r.issue.Key + " " + r.issue.Summary() + " " + r.issue.AssigneeName() + " " + r.lane)
		if q != "" && !strings.Contains(hay, q) {
			continue
		}
		m.shown = append(m.shown, i)
	}
	m.cursor = clamp(m.cursor, 0, max(len(m.shown)-1, 0))
	m.scroll()
}

func (m *boardModel) current() *jira.Issue {
	if m.cursor < 0 || m.cursor >= len(m.shown) {
		return nil
	}
	return &m.rows[m.shown[m.cursor]].issue
}

func (m *boardModel) selectKey(key string) {
	for i, idx := range m.shown {
		if m.rows[idx].issue.Key == key {
			m.cursor = i
			m.scroll()
			return
		}
	}
}

func (m boardModel) listHeight() int {
	h := m.height - 6
	if m.detail {
		h -= 14
	}
	return max(h, 3)
}

func (m *boardModel) scroll() {
	h := m.listHeight()
	if m.cursor < m.offset {
		m.offset = m.cursor
	}
	if m.cursor >= m.offset+h {
		m.offset = m.cursor - h + 1
	}
	m.offset = clamp(m.offset, 0, max(len(m.shown)-h, 0))
}

func (m boardModel) Init() tea.Cmd { return nil }

func (m boardModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width, m.height = msg.Width, msg.Height
		m.scroll()
		return m, nil
	case tea.KeyMsg:
		if m.filtering {
			switch msg.Type {
			case tea.KeyEsc:
				m.filtering, m.filter = false, ""
			case tea.KeyEnter:
				m.filtering = false
			case tea.KeyBackspace:
				if r := []rune(m.filter); len(r) > 0 {
					m.filter = string(r[:len(r)-1])
				}
			case tea.KeyRunes, tea.KeySpace:
				m.filter += string(msg.Runes)
			}
			m.refilter()
			return m, nil
		}
		m.status = ""
		done := func(a boardAction) (tea.Model, tea.Cmd) {
			if a != actRefresh && a != actNew && a != actEpic && m.current() == nil {
				m.status = "no ticket selected"
				return m, nil
			}
			m.action = a
			return m, tea.Quit
		}
		switch msg.String() {
		case "q", "ctrl+c":
			m.quit = true
			return m, tea.Quit
		case "esc":
			if m.filter != "" {
				m.filter = ""
				m.refilter()
			} else if m.detail {
				m.detail = false
			}
		case "up", "k":
			m.cursor = max(m.cursor-1, 0)
		case "down", "j":
			m.cursor = min(m.cursor+1, max(len(m.shown)-1, 0))
		case "pgup", "ctrl+u":
			m.cursor = max(m.cursor-m.listHeight()/2, 0)
		case "pgdown", "ctrl+d":
			m.cursor = min(m.cursor+m.listHeight()/2, max(len(m.shown)-1, 0))
		case "g", "home":
			m.cursor = 0
		case "G", "end":
			m.cursor = max(len(m.shown)-1, 0)
		case "enter", " ":
			m.detail = !m.detail
		case "/":
			m.filtering = true
		case "a":
			m.person = (m.person + 1) % len(m.people)
			m.refilter()
		case "A":
			m.person = (m.person - 1 + len(m.people)) % len(m.people)
			m.refilter()
		case "tab":
			if m.v == viewBoard {
				m.v = viewBacklog
			} else {
				m.v = viewBoard
			}
			return done(actRefresh)
		case "r":
			return done(actRefresh)
		case "o":
			if is := m.current(); is != nil {
				openURL(m.cl.BrowseURL(is.Key))
				m.status = "opened " + is.Key
			}
		case "n":
			return done(actNew)
		case "E":
			return done(actEpic)
		case "c":
			return done(actChild)
		case "m":
			return done(actMove)
		case "p":
			return done(actNest)
		case "e":
			return done(actEdit)
		case "s":
			return done(actStatus)
		case "i":
			return done(actAssign)
		case "d", "x":
			return done(actDelete)
		}
		m.scroll()
	}
	return m, nil
}

func devMarks(d jira.DevInfo) string {
	mark := func(on bool, s string) string {
		if on {
			return cGreen.Render(s)
		}
		return cDim.Render(strings.Repeat("·", len(s)))
	}
	return mark(d.HasPR(), "PR") + " " + mark(d.Merged(), "M") + " " + mark(d.HasDeployment(), "D")
}

func (m boardModel) View() string {
	if m.quit || m.action != actNone {
		return ""
	}
	var b strings.Builder
	tabs := ""
	for _, v := range []boardView{viewBoard, viewBacklog} {
		if v == m.v {
			tabs += chipStyle.Render(v.String()) + " "
		} else {
			tabs += cDim.Render(" "+v.String()+" ") + " "
		}
	}
	who := "everyone"
	if a := m.assignee(); a != "" {
		who = a
	}
	b.WriteString(cBold.Render(" "+m.t.name) + "  " + tabs + cDim.Render("assignee: ") + cCyan.Render(who))
	b.WriteString(cDim.Render(fmt.Sprintf("  %d/%d", len(m.shown), len(m.rows))) + "\n")
	if m.filtering || m.filter != "" {
		b.WriteString(cCyan.Render(" filter: ") + m.filter)
		if m.filtering {
			b.WriteString(cCyan.Render("▏"))
		}
	}
	b.WriteString("\n")

	laneW, nameW := 0, 0
	for _, i := range m.shown {
		laneW = max(laneW, lipgloss.Width(m.rows[i].lane))
		nameW = max(nameW, lipgloss.Width(assigneeLabel(m.rows[i].issue)))
	}
	laneW, nameW = min(laneW, 18), min(nameW, 20)
	sumW := max(m.width-laneW-nameW-30, 20)

	h := m.listHeight()
	end := min(m.offset+h, len(m.shown))
	if len(m.shown) == 0 {
		b.WriteString(cDim.Render("  no tickets match") + "\n")
	}
	for vi := m.offset; vi < end; vi++ {
		r := m.rows[m.shown[vi]]
		is := r.issue
		mark := "  "
		if is.IsEpic() {
			mark = cPurple.Render("◆ ")
		} else if is.ParentKey() != "" {
			mark = cDim.Render("↳ ")
		}
		summary := mark + fit(is.Summary(), sumW-2)
		line := fmt.Sprintf(" %s  %s  %s  %s  %s",
			laneStyle.Render(padRight(fit(r.lane, laneW), laneW)),
			cBlue.Render(padRight(is.Key, 8)),
			padRight(summary, sumW),
			cGrayB.Render(padRight(fit(assigneeLabel(is), nameW), nameW)),
			devMarks(is.Dev()))
		if vi == m.cursor {
			line = selStyle.Render("▸" + line[1:])
		}
		b.WriteString(line + "\n")
	}
	for i := end - m.offset; i < h; i++ {
		b.WriteString("\n")
	}

	if m.detail {
		b.WriteString(m.detailView())
	}
	if m.status != "" {
		b.WriteString(cYellow.Render(" "+m.status) + "\n")
	} else {
		b.WriteString("\n")
	}
	b.WriteString(cDim.Render(" ↑↓ move · enter details · tab board/backlog · a assignee · / filter · o open · r reload") + "\n")
	b.WriteString(cDim.Render(" n new · E epic · c child/subtask · m move board⇄backlog · p nest under · e edit · s status · i assign · d delete · q quit"))
	return b.String()
}

func (m boardModel) detailView() string {
	is := m.current()
	if is == nil {
		return strings.Repeat("\n", 14)
	}
	var lines []string
	sep := cDim.Render(strings.Repeat("─", max(m.width-2, 10)))
	lines = append(lines, sep)
	lines = append(lines, " "+cBold.Render(cBlue.Render(is.Key)+"  "+is.Summary()))
	meta := fmt.Sprintf(" %s · %s · %s", is.Fields.IssueType.Name, is.Status(), assigneeLabel(*is))
	if p := is.ParentKey(); p != "" {
		meta += " · in " + p + " " + is.ParentSummary()
	}
	if n := len(is.Fields.Subtasks); n > 0 {
		meta += fmt.Sprintf(" · %d subtasks", n)
	}
	lines = append(lines, cGrayB.Render(meta))
	lines = append(lines, " "+devLine(is.Dev()))
	desc := is.DescriptionText()
	if desc == "" {
		desc = "(no description)"
	}
	for _, l := range strings.Split(desc, "\n") {
		if len(lines) >= 13 {
			lines = append(lines, cDim.Render(" …"))
			break
		}
		lines = append(lines, cDim.Render(" "+fit(l, max(m.width-3, 10))))
	}
	for len(lines) < 14 {
		lines = append(lines, "")
	}
	return strings.Join(lines[:14], "\n") + "\n"
}

func fit(s string, w int) string {
	if lipgloss.Width(s) <= w {
		return s
	}
	r := []rune(s)
	for len(r) > 0 && lipgloss.Width(string(r))+1 > w {
		r = r[:len(r)-1]
	}
	return string(r) + "…"
}

func padRight(s string, w int) string {
	if d := w - lipgloss.Width(s); d > 0 {
		return s + strings.Repeat(" ", d)
	}
	return s
}

func runBoardTUI(ctx context.Context, a *app, t *boardTarget, v boardView, person string) error {
	cl := a.jira
	me, err := cl.MyAccountID(ctx)
	if err != nil {
		return err
	}
	filter, key, status := "", "", ""
	detail := false
	for {
		fmt.Fprintln(os.Stderr, cDim.Render("  loading "+t.name+" "+v.String()+" ..."))
		rows, err := loadRows(ctx, cl, t, v)
		if err != nil {
			return err
		}
		m := newBoardModel(cl, t, v, rows, me, person, filter)
		m.detail, m.status = detail, status
		m.selectKey(key)
		out, err := tea.NewProgram(m, tea.WithAltScreen()).Run()
		if err != nil {
			return err
		}
		fm := out.(boardModel)
		if fm.quit {
			return nil
		}
		v, person, filter, detail = fm.v, fm.assignee(), fm.filter, fm.detail
		cur := fm.current()
		key = ""
		if cur != nil {
			key = cur.Key
		}
		status = ""
		err = runBoardAction(ctx, a, t, fm.v, fm.action, cur)
		switch {
		case errors.Is(err, errCancelled):
			status = "cancelled"
		case err != nil:
			fmt.Fprintln(os.Stderr, cRed.Render("error: "+err.Error()))
			pause()
		case fm.action != actRefresh:
			status = "done"
		}
	}
}

func runBoardAction(ctx context.Context, a *app, t *boardTarget, v boardView, act boardAction, is *jira.Issue) error {
	cl := a.jira
	switch act {
	case actRefresh:
		return nil
	case actNew:
		_, err := createOnBoard(ctx, cl, t, kindTicket, boardOpts{}, v == viewBoard)
		return err
	case actEpic:
		_, err := createOnBoard(ctx, cl, t, kindEpic, boardOpts{}, true)
		return err
	case actChild:
		if is.IsEpic() {
			_, err := createOnBoard(ctx, cl, t, kindChild, boardOpts{epic: is.Key}, true)
			return err
		}
		if is.Fields.IssueType.Subtask {
			return fmt.Errorf("%s is a subtask and cannot have children", is.Key)
		}
		fmt.Println()
		fmt.Println(cBold.Render("New subtask under "+is.Key+"  ") + cDim.Render(is.Summary()))
		summary := prompt("Summary: ")
		if summary == "" {
			return errCancelled
		}
		sub, err := cl.CreateSubtask(ctx, is.Key, summary, promptDescription())
		if err != nil {
			return err
		}
		okLine("created subtask " + sub)
		return nil
	case actMove:
		return moveIssues(ctx, cl, t, []string{is.Key}, v == viewBoard)
	case actNest:
		fmt.Println()
		fmt.Println(cBold.Render("Nest "+is.Key+"  ") + cDim.Render(is.Summary()))
		parent, err := pickParent(ctx, cl, t, is)
		if err != nil {
			return err
		}
		return nestIssue(ctx, cl, is.Key, parent, false)
	case actEdit:
		return editInteractive(ctx, cl, is.Key)
	case actStatus:
		return pickTransition(ctx, cl, is.Key)
	case actAssign:
		id, name, err := pickUser(ctx, cl, t.project, "Assign "+is.Key)
		if err != nil {
			return err
		}
		if err := cl.Update(ctx, is.Key, jira.IssueUpdate{AssigneeID: &id}); err != nil {
			return err
		}
		okLine(is.Key + " → " + name)
		return nil
	case actDelete:
		return deleteIssues(ctx, cl, []string{is.Key}, false)
	}
	return nil
}

func pickParent(ctx context.Context, cl *jira.Client, t *boardTarget, is *jira.Issue) (string, error) {
	loading("candidates")
	jql := fmt.Sprintf("project = %q AND issuetype not in subTaskIssueTypes() AND statusCategory != Done AND key != %q AND (issuetype = Epic OR sprint in openSprints()) ORDER BY issuetype ASC, updated DESC", t.project, is.Key)
	cands, err := cl.Search(ctx, jql, 200)
	if err != nil {
		return "", err
	}
	items := []pickItem{{label: "Type a key…", hint: "any ticket or epic"}}
	if is.ParentKey() != "" && !is.Fields.IssueType.Subtask {
		items = append(items, pickItem{label: "No parent", hint: "detach from " + is.ParentKey()})
	}
	fixed := len(items)
	for _, c := range cands {
		hint := c.Key
		if c.IsEpic() {
			hint += " · epic, becomes a child"
		} else {
			hint += " · becomes a subtask"
		}
		items = append(items, pickItem{label: c.Summary(), hint: hint})
	}
	i, err := pickOne("Put "+is.Key+" under", items, 0)
	if err != nil {
		return "", err
	}
	switch {
	case i == 0:
		k := strings.ToUpper(prompt("Parent key: "))
		if k == "" {
			return "", errCancelled
		}
		return k, nil
	case i < fixed:
		return "none", nil
	}
	return cands[i-fixed].Key, nil
}
