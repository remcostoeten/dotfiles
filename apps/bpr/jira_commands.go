package main

import (
	"context"
	"fmt"
	"os"
	"strings"

	"github.com/remcostoeten/bpr/internal/config"
	"github.com/remcostoeten/bpr/internal/jira"
)

// issueStatusColor picks a color for a Jira status category.
func issueStatusColor(category string) func(...string) string {
	switch category {
	case "done":
		return cGreen.Render
	case "indeterminate":
		return cYellow.Render
	default:
		return cDim.Render
	}
}

func requireJira(a *app) error {
	if !a.hasJira() {
		return fmt.Errorf("no Jira site configured — run `bpr auth` or set jira_site in %s",
			config.SettingsPath())
	}
	return nil
}

func ensureJira(ctx context.Context, a *app) error {
	if a.hasJira() {
		return nil
	}

	fmt.Println()
	fmt.Println(cYellow.Render("Jira isn't configured yet."))
	fmt.Println(cDim.Render("bpr needs a Jira site and project to show your tickets."))
	fmt.Println()

	ans := prompt("Set up Jira now? [Y/n] ")
	if ans == "n" || ans == "N" || ans == "no" {
		return fmt.Errorf("Jira not configured")
	}

	site := prompt("Jira site URL (e.g. https://acme.atlassian.net): ")
	site = strings.TrimSuffix(strings.TrimSpace(site), "/")
	if site == "" {
		return fmt.Errorf("Jira site URL is required")
	}

	project := prompt("Jira project key (e.g. DCR): ")
	project = strings.TrimSpace(project)
	if project == "" {
		return fmt.Errorf("Jira project key is required")
	}

	settings := config.LoadSettings()
	settings.JiraSite = site
	settings.JiraProject = project

	cl := jira.New(site, a.creds.Email, a.creds.Token)
	name, err := cl.Myself(ctx)
	if err != nil {
		fmt.Println(cYellow.Render("Your Bitbucket token doesn't work for Jira: " + err.Error()))
		fmt.Println(cDim.Render("Jira needs its own API token from https://id.atlassian.com/manage-profile/security/api-tokens"))
		fmt.Println()
		jemail := prompt("Jira email (blank to skip): ")
		if jemail == "" {
			return fmt.Errorf("Jira not configured")
		}
		jtok := prompt("Jira API token: ")
		if jtok == "" {
			return fmt.Errorf("Jira not configured")
		}
		cl = jira.New(site, jemail, jtok)
		name, err = cl.Myself(ctx)
		if err != nil {
			return fmt.Errorf("Jira authentication failed: %w", err)
		}
		if err := config.SaveJiraCreds(config.Creds{Email: jemail, Token: jtok}); err != nil {
			return err
		}
	}

	if err := config.SaveSettings(settings); err != nil {
		return err
	}

	a.jira = cl
	a.settings = settings
	fmt.Println(cGreen.Render("✓ Jira configured — authenticated as " + name))
	return nil
}

func cmdTodo(ctx context.Context, a *app) error {
	if err := ensureJira(ctx, a); err != nil {
		return err
	}
	fmt.Fprintln(os.Stderr, cDim.Render("Your open issues ..."))
	issues, err := a.jira.MyIssues(ctx, a.settings.JiraProject)
	if err != nil {
		return err
	}
	if len(issues) == 0 {
		project := ""
		if a.settings.JiraProject != "" {
			project = fmt.Sprintf("project=%q ", a.settings.JiraProject)
		}
		fmt.Fprintf(os.Stderr, cDim.Render("JQL: %sassignee = currentUser() AND resolution = unresolved\n"), project)
		fmt.Println(cGreen.Render("No open issues assigned to you. 🎉"))
		return nil
	}
	for _, is := range issues {
		color := issueStatusColor(is.Fields.Status.Category.Key)
		fmt.Printf("  %s  %s  %s\n",
			cBlue.Render(is.Key),
			color(fmt.Sprintf("[%s]", is.Status())),
			is.Summary())
	}
	return nil
}

func cmdIssue(ctx context.Context, a *app, args []string) error {
	if err := ensureJira(ctx, a); err != nil {
		return err
	}
	key := ""
	if len(args) > 0 {
		key = args[0]
	} else {
		key = branchTicket(currentBranch(a.dir))
	}
	if key == "" {
		return fmt.Errorf("no issue key given and none found in the branch name")
	}
	is, err := a.jira.Issue(ctx, key)
	if err != nil {
		return err
	}
	printIssue(a.jira, is)
	return nil
}

func printIssue(cl *jira.Client, is *jira.Issue) {
	color := issueStatusColor(is.Fields.Status.Category.Key)
	fmt.Printf("\n%s  %s\n", cBold.Render(cBlue.Render(is.Key)), is.Summary())
	fmt.Printf("  status    %s\n", color(is.Status()))
	fmt.Printf("  type      %s\n", is.Fields.IssueType.Name)
	if is.Fields.Priority != nil {
		fmt.Printf("  priority  %s\n", is.Fields.Priority.Name)
	}
	if is.Fields.Assignee != nil {
		fmt.Printf("  assignee  %s\n", is.Fields.Assignee.DisplayName)
	}
	if desc := is.DescriptionText(); desc != "" {
		fmt.Printf("\n%s\n", desc)
	}
	fmt.Printf("\n  %s\n\n", cDim.Render(cl.BrowseURL(is.Key)))
}
