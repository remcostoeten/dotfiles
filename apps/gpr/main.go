package main

import (
	"fmt"
	"os"
	"os/exec"

	tea "github.com/charmbracelet/bubbletea"
)

func main() {
	if len(os.Args) > 1 {
		switch os.Args[1] {
		case "settings", "-s", "--settings":
			if err := runSettingsCLI(os.Args[2:]); err != nil {
				fmt.Fprintf(os.Stderr, "gpr: %v\n", err)
				os.Exit(1)
			}
			return
		case "help", "-h", "--help":
			fmt.Print(helpText)
			return
		default:
			fmt.Fprintf(os.Stderr, "gpr: unknown command %q\n\n%s", os.Args[1], helpText)
			os.Exit(1)
		}
	}

	// Verify that the 'gh' CLI is installed
	if _, err := exec.LookPath("gh"); err != nil {
		fmt.Fprintf(os.Stderr, "Error: 'gh' (GitHub CLI) is not installed or not in your PATH.\n")
		fmt.Fprintf(os.Stderr, "Please install it and log in using 'gh auth login' before using gpr.\n")
		os.Exit(1)
	}

	m := initialModel()
	p := tea.NewProgram(m, tea.WithAltScreen())
	if _, err := p.Run(); err != nil {
		fmt.Fprintf(os.Stderr, "Alas, there's been an error: %v\n", err)
		os.Exit(1)
	}
}

const helpText = `gpr: GitHub pull requests and issues for the current repo

Usage:
  gpr                          open the dashboard
  gpr settings                 show current settings
  gpr settings editor          pick your editor from a menu of installed ones
  gpr settings editor <exe>    set it directly, e.g. nvim, zed, code --wait
  gpr help                     show this help

  settings can also be written as -s or --settings, and editor as ide:
    gpr -s ide nvim
    gpr --settings editor zed

Writing issues in your editor:
  In the New Issue, New PR or Edit PR form press ctrl+e. The draft opens in your
  editor: the first line is the title, everything below it is the body.
  Save and close the file to return to gpr with the form filled in, then press
  enter to submit.
    terminal editors (nvim, vim, helix, nano)  quit with save, e.g. :wq
    GUI editors (code, zed, cursor, subl)      close the tab or window

Agent prompts:
  In an issue's detail view press p and pick a backend (claude, opencode, codex,
  gemini). It rewrites the issue into a structured prompt for a coding agent,
  once from the issue alone and once with context from the repository.
  Press 1 to copy the plain prompt, 2 to copy the one with repo context.
  Check the context version before using it, the agent can guess wrong.

  Without a setting gpr uses $VISUAL, then $EDITOR, then nvim, vim, nano or vi.
  Settings live in ~/.config/gpr/settings.json.
`
