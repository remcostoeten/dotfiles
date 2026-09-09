package main

import (
	"context"
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

	project := a.settings.JiraProject
	if project == "" {
		project = strings.ToUpper(prompt("Project key: "))
	}
	if f.title == "" {
		fmt.Println()
		fmt.Println(cBold.Render("New ticket in " + project + " backlog"))
		f.title = prompt("Summary: ")
	}
	if f.title == "" {
		return fmt.Errorf("a summary is required")
	}
	if f.body == "" && len(args) == 0 {
		f.body = prompt("Description (optional): ")
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
