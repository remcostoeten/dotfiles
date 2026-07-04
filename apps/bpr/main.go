package main

import (
	"context"
	"fmt"
	"os"

	"github.com/remcostoeten/bpr/internal/bitbucket"
	"github.com/remcostoeten/bpr/internal/config"
	"github.com/remcostoeten/bpr/internal/jira"
)

// app bundles the resolved credentials, settings and API clients for a command.
type app struct {
	dir      string
	slug     string
	settings config.Settings
	creds    config.Creds
	bb       *bitbucket.Client
	jira     *jira.Client // nil when no jira_site is configured
}

// hasJira reports whether Jira features are available.
func (a *app) hasJira() bool { return a.jira != nil }

// newApp resolves credentials + repo slug and builds the Bitbucket client.
func newApp() (*app, error) {
	dir, _ := os.Getwd()
	creds, ok := config.LoadCreds()
	if !ok {
		return nil, fmt.Errorf("no credentials — run `bpr auth`")
	}
	settings := config.LoadSettings()
	slug, err := config.RepoSlug(dir, settings)
	if err != nil {
		return nil, err
	}
	a := &app{
		dir:      dir,
		slug:     slug,
		settings: settings,
		creds:    creds,
		bb:       bitbucket.New(creds.Email, creds.Token),
	}
	if settings.JiraSite != "" {
		if jc, ok := config.LoadJiraCreds(creds); ok {
			a.jira = jira.New(settings.JiraSite, jc.Email, jc.Token)
		}
	}
	return a, nil
}

func die(err error) {
	fmt.Fprintln(os.Stderr, cRed.Render("error: "+err.Error()))
	os.Exit(1)
}

func main() {
	args := os.Args[1:]
	if len(args) == 0 {
		a, err := newApp()
		if err != nil {
			die(err)
		}
		runPalette(a)
		return
	}

	cmd := args[0]
	args = args[1:]

	switch cmd {
	case "auth", "login":
		if err := cmdAuth(); err != nil {
			die(err)
		}
	case "status", "st":
		mustApp(cmdStatus)
	case "list", "ls":
		mustApp(cmdList)
	case "web", "open", "o":
		mustApp(cmdWeb)
	case "create", "new", "pr":
		mustAppArgs(cmdCreate, args)
	case "todo", "issues", "mine":
		mustApp(cmdTodo)
	case "issue", "ticket":
		mustAppArgs(cmdIssue, args)
	case "dash", "dashboard", "menu", "ui", "i", "interactive":
		mustApp(cmdDashboard)
	case "help", "-h", "--help":
		usage()
	default:
		die(fmt.Errorf("unknown command: %s (try `bpr help`)", cmd))
	}

	if cmd != "auth" && cmd != "help" && cmd != "dash" && cmd != "dashboard" && cmd != "menu" && cmd != "ui" && cmd != "i" && cmd != "interactive" {
		pause()
	}
}

func mustApp(fn func(context.Context, *app) error) {
	a, err := newApp()
	if err != nil {
		die(err)
	}
	if err := fn(context.Background(), a); err != nil {
		die(err)
	}
}

func mustAppArgs(fn func(context.Context, *app, []string) error, args []string) {
	a, err := newApp()
	if err != nil {
		die(err)
	}
	if err := fn(context.Background(), a, args); err != nil {
		die(err)
	}
}

func usage() {
	fmt.Print(`bpr — Bitbucket + Jira for the current repo

  bpr                 command palette (interactive menu)
  bpr dash            interactive dashboard (PRs + tickets)
  bpr status          PR status for the current branch
  bpr list            list open PRs on this repo
  bpr create [opts]   create a PR from the current branch
      -t <title>  -d <dest>  -m <body>  --no-open
  bpr web             open the current-branch PR (or new-PR page)
  bpr todo            list Jira issues assigned to you
  bpr issue [KEY]     show a Jira issue (defaults to the branch's ticket)
  bpr auth            store your Atlassian email + API token(s)
  bpr help            this help

Credentials: env (ATLASSIAN_EMAIL / ATLASSIAN_TOKEN) or ~/.dotfiles/bitbucket-auth
Settings:    ` + config.SettingsPath() + `
`)
}
