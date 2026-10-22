package main

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
)

const agentPromptKeyPrefix = "agentprompt:"

var repoMarkerFiles = []string{
	"AGENTS.md", "CLAUDE.md", "GEMINI.md", "README.md", "CONTRIBUTING.md",
	"package.json", "bun.lock", "pnpm-lock.yaml", "go.mod", "Cargo.toml", "pyproject.toml",
	"Makefile", "justfile", "tsconfig.json", "oxlintrc.json", ".oxlintrc.json", "turbo.json",
}

// Matches the two prompt sections the generator is asked to emit.
var agentPromptSectionRe = regexp.MustCompile(`(?s)<<<(PLAIN|CONTEXT)>>>\s*(.*?)\s*<<<END (?:PLAIN|CONTEXT)>>>`)

func repoRoot() string {
	out, err := exec.Command("git", "rev-parse", "--show-toplevel").Output()
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(out))
}

func repoSnapshot(root string) string {
	entries, err := os.ReadDir(root)
	if err != nil {
		return ""
	}
	var names []string
	for _, e := range entries {
		if strings.HasPrefix(e.Name(), ".") && e.Name() != ".github" {
			continue
		}
		name := e.Name()
		if e.IsDir() {
			name += "/"
		}
		names = append(names, name)
	}
	sort.Strings(names)

	var markers []string
	for _, f := range repoMarkerFiles {
		if _, err := os.Stat(filepath.Join(root, f)); err == nil {
			markers = append(markers, f)
		}
	}

	var s strings.Builder
	fmt.Fprintf(&s, "Repository root: %s\n", root)
	fmt.Fprintf(&s, "Top-level entries: %s\n", strings.Join(names, ", "))
	if len(markers) > 0 {
		fmt.Fprintf(&s, "Notable files to read first: %s\n", strings.Join(markers, ", "))
	}
	return s.String()
}

func buildAgentPromptRequest(issue *GHIssueDetails) string {
	root := repoRoot()
	var s strings.Builder
	s.WriteString(`You write task prompts for autonomous coding agents (Claude Code, Codex, OpenCode, Gemini CLI).
Below is a GitHub issue. Issues are often written quickly: vague, misspelled, missing acceptance criteria.
Turn it into a clear, well-structured prompt an agent can execute to resolve the issue.

Rules for every prompt you write:
- Fix spelling and grammar, keep the author's intent, never invent requirements. Mark genuine ambiguities under "Open questions" instead of guessing.
- Use these markdown sections: Goal, Background, Requirements, Acceptance criteria, Out of scope, Open questions (omit empty sections).
- Address the agent directly in the imperative ("Implement...", "Add...").
- Mention the issue number so the agent can reference it in the commit.
- Do not modify any files yourself; you only write the prompts.

Produce exactly two prompts, each wrapped in its markers, with nothing else outside them:

<<<PLAIN>>>
(the prompt using only the issue's own content, no repository assumptions)
<<<END PLAIN>>>
`)
	if root != "" {
		s.WriteString(`<<<CONTEXT>>>
(the same prompt enriched with repository context: add a "Context" section naming the stack, the relevant files or directories, conventions from AGENTS.md or similar, and the commands to build, lint and test. Only include what you verified by reading the repository; say so when you could not find something.)
<<<END CONTEXT>>>

Explore the repository read-only to gather that context. Start from this snapshot:
`)
		s.WriteString(repoSnapshot(root))
	} else {
		s.WriteString("\nThere is no local repository checkout, so only write the PLAIN prompt.\n")
	}
	s.WriteString("\n--- Issue ---\n")
	s.WriteString(formatIssueDetailsForCopy(issue))
	return s.String()
}

func isAgentPromptThread(t *aiThread) bool {
	return t != nil && strings.HasPrefix(t.Key, agentPromptKeyPrefix)
}

func parseAgentPrompts(answer string) (plain, withContext string) {
	for _, match := range agentPromptSectionRe.FindAllStringSubmatch(answer, -1) {
		switch match[1] {
		case "PLAIN":
			plain = match[2]
		case "CONTEXT":
			withContext = match[2]
		}
	}
	return plain, withContext
}

func latestAgentPrompts(t *aiThread) (plain, withContext string) {
	for i := len(t.Turns) - 1; i >= 0; i-- {
		plain, withContext = parseAgentPrompts(t.Turns[i].Answer)
		if plain != "" || withContext != "" {
			return plain, withContext
		}
	}
	return "", ""
}

func renderAgentPromptsMarkdown(plain, withContext string) string {
	var s strings.Builder
	if plain != "" {
		s.WriteString("## [1] Prompt without context\n\n" + plain + "\n\n---\n\n")
	}
	if withContext != "" {
		s.WriteString("## [2] Prompt with repo context\n\n_Check the context section, the agent may have guessed wrong._\n\n" + withContext + "\n")
	}
	return s.String()
}
