package main

import (
	"os/exec"
	"regexp"
	"strings"
	"unicode"
)

func git(dir string, args ...string) (string, error) {
	cmd := exec.Command("git", args...)
	if dir != "" {
		cmd.Dir = dir
	}
	out, err := cmd.CombinedOutput()
	return strings.TrimSpace(string(out)), err
}

func currentBranch(dir string) string {
	out, err := git(dir, "rev-parse", "--abbrev-ref", "HEAD")
	if err != nil {
		return ""
	}
	return out
}

func lastCommitSubject(dir string) string {
	out, err := git(dir, "log", "-1", "--pretty=%s")
	if err != nil {
		return ""
	}
	return out
}

// branchOnOrigin reports whether the branch exists on the origin remote.
func branchOnOrigin(dir, branch string) bool {
	_, err := git(dir, "ls-remote", "--exit-code", "--heads", "origin", branch)
	return err == nil
}

func pushBranch(dir, branch string) (string, error) {
	return git(dir, "push", "-u", "origin", branch)
}

func remoteBranches(dir string) []string {
	out, err := git(dir, "branch", "-r", "--format=%(refname:short)")
	if err != nil || out == "" {
		return nil
	}
	var names []string
	seen := map[string]bool{}
	for _, l := range strings.Split(out, "\n") {
		name := strings.TrimPrefix(strings.TrimSpace(l), "origin/")
		if name == "" || name == "HEAD" || seen[name] {
			continue
		}
		seen[name] = true
		names = append(names, name)
	}
	return names
}

var jiraKeyRe = regexp.MustCompile(`(?i)[A-Z]+-[0-9]{2,}`)

// branchTicket extracts a Jira-style key (e.g. DCR-3309) from a branch name.
func branchTicket(branch string) string {
	m := jiraKeyRe.FindString(branch)
	return strings.ToUpper(m)
}

func capitalize(s string) string {
	if s == "" {
		return s
	}
	runes := []rune(s)
	runes[0] = unicode.ToUpper(runes[0])
	return string(runes)
}

// defaultTitle builds "<TICKET>: <subject>", de-duplicating an existing prefix.
func defaultTitle(dir, branch string) string {
	subject := lastCommitSubject(dir)
	if subject == "" {
		subject = branch
	}
	ticket := branchTicket(branch)
	if ticket != "" && !strings.HasPrefix(strings.ToUpper(subject), ticket) {
		return ticket + ": " + capitalize(subject)
	}
	return subject
}

// slugify turns an issue summary into a branch-safe slug.
func slugify(s string) string {
	s = strings.ToLower(s)
	var b strings.Builder
	prevDash := false
	for _, r := range s {
		switch {
		case r >= 'a' && r <= 'z', r >= '0' && r <= '9':
			b.WriteRune(r)
			prevDash = false
		default:
			if !prevDash && b.Len() > 0 {
				b.WriteByte('-')
				prevDash = true
			}
		}
	}
	return strings.Trim(b.String(), "-")
}
