package main

import (
	"bufio"
	"context"
	"fmt"
	"os"
	"strings"

	"github.com/remcostoeten/bpr/internal/bitbucket"
	"github.com/remcostoeten/bpr/internal/config"
	"github.com/remcostoeten/bpr/internal/jira"
)

func prompt(label string) string {
	fmt.Print(label)
	sc := bufio.NewScanner(os.Stdin)
	if sc.Scan() {
		return strings.TrimSpace(sc.Text())
	}
	return ""
}

func cmdAuth() error {
	fmt.Println(cBold.Render("Atlassian credentials") + " (used for both Bitbucket and Jira)")
	fmt.Println("API token: https://id.atlassian.com/manage-profile/security/api-tokens")
	fmt.Println(cDim.Render("An API token (not an app password) works for both APIs."))
	fmt.Println()
	email := prompt("Email: ")
	token := prompt("API token: ")
	if email == "" || token == "" {
		return fmt.Errorf("both fields are required")
	}
	creds := config.Creds{Email: email, Token: token}
	if err := config.SaveCreds(creds); err != nil {
		return err
	}
	fmt.Println(cGreen.Render("✓ Saved to ~/.dotfiles/bitbucket-auth (chmod 600)"))

	bb := bitbucket.New(email, token)
	if u, err := bb.CurrentUser(context.Background()); err == nil && u.DisplayName != "" {
		fmt.Println(cGreen.Render("✓ Verified — authenticated as " + u.DisplayName))
	} else {
		fmt.Println(cYellow.Render("! Saved, but could not verify against Bitbucket. Check the token scopes."))
	}

	s := config.LoadSettings()
	if s.JiraSite == "" {
		fmt.Println()
		fmt.Println(cDim.Render("Optional — set your Jira site to enable ticket features:"))
		site := prompt("Jira site URL (e.g. https://acme.atlassian.net), blank to skip: ")
		if site == "" {
			return nil
		}
		s.JiraSite = strings.TrimSuffix(site, "/")
		s.JiraProject = prompt("Jira project key (e.g. DCR): ")
		if err := config.SaveSettings(s); err != nil {
			return err
		}
		fmt.Println(cGreen.Render("✓ Saved Jira settings to " + config.SettingsPath()))
	}

	if s.JiraSite != "" {
		if err := verifyJira(s, creds); err != nil {
			fmt.Println()
			fmt.Println(cYellow.Render("! Your Bitbucket token doesn't work for Jira: " + err.Error()))
			fmt.Println(cDim.Render("Jira needs its own Atlassian API token (id.atlassian.com/manage-profile/security/api-tokens),"))
			fmt.Println(cDim.Render("created while logged into your Jira account."))
			jmail := prompt("Jira email (blank to skip): ")
			if jmail == "" {
				return nil
			}
			jtok := prompt("Jira API token: ")
			if jtok == "" {
				return nil
			}
			jc := config.Creds{Email: jmail, Token: jtok}
			if err := verifyJira(s, jc); err != nil {
				fmt.Println(cYellow.Render("! Still could not authenticate to Jira: " + err.Error()))
			}
			if err := config.SaveJiraCreds(jc); err != nil {
				return err
			}
			fmt.Println(cGreen.Render("✓ Saved Jira credentials to ~/.dotfiles/jira-auth (chmod 600)"))
		}
	}
	return nil
}

// verifyJira confirms creds can reach the Jira site (calls /myself).
func verifyJira(s config.Settings, c config.Creds) error {
	cl := jira.New(s.JiraSite, c.Email, c.Token)
	name, err := cl.Myself(context.Background())
	if err != nil {
		return err
	}
	fmt.Println(cGreen.Render("✓ Jira verified — authenticated as " + name))
	return nil
}

func cmdStatus(ctx context.Context, a *app) error {
	branch := currentBranch(a.dir)
	fmt.Fprintln(os.Stderr, cDim.Render(fmt.Sprintf("Checking PR for '%s' on %s ...", branch, a.slug)))
	pr, err := a.bb.PRForBranch(ctx, a.slug, branch)
	if err != nil {
		return err
	}
	if pr == nil {
		fmt.Printf("%s %s\n\n", cYellow.Render("No open PR for branch"), cBold.Render(branch))
		fmt.Println("  " + cCyan.Render("bpr create") + cDim.Render("  to create one"))
		return nil
	}
	statuses, _ := a.bb.Statuses(ctx, a.slug, pr.Source.Commit.Hash)
	ci := summarizeCI(statuses)
	fmt.Printf("\n%s  %s\n", cBold.Render(cBlue.Render(fmt.Sprintf("PR #%d", pr.ID))), cBold.Render(pr.Title))
	fmt.Printf("  %s %s\n", cDim.Render("state →"), cGreen.Render(pr.State))
	fmt.Printf("  %s %s%d%s\n", cDim.Render("branch →"), cBranch.Render(pr.Source.Branch.Name), cDim.Render(" → "), cBranch.Render(pr.Destination.Branch.Name))
	fmt.Printf("  %s %s%d%s\n", cDim.Render("approvals →"), cGreen.Render("✓"), pr.Approvals(), cDim.Render(""))
	fmt.Printf("  %s %s\n", cDim.Render("ci →"), ci.short())
	fmt.Printf("  %s %s\n\n", cDim.Render("url →"), cDim.Render(pr.Links.HTML.Href))
	return nil
}

func cmdList(ctx context.Context, a *app) error {
	fmt.Fprintln(os.Stderr, cDim.Render("Open pull requests on "+a.slug+" ..."))
	prs, err := a.bb.ListOpenPRs(ctx, a.slug)
	if err != nil {
		return err
	}
	if len(prs) == 0 {
		fmt.Println(cYellow.Render("No open pull requests."))
		return nil
	}
	for _, pr := range prs {
		meta := cDim.Render(fmt.Sprintf("%s → %s", pr.Source.Branch.Name, pr.Destination.Branch.Name))
		author := cGrayB.Render(pr.Author.DisplayName)
		fmt.Printf("  %s  %s  %s  %s\n",
			cBlue.Render(fmt.Sprintf("#%-4d", pr.ID)),
			pr.Title,
			cDim.Render(meta),
			author)
	}
	return nil
}

func cmdWeb(ctx context.Context, a *app) error {
	branch := currentBranch(a.dir)
	pr, err := a.bb.PRForBranch(ctx, a.slug, branch)
	if err != nil {
		return err
	}
	var url string
	if pr != nil {
		url = pr.Links.HTML.Href
	} else {
		fmt.Fprintln(os.Stderr, cDim.Render("No open PR — opening the new-PR page."))
		url = fmt.Sprintf("https://bitbucket.org/%s/pull-requests/new?source=%s", a.slug, branch)
	}
	fmt.Println("Opening " + url)
	openURL(url)
	return nil
}

func cmdCreate(ctx context.Context, a *app, args []string) error {
	branch := currentBranch(a.dir)
	var title, dest, body string
	openAfter := true
	for i := 0; i < len(args); i++ {
		switch args[i] {
		case "-t", "--title":
			i++
			if i < len(args) {
				title = args[i]
			}
		case "-d", "--dest":
			i++
			if i < len(args) {
				dest = args[i]
			}
		case "-m", "--message", "--body":
			i++
			if i < len(args) {
				body = args[i]
			}
		case "--no-open":
			openAfter = false
		default:
			return fmt.Errorf("unknown flag for create: %s", args[i])
		}
	}

	if existing, err := a.bb.PRForBranch(ctx, a.slug, branch); err != nil {
		return err
	} else if existing != nil {
		fmt.Printf("%s PR #%d already open %s\n", cYellow.Render("!"), existing.ID, cDim.Render(existing.Links.HTML.Href))
		if openAfter {
			openURL(existing.Links.HTML.Href)
		}
		return nil
	}

	if !branchOnOrigin(a.dir, branch) {
		fmt.Fprintln(os.Stderr, cDim.Render("Branch not on origin yet — pushing ..."))
		if out, err := pushBranch(a.dir, branch); err != nil {
			return fmt.Errorf("push failed: %s", out)
		}
	}
	if dest == "" {
		dest, _ = a.bb.MainBranch(ctx, a.slug)
		if dest == "" {
			dest = "main"
		}
	}
	if title == "" {
		title = defaultTitle(a.dir, branch)
	}

	pr, err := a.bb.Create(ctx, a.slug, bitbucket.CreateOptions{
		Title: title, Source: branch, Destination: dest,
		Description: body, CloseSourceBranch: true,
	})
	if err != nil {
		return err
	}
	fmt.Printf("%s  %s\n", cGreen.Render("✓ Created PR"), pr.Links.HTML.Href)
	if openAfter {
		openURL(pr.Links.HTML.Href)
	}
	return nil
}
