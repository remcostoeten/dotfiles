package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"sort"
	"strings"

	"github.com/remcostoeten/bpr/internal/jira"
)

type boardView int

const (
	viewBoard boardView = iota
	viewBacklog
)

func (v boardView) String() string {
	if v == viewBacklog {
		return "backlog"
	}
	return "board"
}

type boardTarget struct {
	project string
	board   int
	name    string
	columns []jira.Column
}

type boardRow struct {
	issue jira.Issue
	lane  string
	order int
}

type boardOpts struct {
	project  string
	assignee string
	long     bool
	print    bool
	asJSON   bool
	backlog  bool
	sprint   bool
	epic     string
	yes      bool
	title    string
	body     string
}

func parseBoardOpts(args []string) (boardOpts, []string, error) {
	var o boardOpts
	var rest []string
	for i := 0; i < len(args); i++ {
		next := func() string {
			i++
			if i < len(args) {
				return args[i]
			}
			return ""
		}
		switch args[i] {
		case "-p", "--project":
			o.project = strings.ToUpper(next())
		case "-a", "--assignee":
			o.assignee = next()
		case "-l", "--long":
			o.long = true
		case "--json":
			o.asJSON = true
		case "--print", "--plain":
			o.print = true
		case "-b", "--backlog":
			o.backlog = true
		case "-s", "--sprint":
			o.sprint = true
		case "-e", "--epic":
			o.epic = strings.ToUpper(next())
		case "-f", "--force", "--yes":
			o.yes = true
		case "-t", "--title":
			o.title = next()
		case "-m", "--message", "--body", "-d", "--description":
			o.body = next()
		default:
			if strings.HasPrefix(args[i], "-") {
				return o, nil, fmt.Errorf("unknown flag: %s", args[i])
			}
			rest = append(rest, args[i])
		}
	}
	return o, rest, nil
}

func resolveTarget(ctx context.Context, cl *jira.Client, project string) (*boardTarget, error) {
	t := &boardTarget{project: marProject, board: marBoard, name: "MAR board"}
	if project != "" && project != marProject {
		boards, err := cl.Boards(ctx, project)
		if err != nil {
			return nil, fmt.Errorf("loading boards of %s: %w", project, err)
		}
		if len(boards) == 0 {
			return nil, fmt.Errorf("project %s has no agile board", project)
		}
		t = &boardTarget{project: project, board: boards[0].ID, name: boards[0].Name}
	}
	cols, err := cl.Columns(ctx, t.board)
	if err != nil {
		return nil, fmt.Errorf("loading columns of %s: %w", t.name, err)
	}
	t.columns = cols
	return t, nil
}

func (t *boardTarget) jql(v boardView) string {
	base := fmt.Sprintf("project = %q AND issuetype not in subTaskIssueTypes()", t.project)
	if v == viewBacklog {
		return base + " AND issuetype != Epic AND (sprint is EMPTY OR sprint in futureSprints()) AND statusCategory != Done ORDER BY Rank ASC"
	}
	return base + " AND sprint in openSprints() ORDER BY Rank ASC"
}

func (t *boardTarget) lane(is jira.Issue) (string, int) {
	for i, c := range t.columns {
		for _, id := range c.StatusIDs {
			if id == is.Fields.Status.ID {
				return c.Name, i
			}
		}
	}
	return is.Status(), len(t.columns)
}

func (t *boardTarget) activeSprint(ctx context.Context, cl *jira.Client) (*jira.Sprint, error) {
	sprints, err := cl.Sprints(ctx, t.board)
	if err != nil {
		return nil, err
	}
	if s := activeSprint(sprints); s != nil {
		return s, nil
	}
	return nil, fmt.Errorf("%s has no active sprint", t.name)
}

func loadRows(ctx context.Context, cl *jira.Client, t *boardTarget, v boardView) ([]boardRow, error) {
	issues, err := cl.Search(ctx, t.jql(v), 300)
	if err != nil {
		return nil, err
	}
	rows := make([]boardRow, len(issues))
	for i, is := range issues {
		lane, order := t.lane(is)
		rows[i] = boardRow{issue: is, lane: lane, order: order}
	}
	if v == viewBoard {
		sort.SliceStable(rows, func(i, j int) bool { return rows[i].order < rows[j].order })
	}
	return rows, nil
}

func matchAssignee(is jira.Issue, filter, me string) bool {
	switch strings.ToLower(filter) {
	case "":
		return true
	case "me":
		return is.Fields.Assignee != nil && is.Fields.Assignee.AccountID == me
	case "none", "unassigned", "-":
		return is.Fields.Assignee == nil
	}
	return strings.Contains(strings.ToLower(is.AssigneeName()), strings.ToLower(filter))
}

func filterRows(rows []boardRow, assignee, me string) []boardRow {
	if assignee == "" {
		return rows
	}
	var out []boardRow
	for _, r := range rows {
		if matchAssignee(r.issue, assignee, me) {
			out = append(out, r)
		}
	}
	return out
}

func yesNo(b bool) string {
	if b {
		return cGreen.Render("yes")
	}
	return cDim.Render("no")
}

func devLine(d jira.DevInfo) string {
	deploy := yesNo(d.HasDeployment())
	if d.Environment != "" {
		deploy += cDim.Render(" (" + d.Environment + ")")
	}
	return fmt.Sprintf("PR %s · merged %s · deployed %s", yesNo(d.HasPR()), yesNo(d.Merged()), deploy)
}

func assigneeLabel(is jira.Issue) string {
	if n := is.AssigneeName(); n != "" {
		return n
	}
	return "unassigned"
}

type rowJSON struct {
	Key         string `json:"key"`
	Summary     string `json:"summary"`
	Type        string `json:"type"`
	Assignee    string `json:"assignee"`
	Lane        string `json:"lane"`
	Status      string `json:"status"`
	Parent      string `json:"parent,omitempty"`
	Description string `json:"description"`
	HasPR       bool   `json:"hasPR"`
	Merged      bool   `json:"merged"`
	Deployed    bool   `json:"deployed"`
	URL         string `json:"url"`
}

func printRows(cl *jira.Client, t *boardTarget, v boardView, rows []boardRow, o boardOpts) error {
	if o.asJSON {
		out := make([]rowJSON, len(rows))
		for i, r := range rows {
			is, d := r.issue, r.issue.Dev()
			out[i] = rowJSON{
				Key: is.Key, Summary: is.Summary(), Type: is.Fields.IssueType.Name,
				Assignee: is.AssigneeName(), Lane: r.lane, Status: is.Status(),
				Parent: is.ParentKey(), Description: is.DescriptionText(),
				HasPR: d.HasPR(), Merged: d.Merged(), Deployed: d.HasDeployment(),
				URL: cl.BrowseURL(is.Key),
			}
		}
		enc := json.NewEncoder(os.Stdout)
		enc.SetIndent("", "  ")
		return enc.Encode(out)
	}

	head := fmt.Sprintf("%s · %s", t.name, v)
	if o.assignee != "" {
		head += " · assignee " + o.assignee
	}
	fmt.Printf("\n%s  %s\n", cBold.Render(head), cDim.Render(fmt.Sprintf("%d tickets", len(rows))))
	if len(rows) == 0 {
		fmt.Println(cDim.Render("  nothing here"))
		return nil
	}
	lane := "\x00"
	for _, r := range rows {
		is := r.issue
		if v == viewBoard && r.lane != lane {
			lane = r.lane
			fmt.Printf("\n%s\n", cCyan.Render("▍"+lane))
		}
		kind := ""
		if is.IsEpic() {
			kind = cPurple.Render(" [epic]")
		}
		fmt.Printf("  %s  %s%s\n", cBlue.Render(fmt.Sprintf("%-8s", is.Key)), is.Summary(), kind)
		meta := []string{assigneeLabel(is)}
		if v == viewBacklog {
			meta = append(meta, is.Status())
		}
		if p := is.ParentKey(); p != "" {
			meta = append(meta, "in "+p)
		}
		if n := len(is.Fields.Subtasks); n > 0 {
			meta = append(meta, fmt.Sprintf("%d subtasks", n))
		}
		fmt.Printf("            %s  %s\n", cGrayB.Render(strings.Join(meta, " · ")), devLine(is.Dev()))
		desc := is.DescriptionText()
		if desc == "" {
			continue
		}
		if o.long {
			for _, l := range strings.Split(desc, "\n") {
				fmt.Println(cDim.Render("            │ " + l))
			}
		} else {
			fmt.Println(cDim.Render("            " + fit(strings.SplitN(desc, "\n", 2)[0], 90)))
		}
	}
	fmt.Println()
	return nil
}

func cmdBoardView(v boardView) func(context.Context, *app, []string) error {
	return func(ctx context.Context, a *app, args []string) error {
		if err := ensureJira(ctx, a); err != nil {
			return err
		}
		o, _, err := parseBoardOpts(args)
		if err != nil {
			return err
		}
		t, err := resolveTarget(ctx, a.jira, o.project)
		if err != nil {
			return err
		}
		if !o.asJSON && !o.print && !o.long && isTerminal() {
			return runBoardTUI(ctx, a, t, v, o.assignee)
		}
		rows, err := loadRows(ctx, a.jira, t, v)
		if err != nil {
			return err
		}
		me := ""
		if strings.EqualFold(o.assignee, "me") {
			if me, err = a.jira.MyAccountID(ctx); err != nil {
				return err
			}
		}
		return printRows(a.jira, t, v, filterRows(rows, o.assignee, me), o)
	}
}

func isTerminal() bool {
	fi, err := os.Stdout.Stat()
	return err == nil && fi.Mode()&os.ModeCharDevice != 0
}
