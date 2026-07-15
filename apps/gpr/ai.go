package main

import (
	"bytes"
	"fmt"
	"os/exec"
	"strings"
)

// aiBackends are the supported non-interactive AI CLIs, in cycle order.
var aiBackends = []string{"claude", "opencode", "codex"}

// buildAICommand returns the exec.Cmd used to send prompt to the given backend
// non-interactively, with full-auto/yolo permissions.
func buildAICommand(backend, prompt string) *exec.Cmd {
	switch backend {
	case "opencode":
		return exec.Command("opencode", "run", prompt)
	case "codex":
		return exec.Command("codex", "exec", "--yolo", prompt)
	default: // claude
		return exec.Command("claude", "-p", prompt, "--dangerously-skip-permissions")
	}
}

// runAI sends prompt to backend and returns its full stdout response.
func runAI(backend, prompt string) (string, error) {
	cmd := buildAICommand(backend, prompt)

	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	err := cmd.Run()
	if err != nil {
		return "", fmt.Errorf("%v: %s", err, stderr.String())
	}
	return strings.TrimSpace(stdout.String()), nil
}
