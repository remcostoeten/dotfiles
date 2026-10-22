package main

import (
	"context"
	"errors"
	"fmt"
	"os"
	"strings"

	"github.com/remcostoeten/bpr/internal/jira"
)

// ticketFlags are the shared -t/-m/-y flags of the ticket commands. Any leading
// bare words are joined into the title, so `bpr ticket new fix the header`
// works without quoting.
type ticketFlags struct {
	title string
	body  string
	kind  string
	yes   bool
}

func parseTicketFlags(args []string) (ticketFlags, []string, error) {
	var f ticketFlags
	var rest []string
	for i := 0; i < len(args); i++ {
		switch args[i] {
		case "-t", "--title":
			i++
			if i < len(args) {
				f.title = args[i]
			}
		case "-m", "--message", "--body", "-d", "--description":
			i++
			if i < len(args) {
				f.body = args[i]
			}
		case "-y", "--type":
			i++
			if i < len(args) {
				f.kind = args[i]
			}
		case "-f", "--force", "--yes":
			f.yes = true
		default:
			if strings.HasPrefix(args[i], "-") {
				return f, nil, fmt.Errorf("unknown flag: %s", args[i])
			}
			rest = append(rest, args[i])
		}
	}
	return f, rest, nil
}

// resolveKey returns the first bare argument, falling back to the ticket key in
// the current branch name.
func resolveKey(a *app, rest []string) (string, error) {
	if len(rest) > 0 {
		return strings.ToUpper(rest[0]), nil
	}
	if key := branchTicket(currentBranch(a.dir)); key != "" {
		return key, nil
	}
	return "", fmt.Errorf("no issue key given and none found in the branch name")
}

var errCancelled = errors.New("cancelled")

func cmdTicketNew(ctx context.Context, a *app, args []string) error {
	if err := ensureJira(ctx, a); err != nil {
		return err
	}
	f, rest, err := parseTicketFlags(args)
	if err != nil {
		return err
	}
	if f.title == "" {
		f.title = strings.Join(rest, " ")
	}
	if f.title == "" {
		err := interactiveTicket(ctx, a, f)
		if errors.Is(err, errCancelled) {
			fmt.Println(cDim.Render("  cancelled — nothing created"))
			return nil
		}
		return err
	}

	project := a.settings.JiraProject
	if project == "" {
		project = strings.ToUpper(prompt("Project key: "))
	}
	key, err := a.jira.Create(ctx, jira.NewIssue{
		Project:     project,
		Summary:     f.title,
		Description: f.body,
		TypeName:    f.kind,
	})
	if err != nil {
		return err
	}
	fmt.Printf("%s  %s  %s\n", cGreen.Render("✓ Created"), cBlue.Render(key), cDim.Render(a.jira.BrowseURL(key)))
	return nil
}

func loading(what string) {
	fmt.Println(cDim.Render("  loading " + what + " ..."))
}

func interactiveTicket(ctx context.Context, a *app, f ticketFlags) error {
	cl := a.jira
	fmt.Println()
	fmt.Println(cBold.Render("New Jira ticket"))

	loading("projects")
	projects, err := cl.Projects(ctx)
	if err != nil {
		return fmt.Errorf("loading projects: %w", err)
	}
	if len(projects) == 0 {
		return fmt.Errorf("no Jira projects visible to this account")
	}
	var projectItems []pickItem
	current := 0
	for i, p := range projects {
		projectItems = append(projectItems, pickItem{label: p.Key, hint: p.Name})
		if strings.EqualFold(p.Key, a.settings.JiraProject) {
			current = i
		}
	}
	pi, err := pickOne("Project", projectItems, current)
	if err != nil {
		return err
	}
	project := projects[pi]
	fmt.Println(cGreen.Render("  ✓ project ") + project.Key + cDim.Render("  "+project.Name))

	sprint, sprintName, err := pickBoardAndSprint(ctx, cl, project.Key)
	if err != nil {
		return err
	}

	loading("issue types")
	types, err := cl.IssueTypes(ctx, project.Key)
	if err != nil {
		return fmt.Errorf("loading issue types: %w", err)
	}
	var typeChoices []jira.IssueType
	var typeItems []pickItem
	defType := 0
	for _, t := range types {
		if t.Subtask {
			continue
		}
		if strings.EqualFold(t.Name, f.kind) || (f.kind == "" && strings.EqualFold(t.Name, "Task")) {
			defType = len(typeChoices)
		}
		typeChoices = append(typeChoices, t)
		typeItems = append(typeItems, pickItem{label: t.Name})
	}
	if len(typeChoices) == 0 {
		return fmt.Errorf("project %s has no usable issue type", project.Key)
	}
	ti, err := pickOne("Issue type", typeItems, defType)
	if err != nil {
		return err
	}
	issueType := typeChoices[ti]
	fmt.Println(cGreen.Render("  ✓ type ") + issueType.Name)

	fmt.Println()
	summary := f.title
	for summary == "" {
		summary = prompt(cBold.Render("Summary: "))
		if summary == "" {
			fmt.Println(cYellow.Render("  a summary is required (ctrl+c to abort)"))
		}
	}
	body := f.body
	if body == "" {
		body = prompt(cBold.Render("Description ") + cDim.Render("(optional, \\n for newlines): "))
		body = strings.ReplaceAll(body, `\n`, "\n")
	}
	fmt.Println()

	priority, err := pickPriority(ctx, cl)
	if err != nil {
		return err
	}

	labels, err := pickLabels(ctx, cl)
	if err != nil {
		return err
	}

	assignee, assigneeName, err := pickAssignee(ctx, cl)
	if err != nil {
		return err
	}

	fmt.Println()
	fmt.Println(cBold.Render("Review"))
	row := func(k, v string) { fmt.Printf("  %s %s\n", cDim.Render(fmt.Sprintf("%-10s", k)), v) }
	row("project", project.Key)
	row("where", sprintName)
	row("type", issueType.Name)
	row("summary", summary)
	if body != "" {
		row("desc", strings.SplitN(body, "\n", 2)[0])
	}
	if priority.Name != "" {
		row("priority", priority.Name)
	}
	if len(labels) > 0 {
		row("labels", strings.Join(labels, ", "))
	}
	row("assignee", assigneeName)
	if ans := strings.ToLower(prompt("\nCreate it? [Y/n] ")); ans == "n" || ans == "no" {
		return errCancelled
	}

	key, err := cl.Create(ctx, jira.NewIssue{
		Project:     project.Key,
		Summary:     summary,
		Description: body,
		TypeID:      issueType.ID,
		Labels:      labels,
		PriorityID:  priority.ID,
		AssigneeID:  assignee,
	})
	if err != nil {
		return err
	}
	fmt.Printf("%s  %s  %s\n", cGreen.Render("✓ Created"), cBlue.Render(key), cDim.Render(cl.BrowseURL(key)))
	if sprint != 0 {
		if err := cl.MoveToSprint(ctx, sprint, key); err != nil {
			fmt.Println(cYellow.Render("  ! created, but could not add to " + sprintName + ": " + err.Error()))
		} else {
			fmt.Println(cGreen.Render("  ✓ added to " + sprintName))
		}
	}
	return nil
}

func pickBoardAndSprint(ctx context.Context, cl *jira.Client, project string) (int, string, error) {
	loading("boards")
	boards, err := cl.Boards(ctx, project)
	if err != nil || len(boards) == 0 {
		return 0, "backlog", nil
	}
	board := boards[0]
	if len(boards) > 1 {
		var items []pickItem
		for _, b := range boards {
			items = append(items, pickItem{label: b.Name, hint: b.Type})
		}
		bi, err := pickOne("Board", items, 0)
		if err != nil {
			return 0, "", err
		}
		board = boards[bi]
	}
	fmt.Println(cGreen.Render("  ✓ board ") + board.Name + cDim.Render("  "+board.Type))
	if board.Type != "scrum" {
		return 0, board.Name, nil
	}

	loading("sprints")
	sprints, err := cl.Sprints(ctx, board.ID)
	if err != nil || len(sprints) == 0 {
		return 0, "backlog", nil
	}
	items := []pickItem{{label: "Backlog", hint: "no sprint"}}
	for _, s := range sprints {
		items = append(items, pickItem{label: s.Name, hint: s.State})
	}
	si, err := pickOne("Sprint", items, 0)
	if err != nil {
		return 0, "", err
	}
	if si == 0 {
		fmt.Println(cGreen.Render("  ✓ backlog"))
		return 0, "backlog", nil
	}
	s := sprints[si-1]
	fmt.Println(cGreen.Render("  ✓ sprint ") + s.Name)
	return s.ID, s.Name, nil
}

func pickPriority(ctx context.Context, cl *jira.Client) (jira.Priority, error) {
	loading("priorities")
	prios, err := cl.Priorities(ctx)
	if err != nil || len(prios) == 0 {
		return jira.Priority{}, nil
	}
	items := []pickItem{{label: "Default", hint: "project default"}}
	for _, p := range prios {
		items = append(items, pickItem{label: p.Name})
	}
	i, err := pickOne("Priority", items, 0)
	if err != nil || i == 0 {
		return jira.Priority{}, err
	}
	fmt.Println(cGreen.Render("  ✓ priority ") + prios[i-1].Name)
	return prios[i-1], nil
}

func pickLabels(ctx context.Context, cl *jira.Client) ([]string, error) {
	loading("labels")
	all, err := cl.Labels(ctx)
	if err != nil {
		fmt.Println(cYellow.Render("  ! could not load labels: " + err.Error()))
	}
	items := make([]pickItem, len(all))
	for i, l := range all {
		items[i] = pickItem{label: l}
	}
	r, err := runPicker("Labels (optional)", items, true, true, 0)
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
	if len(labels) > 0 {
		fmt.Println(cGreen.Render("  ✓ labels ") + strings.Join(labels, ", "))
	}
	return labels, nil
}

func pickAssignee(ctx context.Context, cl *jira.Client) (string, string, error) {
	i, err := pickOne("Assignee", []pickItem{{label: "Me"}, {label: "Unassigned"}}, 0)
	if err != nil {
		return "", "", err
	}
	if i == 1 {
		return "", "unassigned", nil
	}
	id, err := cl.MyAccountID(ctx)
	if err != nil {
		return "", "", fmt.Errorf("looking up your account: %w", err)
	}
	fmt.Println(cGreen.Render("  ✓ assigned to you"))
	return id, "me", nil
}

func cmdSubtasks(ctx context.Context, a *app, args []string) error {
	if err := ensureJira(ctx, a); err != nil {
		return err
	}
	verb := ""
	if len(args) > 0 && !strings.HasPrefix(args[0], "-") {
		switch strings.ToLower(args[0]) {
		case "add", "new", "create":
			verb, args = "add", args[1:]
		case "rm", "remove", "delete", "del":
			verb, args = "rm", args[1:]
		case "ls", "list":
			verb, args = "list", args[1:]
		}
	}
	switch verb {
	case "add":
		return subtaskAdd(ctx, a, args)
	case "rm":
		return subtaskRemove(ctx, a, args)
	default:
		return subtaskList(ctx, a, args)
	}
}

func subtaskList(ctx context.Context, a *app, args []string) error {
	_, rest, err := parseTicketFlags(args)
	if err != nil {
		return err
	}
	key, err := resolveKey(a, rest)
	if err != nil {
		return err
	}
	fmt.Fprintln(os.Stderr, cDim.Render("Subtasks of "+key+" ..."))
	subs, err := a.jira.Children(ctx, key)
	if err != nil {
		return err
	}
	printSubtasks(a.jira, key, subs)
	return nil
}

func printSubtasks(cl *jira.Client, parent string, subs []jira.Issue) {
	fmt.Printf("\n%s %s\n", cDim.Render("parent"), cBold.Render(cBlue.Render(parent)))
	if len(subs) == 0 {
		fmt.Println(cDim.Render("  no subtasks"))
		fmt.Println()
		return
	}
	for _, s := range subs {
		color := issueStatusColor(s.Fields.Status.Category.Key)
		fmt.Printf("  %s  %s  %s\n",
			cBlue.Render(s.Key),
			color(fmt.Sprintf("[%s]", s.Status())),
			s.Summary())
	}
	fmt.Printf("\n  %s\n\n", cDim.Render(cl.BrowseURL(parent)))
}

func subtaskAdd(ctx context.Context, a *app, args []string) error {
	f, rest, err := parseTicketFlags(args)
	if err != nil {
		return err
	}
	key, err := resolveKey(a, rest)
	if err != nil {
		return err
	}
	if len(rest) > 1 && f.title == "" {
		f.title = strings.Join(rest[1:], " ")
	}
	if f.title == "" {
		fmt.Println()
		fmt.Println(cBold.Render("New subtask under " + key))
		f.title = prompt("Summary: ")
	}
	if f.title == "" {
		return fmt.Errorf("a summary is required")
	}

	sub, err := a.jira.CreateSubtask(ctx, key, f.title, f.body)
	if err != nil {
		return err
	}
	fmt.Printf("%s  %s  %s\n", cGreen.Render("✓ Created subtask"), cBlue.Render(sub), cDim.Render(a.jira.BrowseURL(sub)))
	return nil
}

func subtaskRemove(ctx context.Context, a *app, args []string) error {
	f, rest, err := parseTicketFlags(args)
	if err != nil {
		return err
	}
	if len(rest) == 0 {
		return fmt.Errorf("which subtask? usage: bpr sub rm <KEY> [KEY...]")
	}
	for _, raw := range rest {
		key := strings.ToUpper(raw)
		is, err := a.jira.Issue(ctx, key)
		if err != nil {
			return err
		}
		if !f.yes {
			fmt.Printf("\n%s  %s\n", cBold.Render(cBlue.Render(is.Key)), is.Summary())
			if is.ParentKey() != "" {
				fmt.Println(cDim.Render("  parent " + is.ParentKey()))
			}
			if prompt(cYellow.Render("Delete permanently? [y/N] ")) != "y" {
				fmt.Println(cDim.Render("  skipped " + key))
				continue
			}
		}
		if err := a.jira.Delete(ctx, key); err != nil {
			return err
		}
		fmt.Println(cGreen.Render("✓ Deleted " + key))
	}
	return nil
}
