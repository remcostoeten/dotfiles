package main

import (
	"fmt"
	"os"
	"os/exec"

	tea "github.com/charmbracelet/bubbletea"
)

func main() {
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
