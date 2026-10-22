package todo

import (
	"bytes"
	"errors"
	"os"
	"os/exec"
	"regexp"
	"strings"
)

var ansi = regexp.MustCompile(`\x1b\[[0-9;?]*[A-Za-z]`)

// CLI runs the Bun `todo` command for every mutation it owns.
type CLI struct {
	Bin string
}

// NewCLI resolves the binary from $TODO_BIN, falling back to `todo` on PATH.
func NewCLI() *CLI {
	bin := os.Getenv("TODO_BIN")
	if bin == "" {
		bin = "todo"
	}
	return &CLI{Bin: bin}
}

// Run executes one subcommand without a terminal attached, so the CLI never
// opens a prompt, and returns its last output line with colour stripped.
func (c *CLI) Run(args ...string) (string, error) {
	out, err := c.RunAll(args...)
	return lastLine(out), err
}

// RunAll is Run with every output line kept, for callers that read results
// such as the ids of freshly added tasks.
func (c *CLI) RunAll(args ...string) (string, error) {
	cmd := exec.Command(c.Bin, args...)
	cmd.Env = append(os.Environ(), "NO_COLOR=1")
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	err := cmd.Run()
	out := strings.TrimSpace(ansi.ReplaceAllString(stdout.String(), ""))
	if err != nil {
		if msg := firstLine(stderr.String()); msg != "" {
			return out, errors.New(msg)
		}
		if out != "" {
			return "", errors.New(lastLine(out))
		}
		return "", err
	}
	return out, nil
}

// AddedIDs reads the task ids out of "Added task 12: …" lines.
func AddedIDs(out string) []string {
	var ids []string
	for _, match := range addedLine.FindAllStringSubmatch(out, -1) {
		ids = append(ids, match[1])
	}
	return ids
}

var addedLine = regexp.MustCompile(`(?m)^Added (?:task|epic) (\d+)`)

func firstLine(s string) string {
	return strings.TrimSpace(strings.Split(strings.TrimSpace(ansi.ReplaceAllString(s, "")), "\n")[0])
}

func lastLine(s string) string {
	lines := strings.Split(strings.TrimSpace(ansi.ReplaceAllString(s, "")), "\n")
	return strings.TrimSpace(lines[len(lines)-1])
}
