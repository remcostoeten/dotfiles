package main

import (
	"context"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"strings"

	"github.com/remcostoeten/bpr/internal/jira"
)

func warnLine(msg string) { fmt.Println(cYellow.Render("  ! " + msg)) }
func okLine(msg string)   { fmt.Println(cGreen.Render("  ✓ ") + msg) }

func upperAll(keys []string) []string {
	out := make([]string, len(keys))
	for i, k := range keys {
		out[i] = strings.ToUpper(k)
	}
	return out
}

func confirm(q string) bool {
	ans := strings.ToLower(prompt(q + " [y/N] "))
	return ans == "y" || ans == "yes"
}

func resolveAssignee(ctx context.Context, cl *jira.Client, project, who string) (string, string, error) {
	switch strings.ToLower(who) {
	case "me":
		id, err := cl.MyAccountID(ctx)
		return id, "me", err
	case "none", "unassigned", "-":
		return "", "unassigned", nil
	}
	users, err := cl.AssignableUsers(ctx, project)
	if err != nil {
		return "", "", err
	}
	var hits []jira.User
	for _, u := range users {
		if strings.Contains(strings.ToLower(u.DisplayName), strings.ToLower(who)) {
			hits = append(hits, u)
		}
	}
	switch len(hits) {
	case 0:
		return "", "", fmt.Errorf("no assignable user matches %q in %s", who, project)
	case 1:
		return hits[0].AccountID, hits[0].DisplayName, nil
	}
	names := make([]string, len(hits))
	for i, u := range hits {
		names[i] = u.DisplayName
	}
	return "", "", fmt.Errorf("%q is ambiguous: %s", who, strings.Join(names, ", "))
}

func pickUser(ctx context.Context, cl *jira.Client, project, title string) (string, string, error) {
	loading("users")
	users, err := cl.AssignableUsers(ctx, project)
	if err != nil {
		warnLine("could not load users: " + err.Error())
	}
	items := []pickItem{{label: "Me"}, {label: "Unassigned"}}
	for _, u := range users {
		items = append(items, pickItem{label: u.DisplayName})
	}
	i, err := pickOne(title, items, 0)
	if err != nil {
		return "", "", err
	}
	switch i {
	case 0:
		id, err := cl.MyAccountID(ctx)
		return id, "me", err
	case 1:
		return "", "unassigned", nil
	}
	return users[i-2].AccountID, users[i-2].DisplayName, nil
}

func editText(initial string) (string, error) {
	f, err := os.CreateTemp("", "bpr-*.md")
	if err != nil {
		return "", err
	}
	path := f.Name()
	defer os.Remove(path)
	if _, err := f.WriteString(initial); err != nil {
		f.Close()
		return "", err
	}
	f.Close()
	cmd := exec.Command("sh", "-c", editorCommand()+` "$1"`, "sh", path)
	cmd.Stdin, cmd.Stdout, cmd.Stderr = os.Stdin, os.Stdout, os.Stderr
	if err := cmd.Run(); err != nil {
		return "", err
	}
	b, err := os.ReadFile(path)
	return strings.TrimRight(string(b), "\n"), err
}

func promptDescription() string {
	d := prompt(cBold.Render("Description ") + cDim.Render("(optional, \\n for newlines, 'e' for $EDITOR): "))
	if d == "e" {
		text, err := editText("")
		if err != nil {
			warnLine("editor: " + err.Error())
			return ""
		}
		return text
	}
	return strings.ReplaceAll(d, `\n`, "\n")
}

type newKind int

const (
	kindTicket newKind = iota
	kindEpic
	kindChild
)

func createOnBoard(ctx context.Context, cl *jira.Client, t *boardTarget, kind newKind, o boardOpts, inSprint bool) (string, error) {
	interactive := o.title == ""
	summary := o.title
	what := map[newKind]string{kindTicket: "ticket", kindEpic: "epic", kindChild: "ticket in " + o.epic}[kind]
	if interactive {
		fmt.Println()
		fmt.Println(cBold.Render("New " + what + " on " + t.name))
		for summary == "" {
			summary = prompt(cBold.Render("Summary: "))
		}
		if o.body == "" {
			o.body = promptDescription()
		}
	}

	n := jira.NewIssue{Project: t.project, Summary: summary, Description: o.body}
	switch kind {
	case kindEpic:
		et, err := cl.EpicType(ctx, t.project)
		if err != nil {
			return "", err
		}
		n.TypeID = et.ID
	case kindChild:
		n.Parent = o.epic
	}
	if kind != kindEpic && interactive {
		types, err := cl.IssueTypes(ctx, t.project)
		if err != nil {
			return "", err
		}
		var choices []jira.IssueType
		var items []pickItem
		def := 0
		for _, it := range types {
			if it.Subtask || it.HierarchyLevel > 0 {
				continue
			}
			if strings.EqualFold(it.Name, "Taak") || strings.EqualFold(it.Name, "Task") {
				def = len(choices)
			}
			choices = append(choices, it)
			items = append(items, pickItem{label: it.Name})
		}
		if len(choices) > 1 {
			i, err := pickOne("Type", items, def)
			if err != nil {
				return "", err
			}
			def = i
		}
		if len(choices) > 0 {
			n.TypeID = choices[def].ID
			okLine("type " + choices[def].Name)
		}
	}
	if t.project == marProject && kind != kindEpic {
		n.Labels = []string{marLabel}
	}

	switch {
	case o.assignee != "":
		id, _, err := resolveAssignee(ctx, cl, t.project, o.assignee)
		if err != nil {
			return "", err
		}
		n.AssigneeID = id
	case interactive:
		id, name, err := pickUser(ctx, cl, t.project, "Assignee")
		if err != nil {
			return "", err
		}
		n.AssigneeID = id
		okLine("assignee " + name)
	}

	where := "backlog"
	if inSprint {
		where = "active sprint"
	}
	if interactive {
		fmt.Printf("\n  %s %s  %s\n", cDim.Render("create"), summary, cDim.Render("→ "+t.name+" · "+where))
		if ans := strings.ToLower(prompt("Create it? [Y/n] ")); ans == "n" || ans == "no" {
			return "", errCancelled
		}
	}

	key, err := cl.Create(ctx, n)
	if err != nil {
		return "", err
	}
	fmt.Printf("%s  %s  %s\n", cGreen.Render("✓ Created"), cBlue.Render(key), cDim.Render(cl.BrowseURL(key)))
	if inSprint {
		if s, err := t.activeSprint(ctx, cl); err != nil {
			warnLine(err.Error() + ", left in backlog")
		} else if err := cl.MoveToSprint(ctx, s.ID, key); err != nil {
			warnLine("could not add to " + s.Name + ": " + err.Error())
		} else {
			okLine("in sprint " + s.Name)
		}
	}
	return key, nil
}

func cmdNew(kind newKind) func(context.Context, *app, []string) error {
	return func(ctx context.Context, a *app, args []string) error {
		if err := ensureJira(ctx, a); err != nil {
			return err
		}
		o, rest, err := parseBoardOpts(args)
		if err != nil {
			return err
		}
		if kind == kindChild {
			if o.epic == "" && len(rest) > 0 {
				o.epic, rest = strings.ToUpper(rest[0]), rest[1:]
			}
			if o.epic == "" {
				return fmt.Errorf("which epic? usage: bpr epic add <EPIC> [summary]")
			}
		} else if o.epic != "" {
			kind = kindChild
		}
		if o.title == "" {
			o.title = strings.Join(rest, " ")
		}
		t, err := resolveTarget(ctx, a.jira, o.project)
		if err != nil {
			return err
		}
		inSprint := (kind != kindTicket || o.sprint) && !o.backlog
		_, err = createOnBoard(ctx, a.jira, t, kind, o, inSprint)
		if errors.Is(err, errCancelled) {
			fmt.Println(cDim.Render("  cancelled, nothing created"))
			return nil
		}
		return err
	}
}

func moveIssues(ctx context.Context, cl *jira.Client, t *boardTarget, keys []string, toBacklog bool) error {
	if toBacklog {
		if err := cl.MoveToBacklog(ctx, keys...); err != nil {
			return err
		}
		okLine(strings.Join(keys, ", ") + " → backlog")
		return nil
	}
	s, err := t.activeSprint(ctx, cl)
	if err != nil {
		return err
	}
	if err := cl.MoveToSprint(ctx, s.ID, keys...); err != nil {
		return err
	}
	okLine(strings.Join(keys, ", ") + " → " + s.Name)
	return nil
}

func cmdMove(ctx context.Context, a *app, args []string) error {
	if err := ensureJira(ctx, a); err != nil {
		return err
	}
	o, rest, err := parseBoardOpts(args)
	if err != nil {
		return err
	}
	if len(rest) == 0 {
		return fmt.Errorf("usage: bpr move <KEY>... [--backlog]")
	}
	project := o.project
	if project == "" {
		project = jira.ProjectOf(strings.ToUpper(rest[0]))
	}
	t, err := resolveTarget(ctx, a.jira, project)
	if err != nil {
		return err
	}
	return moveIssues(ctx, a.jira, t, upperAll(rest), o.backlog)
}

func nestIssue(ctx context.Context, cl *jira.Client, key, parent string, yes bool) error {
	if strings.EqualFold(parent, "none") {
		empty := ""
		if err := cl.Update(ctx, key, jira.IssueUpdate{Parent: &empty}); err != nil {
			return err
		}
		okLine(key + " detached from its parent")
		return nil
	}
	if key == parent {
		return fmt.Errorf("a ticket cannot be its own parent")
	}
	is, err := cl.Issue(ctx, key)
	if err != nil {
		return err
	}
	p, err := cl.Issue(ctx, parent)
	if err != nil {
		return err
	}
	if p.Fields.IssueType.Subtask {
		return fmt.Errorf("%s is itself a subtask; Jira allows only one level of subtasks", parent)
	}
	if is.IsEpic() {
		return fmt.Errorf("%s is an epic and cannot be nested", key)
	}

	if p.IsEpic() || is.Fields.IssueType.Subtask {
		if p.IsEpic() && is.Fields.IssueType.Subtask {
			return fmt.Errorf("%s is a subtask; move its parent into the epic instead", key)
		}
		if err := cl.Update(ctx, key, jira.IssueUpdate{Parent: &p.Key}); err != nil {
			return err
		}
		okLine(key + " is now under " + p.Key + "  " + cDim.Render(p.Summary()))
		return nil
	}

	if n := len(is.Fields.Subtasks); n > 0 {
		return fmt.Errorf("%s has %d subtasks of its own; a subtask cannot have subtasks", key, n)
	}
	st, err := cl.SubtaskType(ctx, p.ProjectKey())
	if err != nil {
		return err
	}
	err = cl.Update(ctx, key, jira.IssueUpdate{TypeID: &st.ID, Parent: &p.Key})
	if err == nil {
		okLine(key + " is now a subtask of " + p.Key)
		return nil
	}
	warnLine("Jira refused to convert " + key + " in place: " + err.Error())
	if !yes && !confirm(fmt.Sprintf("Recreate %s as a subtask of %s? Summary, description, assignee and labels are copied; comments and history are lost and %s is deleted.", key, p.Key, key)) {
		return errCancelled
	}
	n := jira.NewIssue{
		Project: p.ProjectKey(),
		Summary: is.Summary(),
		RawDesc: is.Fields.Description,
		TypeID:  st.ID,
		Parent:  p.Key,
		Labels:  is.Fields.Labels,
	}
	if is.Fields.Assignee != nil {
		n.AssigneeID = is.Fields.Assignee.AccountID
	}
	newKey, err := cl.Create(ctx, n)
	if err != nil {
		return fmt.Errorf("creating the subtask: %w", err)
	}
	okLine("created " + newKey + " under " + p.Key)
	if is.Fields.Status.Category.Key != "new" {
		if err := cl.TransitionTo(ctx, newKey, is.Status()); err != nil {
			warnLine("could not restore status " + is.Status() + ": " + err.Error())
		}
	}
	_ = cl.AddComment(ctx, newKey, "Recreated from "+key+" by bpr nest.")
	if err := cl.Delete(ctx, key); err != nil {
		return fmt.Errorf("created %s but could not delete %s: %w", newKey, key, err)
	}
	okLine("deleted " + key)
	return nil
}

func cmdNest(ctx context.Context, a *app, args []string) error {
	if err := ensureJira(ctx, a); err != nil {
		return err
	}
	o, rest, err := parseBoardOpts(args)
	if err != nil {
		return err
	}
	if len(rest) < 2 {
		return fmt.Errorf("usage: bpr nest <KEY>... <PARENT|none>")
	}
	parent := strings.ToUpper(rest[len(rest)-1])
	for _, key := range upperAll(rest[:len(rest)-1]) {
		err := nestIssue(ctx, a.jira, key, parent, o.yes)
		if errors.Is(err, errCancelled) {
			fmt.Println(cDim.Render("  skipped " + key))
			continue
		}
		if err != nil {
			return err
		}
	}
	return nil
}

func deleteIssues(ctx context.Context, cl *jira.Client, keys []string, yes bool) error {
	for _, key := range keys {
		is, err := cl.Issue(ctx, key)
		if err != nil {
			return err
		}
		if !yes {
			fmt.Printf("\n%s  %s\n", cBold.Render(cBlue.Render(is.Key)), is.Summary())
			if n := len(is.Fields.Subtasks); n > 0 {
				fmt.Println(cYellow.Render(fmt.Sprintf("  has %d subtasks, they are deleted too", n)))
			}
			if !confirm(cYellow.Render("Delete permanently?")) {
				fmt.Println(cDim.Render("  skipped " + key))
				continue
			}
		}
		if err := cl.Delete(ctx, key); err != nil {
			return err
		}
		okLine("deleted " + key)
	}
	return nil
}

func cmdDelete(ctx context.Context, a *app, args []string) error {
	if err := ensureJira(ctx, a); err != nil {
		return err
	}
	o, rest, err := parseBoardOpts(args)
	if err != nil {
		return err
	}
	if len(rest) == 0 {
		return fmt.Errorf("usage: bpr rm <KEY>... [-f]")
	}
	return deleteIssues(ctx, a.jira, upperAll(rest), o.yes)
}

type editFlags struct {
	title, body, assignee, status, labels, parent string
	editor                                        bool
}

func (f editFlags) empty() bool {
	return f == editFlags{}
}

func parseEditFlags(args []string) (editFlags, []string, error) {
	var f editFlags
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
		case "-t", "--title", "--summary":
			f.title = next()
		case "-m", "--message", "--body", "-d", "--description":
			f.body = next()
		case "-e", "--editor":
			f.editor = true
		case "-a", "--assignee":
			f.assignee = next()
		case "-s", "--status":
			f.status = next()
		case "-l", "--labels":
			f.labels = next()
		case "-p", "--parent":
			f.parent = strings.ToUpper(next())
		default:
			if strings.HasPrefix(args[i], "-") {
				return f, nil, fmt.Errorf("unknown flag: %s", args[i])
			}
			rest = append(rest, args[i])
		}
	}
	return f, rest, nil
}

func splitLabels(s string) []string {
	var out []string
	for _, l := range strings.FieldsFunc(s, func(r rune) bool { return r == ',' || r == ' ' }) {
		out = append(out, l)
	}
	return out
}

func applyEditFlags(ctx context.Context, cl *jira.Client, is *jira.Issue, f editFlags) error {
	var u jira.IssueUpdate
	if f.title != "" {
		u.Summary = &f.title
	}
	if f.editor {
		text, err := editText(is.DescriptionText())
		if err != nil {
			return err
		}
		u.Description = &text
	} else if f.body != "" {
		body := strings.ReplaceAll(f.body, `\n`, "\n")
		u.Description = &body
	}
	if f.assignee != "" {
		id, _, err := resolveAssignee(ctx, cl, is.ProjectKey(), f.assignee)
		if err != nil {
			return err
		}
		u.AssigneeID = &id
	}
	if f.labels != "" {
		labels := splitLabels(f.labels)
		u.Labels = &labels
	}
	if err := cl.Update(ctx, is.Key, u); err != nil {
		return err
	}
	if f.status != "" {
		if err := cl.TransitionTo(ctx, is.Key, f.status); err != nil {
			return err
		}
	}
	if f.parent != "" {
		if err := nestIssue(ctx, cl, is.Key, f.parent, false); err != nil {
			return err
		}
	}
	okLine("updated " + is.Key)
	return nil
}

func editInteractive(ctx context.Context, cl *jira.Client, key string) error {
	for {
		is, err := cl.Issue(ctx, key)
		if err != nil {
			return err
		}
		desc := is.DescriptionText()
		if desc == "" {
			desc = "(empty)"
		}
		items := []pickItem{
			{label: "Summary", hint: is.Summary()},
			{label: "Description", hint: fit(strings.SplitN(desc, "\n", 2)[0], 50)},
			{label: "Assignee", hint: assigneeLabel(*is)},
			{label: "Status", hint: is.Status()},
			{label: "Labels", hint: strings.Join(is.Fields.Labels, ", ")},
			{label: "Parent", hint: is.ParentKey()},
			{label: "Done"},
		}
		i, err := pickOne("Edit "+key, items, 0)
		if err != nil || i == 6 {
			if errors.Is(err, errCancelled) {
				return nil
			}
			return err
		}
		var f editFlags
		switch i {
		case 0:
			f.title = prompt(fmt.Sprintf("Summary [%s]: ", is.Summary()))
		case 1:
			f.editor = true
		case 2:
			id, name, err := pickUser(ctx, cl, is.ProjectKey(), "Assignee")
			if err != nil {
				return err
			}
			if err := cl.Update(ctx, key, jira.IssueUpdate{AssigneeID: &id}); err != nil {
				return err
			}
			okLine("assignee " + name)
			continue
		case 3:
			if err := pickTransition(ctx, cl, key); err != nil && !errors.Is(err, errCancelled) {
				return err
			}
			continue
		case 4:
			f.labels = prompt(fmt.Sprintf("Labels, comma separated [%s]: ", strings.Join(is.Fields.Labels, ", ")))
		case 5:
			f.parent = strings.ToUpper(prompt("New parent key (an epic, a ticket, or 'none'): "))
		}
		if f.empty() {
			continue
		}
		if err := applyEditFlags(ctx, cl, is, f); err != nil {
			if errors.Is(err, errCancelled) {
				continue
			}
			fmt.Fprintln(os.Stderr, cRed.Render("error: "+err.Error()))
		}
		if f.parent != "" {
			return nil
		}
	}
}

func pickTransition(ctx context.Context, cl *jira.Client, key string) error {
	ts, err := cl.Transitions(ctx, key)
	if err != nil {
		return err
	}
	items := make([]pickItem, len(ts))
	for i, t := range ts {
		items[i] = pickItem{label: t.To.Name, hint: t.Name}
	}
	i, err := pickOne("Move "+key+" to", items, 0)
	if err != nil {
		return err
	}
	if err := cl.Transition(ctx, key, ts[i].ID); err != nil {
		return err
	}
	okLine(key + " → " + ts[i].To.Name)
	return nil
}

func cmdEdit(ctx context.Context, a *app, args []string) error {
	if err := ensureJira(ctx, a); err != nil {
		return err
	}
	f, rest, err := parseEditFlags(args)
	if err != nil {
		return err
	}
	key, err := resolveKey(a, rest)
	if err != nil {
		return err
	}
	if f.empty() {
		return editInteractive(ctx, a.jira, key)
	}
	is, err := a.jira.Issue(ctx, key)
	if err != nil {
		return err
	}
	return applyEditFlags(ctx, a.jira, is, f)
}

func cmdEpic(ctx context.Context, a *app, args []string) error {
	verb := "ls"
	if len(args) > 0 && !strings.HasPrefix(args[0], "-") {
		verb, args = strings.ToLower(args[0]), args[1:]
	}
	switch verb {
	case "new", "create":
		return cmdNew(kindEpic)(ctx, a, args)
	case "add", "child":
		return cmdNew(kindChild)(ctx, a, args)
	case "ls", "list":
		return listEpics(ctx, a, args)
	}
	return fmt.Errorf("unknown epic command %q (new, add, ls)", verb)
}

func listEpics(ctx context.Context, a *app, args []string) error {
	if err := ensureJira(ctx, a); err != nil {
		return err
	}
	o, _, err := parseBoardOpts(args)
	if err != nil {
		return err
	}
	project := o.project
	if project == "" {
		project = marProject
	}
	epics, err := a.jira.Search(ctx, fmt.Sprintf("project = %q AND issuetype = Epic AND statusCategory != Done ORDER BY created DESC", project), 100)
	if err != nil {
		return err
	}
	fmt.Printf("\n%s  %s\n", cBold.Render(project+" epics"), cDim.Render(fmt.Sprintf("%d open", len(epics))))
	for _, e := range epics {
		sprint := cDim.Render("backlog")
		if s := e.ActiveSprint(); s != nil {
			sprint = cCyan.Render(s.Name)
		}
		fmt.Printf("  %s  %s  %s  %s\n", cBlue.Render(fmt.Sprintf("%-8s", e.Key)), e.Summary(), cGrayB.Render(e.Status()), sprint)
	}
	fmt.Println()
	return nil
}
