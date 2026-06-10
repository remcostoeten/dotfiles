package main

import (
	"os/exec"
	"regexp"
	"strings"
)

// sh runs a command in dir and returns trimmed combined output.
func sh(dir, name string, args ...string) (string, error) {
	cmd := exec.Command(name, args...)
	if dir != "" {
		cmd.Dir = dir
	}
	out, err := cmd.CombinedOutput()
	return strings.TrimSpace(string(out)), err
}

// shell runs a shell string via `sh -c` in dir.
func shell(dir, command string) (string, error) {
	cmd := exec.Command("sh", "-c", command)
	if dir != "" {
		cmd.Dir = dir
	}
	out, err := cmd.CombinedOutput()
	return strings.TrimSpace(string(out)), err
}

func gitBranch(dir string) string {
	out, err := sh(dir, "git", "rev-parse", "--abbrev-ref", "HEAD")
	if err != nil {
		return ""
	}
	return out
}

// gitDirty returns the number of changed (incl. untracked) entries.
func gitDirty(dir string) int {
	out, err := sh(dir, "git", "status", "--porcelain")
	if err != nil || out == "" {
		return 0
	}
	return len(strings.Split(out, "\n"))
}

// gitStatusFiles returns porcelain status lines (e.g. " M path", "?? path").
func gitStatusFiles(dir string) []string {
	out, err := sh(dir, "git", "status", "--porcelain")
	if err != nil || out == "" {
		return nil
	}
	return strings.Split(out, "\n")
}

func gitBranches(dir string) []string {
	out, err := sh(dir, "git", "for-each-ref", "--sort=-committerdate",
		"--format=%(refname:short)", "refs/heads")
	if err != nil || out == "" {
		return nil
	}
	return strings.Split(out, "\n")
}

// gitAheadBehind returns (ahead, behind) relative to upstream, or (0,0).
func gitAheadBehind(dir string) (int, int) {
	out, err := sh(dir, "git", "rev-list", "--left-right", "--count", "@{upstream}...HEAD")
	if err != nil {
		return 0, 0
	}
	f := strings.Fields(out)
	if len(f) != 2 {
		return 0, 0
	}
	behind := atoiSafe(f[0])
	ahead := atoiSafe(f[1])
	return ahead, behind
}

func atoiSafe(s string) int {
	n := 0
	for _, r := range s {
		if r < '0' || r > '9' {
			return n
		}
		n = n*10 + int(r-'0')
	}
	return n
}

var jiraKeyRe = regexp.MustCompile(`^([A-Z][A-Z0-9]+-[0-9]+)`)

// jiraKey extracts an issue key like DCR-3061 from a branch name.
func jiraKey(branch string) string {
	m := jiraKeyRe.FindStringSubmatch(branch)
	if len(m) > 1 {
		return m[1]
	}
	return ""
}

// bitbucketWeb converts the origin remote to an https web url.
func bitbucketWeb(dir, override string) string {
	if override != "" {
		return strings.TrimSuffix(override, "/")
	}
	remote, err := sh(dir, "git", "remote", "get-url", "origin")
	if err != nil || remote == "" {
		return ""
	}
	remote = strings.TrimSuffix(remote, ".git")
	// git@bitbucket.org:workspace/repo  ->  https://bitbucket.org/workspace/repo
	if strings.HasPrefix(remote, "git@") {
		remote = strings.TrimPrefix(remote, "git@")
		remote = strings.Replace(remote, ":", "/", 1)
		return "https://" + remote
	}
	// ssh://git@host/path or https://host/path
	remote = strings.TrimPrefix(remote, "ssh://")
	if strings.HasPrefix(remote, "git@") {
		remote = strings.Replace(strings.TrimPrefix(remote, "git@"), ":", "/", 1)
		return "https://" + remote
	}
	return remote
}

// bitbucketPRNew returns the "create pull request" url for a branch.
func bitbucketPRNew(web, branch string) string {
	if web == "" {
		return ""
	}
	return web + "/pull-requests/new?source=" + branch + "&t=1"
}

// --- mutating git actions (return combined output for the status line) ---

func gitCheckout(dir, branch string) (string, error) {
	return sh(dir, "git", "checkout", branch)
}

func gitCreateBranch(dir, branch string) (string, error) {
	return sh(dir, "git", "checkout", "-b", branch)
}

func gitStash(dir string) (string, error) {
	return sh(dir, "git", "stash", "push", "-u")
}

func gitStashPop(dir string) (string, error) {
	return sh(dir, "git", "stash", "pop")
}

func gitPull(dir string) (string, error) {
	return sh(dir, "git", "pull", "--ff-only")
}

func gitCommitAll(dir, msg string) (string, error) {
	if _, err := sh(dir, "git", "add", "-A"); err != nil {
		return "", err
	}
	return sh(dir, "git", "commit", "-m", msg)
}

func gitPush(dir, branch string) (string, error) {
	return sh(dir, "git", "push", "-u", "origin", branch)
}
