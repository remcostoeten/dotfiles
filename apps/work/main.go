package main

import (
	"fmt"
	"os"
	"os/exec"
	"strings"
)

func findService(p *Project, name string) *Service {
	for i := range p.Services {
		if p.Services[i].Name == name {
			return &p.Services[i]
		}
	}
	return nil
}

func findCommand(p *Project, name string) *Command {
	for i := range p.Commands {
		if p.Commands[i].Name == name {
			return &p.Commands[i]
		}
	}
	return nil
}

func startNamed(p *Project, dir, name string) {
	s := findService(p, name)
	if s == nil {
		fmt.Printf("no service %q in project %s\n", name, p.Name)
		return
	}
	fmt.Printf("Starting %s…\n", s.Label)
	out, err := startService(dir, *s)
	if out != "" {
		fmt.Println(out)
	}
	if err != nil {
		fmt.Println("error:", err)
	}
}

// runInteractive runs an external command attached to the terminal.
func runInteractive(dir, name string, args ...string) {
	cmd := exec.Command(name, args...)
	cmd.Dir = dir
	cmd.Stdin, cmd.Stdout, cmd.Stderr = os.Stdin, os.Stdout, os.Stderr
	_ = cmd.Run()
}

func jiraTicketURL(p *Project, branch string) string {
	if key := jiraKey(branch); key != "" && p.JiraBrowse != "" {
		return strings.TrimSuffix(p.JiraBrowse, "/") + "/" + key
	}
	return p.JiraBoard
}

func cliHelp() {
	fmt.Print(`work — dev launcher

  work                      open the interactive TUI
  work -a   --all           start all services
  work -rjl --regeljelease  start Regeljelease
  work -vdw --vanderwall    start Van der Wal Vans
  work -s   --studio        start the Sanity studio
  work -j   --jira          open the Jira ticket for the current branch (board fallback)
  work -b   --bitbucket     open the repo on Bitbucket
  work -g   --git           alias of --bitbucket
  work -v   --vim           open the repo in nvim
  work -i   --ide           open the repo in your IDE (cursor/code/…)
  work -e   --explorer      open the repo in the file manager
  work run [name]           run a configured command (no name = list them)
  work -h   --help          this help

Env:
  WORK_ROOT           base dir for repos; overrides config 'root'
  WORK_TRACK_RELOADS  0/1 — toggle the live-reload event subscriber

Config: ` + configPath() + `
`)
}

// runCLI handles non-interactive args; returns true if it handled the request.
func runCLI(cfg *Config, p *Project, args []string) bool {
	dir := p.ResolvedPath()

	if len(args) > 0 && args[0] == "preview" {
		previewTUI(cfg, p)
		return true
	}

	if len(args) > 0 && args[0] == "urls" {
		branch := gitBranch(dir)
		web := bitbucketWeb(dir, p.RepoURL)
		fmt.Printf("project    %s\n", p.Name)
		fmt.Printf("path       %s\n", dir)
		fmt.Printf("branch     %s  (jira key: %s)\n", branch, jiraKey(branch))
		fmt.Printf("jira tkt   %s\n", jiraTicketURL(p, branch))
		fmt.Printf("jira board %s\n", p.JiraBoard)
		fmt.Printf("bitbucket  %s\n", web)
		fmt.Printf("pr (new)   %s\n", bitbucketPRNew(web, branch))
		return true
	}

	if len(args) > 0 && args[0] == "run" {
		if len(args) == 1 {
			fmt.Println("commands:")
			for _, c := range p.Commands {
				fmt.Printf("  %-18s %s\n", c.Name, c.Label)
			}
			return true
		}
		c := findCommand(p, args[1])
		if c == nil {
			fmt.Printf("no command %q (try `work run`)\n", args[1])
			return true
		}
		fmt.Printf("▶ %s\n  %s\n", c.Label, c.Run)
		runInteractive(dir, "sh", "-c", c.Run)
		return true
	}

	handled := false
	for _, a := range args {
		switch a {
		case "-a", "--all":
			for i := range p.Services {
				startNamed(p, dir, p.Services[i].Name)
			}
			handled = true
		case "-rjl", "--regeljelease":
			startNamed(p, dir, "regeljelease")
			handled = true
		case "-vdw", "--vanderwall", "--vanderwalvans":
			startNamed(p, dir, "vanderwalvans")
			handled = true
		case "-s", "--studio":
			startNamed(p, dir, "studio")
			handled = true
		case "-j", "--jira":
			fmt.Println(openURL(jiraTicketURL(p, gitBranch(dir))))
			handled = true
		case "-b", "--bitbucket", "-g", "--git":
			fmt.Println(openURL(bitbucketWeb(dir, p.RepoURL)))
			handled = true
		case "-v", "--vim":
			ed := firstCmd("nvim", "vim", "vi")
			if ed == "" {
				fmt.Println("no editor (nvim/vim/vi) found")
			} else {
				runInteractive(dir, ed, dir)
			}
			handled = true
		case "-i", "--ide":
			ide := firstCmd("cursor", "code", "codium", "zed")
			if ide == "" {
				fmt.Println("no IDE (cursor/code/codium/zed) found")
			} else {
				_ = exec.Command(ide, dir).Start()
			}
			handled = true
		case "-e", "--explorer":
			fmt.Println(openURL(dir))
			handled = true
		case "-h", "--help":
			cliHelp()
			handled = true
		default:
			fmt.Printf("unknown option: %s (try -h)\n", a)
			os.Exit(1)
		}
	}
	return handled
}

func main() {
	cfg, cfgPath, err := LoadConfig()
	if err != nil {
		fmt.Fprintln(os.Stderr, "config error:", err)
		os.Exit(1)
	}
	p := cfg.CurrentProject()
	if p == nil {
		fmt.Fprintln(os.Stderr, "no projects configured in", cfgPath)
		os.Exit(1)
	}

	args := os.Args[1:]
	if len(args) == 0 {
		runTUI(cfg, p)
		return
	}
	if !runCLI(cfg, p, args) {
		runTUI(cfg, p)
	}
}
