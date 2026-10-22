package main

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"unicode"

	"github.com/remcostoeten/bpr/internal/jira"
)

const (
	marProject    = "MAR"
	marBoard      = 217
	marType       = "Taak"
	marLabel      = "marketing"
	marStartState = "In Progress"
)

var (
	branchTypePrefix = regexp.MustCompile(`^[^/]+/`)
	branchTicketKey  = regexp.MustCompile(`(?i)^[a-z][a-z0-9]+-\d+[-_ ]*`)
	wordSeparators   = regexp.MustCompile(`[-_./\s]+`)
)

// titleFromBranch turns "fix/header-alignment-error" into "Header alignment error".
func titleFromBranch(branch string) string {
	s := branchTypePrefix.ReplaceAllString(strings.TrimSpace(branch), "")
	s = branchTicketKey.ReplaceAllString(s, "")
	s = strings.TrimSpace(wordSeparators.ReplaceAllString(s, " "))
	if s == "" {
		return ""
	}
	r := []rune(s)
	r[0] = unicode.ToUpper(r[0])
	return string(r)
}

func cmdMarketing(ctx context.Context, a *app, args []string) error {
	if err := ensureJira(ctx, a); err != nil {
		return err
	}
	f, rest, err := parseTicketFlags(args)
	if err != nil {
		return err
	}
	err = marketingTicket(ctx, a, f, strings.Join(rest, " "))
	if errors.Is(err, errCancelled) {
		fmt.Println(cDim.Render("  cancelled — nothing created"))
		return nil
	}
	return err
}

func marketingTicket(ctx context.Context, a *app, f ticketFlags, branch string) error {
	cl := a.jira
	fmt.Println()
	fmt.Println(cBold.Render("New MAR ticket"))

	if branch == "" {
		if f.yes {
			branch = currentBranch(a.dir)
		} else {
			picked, err := pickBranch(a.dir)
			if err != nil {
				return err
			}
			branch = picked
		}
	}

	title := f.title
	if title == "" {
		title = titleFromBranch(branch)
	}
	if !f.yes {
		if t := prompt(fmt.Sprintf("Title [%s]: ", title)); t != "" {
			title = t
		}
		if f.body == "" {
			f.body = prompt("Description (optional): ")
		}
	}
	if title == "" {
		return fmt.Errorf("a title is required")
	}

	status := marStartState
	labels := []string{marLabel}
	var epic *jira.Issue
	if !f.yes {
		var err error
		if epic, err = pickEpic(ctx, cl); err != nil {
			return err
		}
		if status, err = pickStatus(ctx, cl); err != nil {
			return err
		}
		if labels, err = pickMarketingLabels(ctx, cl); err != nil {
			return err
		}
	}

	summary := title
	parent := ""
	if epic != nil {
		summary = strings.TrimSpace(strings.SplitN(epic.Summary(), "|", 2)[0]) + " | " + title
		parent = epic.Key
	}

	if !f.yes {
		fmt.Println()
		fmt.Println(cBold.Render("Review"))
		row := func(k, v string) { fmt.Printf("  %s %s\n", cDim.Render(fmt.Sprintf("%-9s", k)), v) }
		row("branch", branch)
		row("title", summary)
		if f.body != "" {
			row("desc", strings.SplitN(f.body, "\n", 2)[0])
		}
		if epic != nil {
			row("epic", epic.Key+"  "+epic.Summary())
		}
		row("status", status)
		row("labels", strings.Join(labels, ", "))
		row("assignee", "me")
		row("board", "MAR board · active sprint")
		if ans := strings.ToLower(prompt("\nCreate it? [Y/n] ")); ans == "n" || ans == "no" {
			return errCancelled
		}
	}

	typeID, err := issueTypeID(ctx, cl, marProject, marType)
	if err != nil {
		return err
	}
	me, err := cl.MyAccountID(ctx)
	if err != nil {
		return err
	}
	key, err := cl.Create(ctx, jira.NewIssue{
		Project:     marProject,
		Summary:     summary,
		Description: f.body,
		TypeID:      typeID,
		Parent:      parent,
		Labels:      labels,
		AssigneeID:  me,
	})
	if err != nil {
		return err
	}
	fmt.Printf("%s  %s  %s\n", cGreen.Render("✓ Created"), cBlue.Render(key), summary)

	if sprints, err := cl.Sprints(ctx, marBoard); err != nil {
		fmt.Println(cYellow.Render("  ! could not load sprints: " + err.Error()))
	} else if s := activeSprint(sprints); s == nil {
		fmt.Println(cYellow.Render("  ! no active sprint on the MAR board — left in backlog"))
	} else if err := cl.MoveToSprint(ctx, s.ID, key); err != nil {
		fmt.Println(cYellow.Render("  ! could not add to " + s.Name + ": " + err.Error()))
	} else {
		fmt.Println(cGreen.Render("  ✓ on the board") + cDim.Render("  "+s.Name))
	}

	if !strings.EqualFold(status, "To Do") {
		if err := cl.TransitionTo(ctx, key, status); err != nil {
			fmt.Println(cYellow.Render("  ! " + err.Error()))
		} else {
			fmt.Println(cGreen.Render("  ✓ " + status))
		}
	}
	fmt.Println(cDim.Render("  " + cl.BrowseURL(key)))

	if localBranchExists(a.dir, branch) {
		linkBranchTicket(a.dir, branch, key)
	}
	if !f.yes && isGitRepo(a.dir) {
		offerTicketBranch(ctx, a, branch, key, title)
	}
	return nil
}

func pickBranch(dir string) (string, error) {
	current := currentBranch(dir)
	var names []string
	seen := map[string]bool{}
	add := func(n string) {
		if n != "" && !seen[n] {
			seen[n] = true
			names = append(names, n)
		}
	}
	add(current)
	if out, err := git(dir, "branch", "--sort=-committerdate", "--format=%(refname:short)"); err == nil {
		for _, l := range strings.Split(out, "\n") {
			add(strings.TrimSpace(l))
		}
	}
	for _, n := range remoteBranches(dir) {
		add(n)
	}
	if len(names) == 0 {
		t := prompt("Branch name (e.g. fix/header-alignment): ")
		if t == "" {
			return "", errCancelled
		}
		return t, nil
	}
	items := make([]pickItem, len(names))
	for i, n := range names {
		hint := titleFromBranch(n)
		if n == current {
			hint = "current · " + hint
		}
		items[i] = pickItem{label: n, hint: hint}
	}
	i, err := pickOne("Branch", items, 0)
	if err != nil {
		return "", err
	}
	fmt.Println(cGreen.Render("  ✓ branch ") + names[i])
	return names[i], nil
}

func pickStatus(ctx context.Context, cl *jira.Client) (string, error) {
	statuses, err := cl.Statuses(ctx, marProject, marType)
	if err != nil || len(statuses) == 0 {
		return marStartState, nil
	}
	items := make([]pickItem, len(statuses))
	initial := 0
	for i, s := range statuses {
		items[i] = pickItem{label: s}
		if strings.EqualFold(s, marStartState) {
			initial = i
		}
	}
	i, err := pickOne("Status", items, initial)
	if err != nil {
		return "", err
	}
	fmt.Println(cGreen.Render("  ✓ status ") + statuses[i])
	return statuses[i], nil
}

func pickMarketingLabels(ctx context.Context, cl *jira.Client) ([]string, error) {
	all, err := cl.Labels(ctx)
	if err != nil {
		fmt.Println(cYellow.Render("  ! could not load labels: " + err.Error()))
	}
	items := make([]pickItem, 0, len(all)+1)
	pre := -1
	for i, l := range all {
		items = append(items, pickItem{label: l})
		if l == marLabel {
			pre = i
		}
	}
	if pre < 0 {
		pre = len(items)
		all = append(all, marLabel)
		items = append(items, pickItem{label: marLabel})
	}
	r, err := runPicker("Labels", items, true, true, pre, pre)
	if err != nil {
		return nil, err
	}
	if r.cancelled {
		return nil, errCancelled
	}
	var labels []string
	for _, i := range r.indices {
		labels = append(labels, all[i])
	}
	labels = append(labels, r.custom...)
	fmt.Println(cGreen.Render("  ✓ labels ") + strings.Join(labels, ", "))
	return labels, nil
}

func pickEpic(ctx context.Context, cl *jira.Client) (*jira.Issue, error) {
	epics, err := cl.Search(ctx, fmt.Sprintf("project = %s AND issuetype = Epic AND statusCategory != Done ORDER BY created ASC", marProject), 50)
	if err != nil {
		return nil, fmt.Errorf("loading epics: %w", err)
	}
	items := []pickItem{{label: "None", hint: "no epic, no prefix"}}
	initial := 0
	for i, e := range epics {
		items = append(items, pickItem{label: e.Summary(), hint: e.Key})
		if e.Summary() == "RJL" {
			initial = i + 1
		}
	}
	i, err := pickOne("Epic", items, initial)
	if err != nil || i == 0 {
		return nil, err
	}
	fmt.Println(cGreen.Render("  ✓ epic ") + epics[i-1].Summary())
	return &epics[i-1], nil
}

func issueTypeID(ctx context.Context, cl *jira.Client, project, name string) (string, error) {
	types, err := cl.IssueTypes(ctx, project)
	if err != nil {
		return "", err
	}
	for _, t := range types {
		if strings.EqualFold(t.Name, name) {
			return t.ID, nil
		}
	}
	return "", fmt.Errorf("project %s has no issue type %q", project, name)
}

func activeSprint(sprints []jira.Sprint) *jira.Sprint {
	for i := range sprints {
		if sprints[i].State == "active" {
			return &sprints[i]
		}
	}
	return nil
}
