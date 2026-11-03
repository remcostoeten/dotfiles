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
func newApp() (*app, error) { return buildApp(true) }

// newJiraApp is newApp for the ticket commands, which work outside a Bitbucket
// repo — there the slug is simply unknown.
func newJiraApp() (*app, error) { return buildApp(false) }

func buildApp(needSlug bool) (*app, error) {
	dir, _ := os.Getwd()
	settings := config.LoadSettings()
	creds, ok := config.LoadCreds()
	if !ok && (needSlug || settings.JiraSite == "" || !jira.HasTWG()) {
		return nil, fmt.Errorf("no credentials — run `bpr auth`")
	}
	slug, err := config.RepoSlug(dir, settings)
	if err != nil && needSlug {
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
		if os.Getenv("BPR_JIRA_BACKEND") != "token" && jira.HasTWG() {
			a.jira = jira.NewTWG(settings.JiraSite)
		} else if jc, ok := config.LoadJiraCreds(creds); ok {
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
		a, err := newJiraApp()
		if err != nil {
			die(err)
		}
		runPalette(a)
		return
	}

	cmd := args[0]
	args = args[1:]

	switch cmd {
	case "mcp":
		if err := runMCP(context.Background()); err != nil {
			die(err)
		}
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
	case "create", "pr":
		mustAppArgs(cmdCreate, args)
	case "todo", "issues", "mine":
		mustJira(cmdTodo)
	case "issue", "ticket":
		mustJiraArgs(cmdIssue, args)
	case "ticket-new", "nt":
		mustJiraArgs(cmdTicketNew, args)
	case "mar", "marketing", "m":
		mustJiraArgs(cmdMarketing, args)
	case "sub", "subs", "subtask", "subtasks":
		mustJiraArgs(cmdSubtasks, args)
	case "board", "b":
		mustJiraArgs(cmdBoardView(viewBoard), args)
	case "backlog", "bl":
		mustJiraArgs(cmdBoardView(viewBacklog), args)
	case "new", "add":
		mustJiraArgs(cmdNew(kindTicket), args)
	case "epic", "epics":
		mustJiraArgs(cmdEpic, args)
	case "move", "mv":
		mustJiraArgs(cmdMove, args)
	case "nest":
		mustJiraArgs(cmdNest, args)
	case "edit", "update":
		mustJiraArgs(cmdEdit, args)
	case "rm", "delete", "del":
		mustJiraArgs(cmdDelete, args)
	case "dash", "dashboard", "menu", "ui", "i", "interactive":
		mustApp(cmdDashboard)
	case "help", "-h", "--help":
		usage()
	default:
		die(fmt.Errorf("unknown command: %s (try `bpr help`)", cmd))
	}

	switch cmd {
	case "auth", "login", "help", "-h", "--help", "dash", "dashboard", "menu", "ui", "i", "interactive", "board", "b", "backlog", "bl", "mcp":
	default:
		if isTerminal() {
			pause()
		}
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

func mustJira(fn func(context.Context, *app) error) {
	a, err := newJiraApp()
	if err != nil {
		die(err)
	}
	if err := fn(context.Background(), a); err != nil {
		die(err)
	}
}

func mustJiraArgs(fn func(context.Context, *app, []string) error, args []string) {
	a, err := newJiraApp()
	if err != nil {
		die(err)
	}
	if err := fn(context.Background(), a, args); err != nil {
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
  bpr issue [KEY]     show a Jira issue + its subtasks (defaults to the branch's ticket)

Board (marketing board by default, -p <PROJECT> for another):
  bpr board  [-a <who>] [--print] [-l] [--json]
                      active sprint by lane: name, assignee, description, PR / merged / deployed
  bpr backlog [-a <who>] [--print] [-l] [--json]
                      backlog; <who> is me, none, or part of a name
                      interactive in a terminal: n new · E epic · c child · m move · p nest
                      e edit · s status · i assign · d delete
  bpr new [summary] [-m <desc>] [-a <who>] [-s] [-e <EPIC>]
                      new ticket in the backlog (-s: active sprint, -e: inside an epic)
  bpr epic new [summary] [-m <desc>] [-b]
                      new epic in the active sprint (-b: backlog)
  bpr epic add <EPIC> [summary] [-m <desc>] [-b]
                      new ticket inside an epic, in the active sprint
  bpr epic ls         open epics
  bpr move <KEY>... [-b]
                      backlog -> active sprint (-b: back to the backlog)
  bpr nest <KEY>... <PARENT|none>
                      put tickets under an epic (child) or a ticket (subtask)
  bpr edit [KEY] [-t <title>] [-m <desc>] [-e] [-a <who>] [-s <status>] [-l a,b] [-p <PARENT>]
                      edit fields; no flags opens a field menu
  bpr rm <KEY>... [-f] delete tickets (asks first)

Tickets:
  bpr ticket new [summary] [-t <title>] [-m <desc>] [-y <type>]
                      file a new ticket in the jira_project backlog
  bpr mar [branch] [-t <title>] [-m <desc>] [-f]
                      MAR ticket from the branch name (fix/header-x -> "Header x"),
                      labelled marketing, assigned to you, active sprint, In Progress
  bpr sub [KEY]       list the subtasks of a ticket
  bpr sub add [KEY] [summary] [-m <desc>]
                      add a subtask to a ticket
  bpr sub rm <KEY>... delete subtasks (asks first; -f to skip)
  bpr auth            store your Atlassian email + API token(s)
  bpr mcp             run the stdio MCP server for AI clients
  bpr help            this help

Jira goes through the twg CLI when it is installed (BPR_JIRA_BACKEND=token forces the API token).
Credentials: env (ATLASSIAN_EMAIL / ATLASSIAN_TOKEN) or ~/.dotfiles/bitbucket-auth
Settings:    ` + config.SettingsPath() + `
`)
}
