// Package config loads bpr credentials and non-secret settings.
//
// Credentials are a single Atlassian identity (email + API token) that
// authenticates BOTH the Bitbucket Cloud API and the Jira Cloud API. It stays
// backward-compatible with the old bash `bpr`, which stored BB_USER/BB_PASS in
// ~/.dotfiles/bitbucket-auth.
package config

import (
	"bufio"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/BurntSushi/toml"
)

// Creds is one Atlassian login used for both Bitbucket and Jira.
type Creds struct {
	Email string
	Token string
}

func (c Creds) OK() bool { return c.Email != "" && c.Token != "" }

// Settings holds the non-secret configuration written to config.toml.
type Settings struct {
	// JiraSite is the Atlassian base URL, e.g. https://acme.atlassian.net
	JiraSite string `toml:"jira_site"`
	// JiraProject is the project key used to scope "my issues", e.g. DCR.
	JiraProject string `toml:"jira_project"`
	// RepoSlug overrides the workspace/repo derived from the git origin remote.
	RepoSlug string `toml:"repo_slug"`
}

func Dir() string {
	base := os.Getenv("XDG_CONFIG_HOME")
	if base == "" {
		home, _ := os.UserHomeDir()
		base = filepath.Join(home, ".config")
	}
	return filepath.Join(base, "bpr")
}

func settingsPath() string { return filepath.Join(Dir(), "config.toml") }

func dataDir() string {
	if d := os.Getenv("DOTFILES_DATA_DIR"); d != "" {
		return d
	}
	home, _ := os.UserHomeDir()
	return filepath.Join(home, ".dotfiles")
}

// legacyAuthPath is the file the bash bpr wrote (BB_USER / BB_PASS).
func legacyAuthPath() string { return filepath.Join(dataDir(), "bitbucket-auth") }

// jiraAuthPath holds Jira credentials when they differ from Bitbucket's (a
// Bitbucket API token is not accepted by the Jira API).
func jiraAuthPath() string { return filepath.Join(dataDir(), "jira-auth") }

// LoadSettings reads config.toml (missing file -> zero value, not an error).
func LoadSettings() Settings {
	var s Settings
	_, _ = toml.DecodeFile(settingsPath(), &s)
	return s
}

// SaveSettings writes config.toml, creating the directory if needed.
func SaveSettings(s Settings) error {
	if err := os.MkdirAll(Dir(), 0o755); err != nil {
		return err
	}
	f, err := os.Create(settingsPath())
	if err != nil {
		return err
	}
	defer f.Close()
	if _, err := f.WriteString("# bpr settings — safe to edit by hand.\n"); err != nil {
		return err
	}
	return toml.NewEncoder(f).Encode(s)
}

var shellKV = regexp.MustCompile(`^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$`)

// parseShellEnv reads simple KEY="value" lines from a sourced shell file.
func parseShellEnv(path string) map[string]string {
	out := map[string]string{}
	f, err := os.Open(path)
	if err != nil {
		return out
	}
	defer f.Close()
	sc := bufio.NewScanner(f)
	for sc.Scan() {
		line := sc.Text()
		m := shellKV.FindStringSubmatch(line)
		if m == nil {
			continue
		}
		val := strings.TrimSpace(m[2])
		val = strings.TrimSuffix(strings.TrimPrefix(val, `"`), `"`)
		val = strings.TrimSuffix(strings.TrimPrefix(val, `'`), `'`)
		out[m[1]] = val
	}
	return out
}

// LoadCreds resolves credentials from, in order: environment, the legacy
// ~/.dotfiles/bitbucket-auth file. Returns ok=false when incomplete.
func LoadCreds() (Creds, bool) {
	email := firstEnv("ATLASSIAN_EMAIL", "BITBUCKET_USERNAME", "BITBUCKET_USER")
	token := firstEnv("ATLASSIAN_TOKEN", "ATLASSIAN_API_TOKEN", "BITBUCKET_APP_PASSWORD", "BITBUCKET_TOKEN")

	if email == "" || token == "" {
		kv := parseShellEnv(legacyAuthPath())
		if email == "" {
			email = firstNonEmpty(kv["BB_USER"], kv["BITBUCKET_USERNAME"])
		}
		if token == "" {
			token = firstNonEmpty(kv["BB_PASS"], kv["BITBUCKET_APP_PASSWORD"])
		}
	}
	c := Creds{Email: email, Token: token}
	return c, c.OK()
}

// SaveCreds writes credentials to the legacy auth file (chmod 600) so both the
// Go and bash tools keep working.
func SaveCreds(c Creds) error {
	if err := os.MkdirAll(dataDir(), 0o755); err != nil {
		return err
	}
	body := fmt.Sprintf("BB_USER=%q\nBB_PASS=%q\n", c.Email, c.Token)
	if err := os.WriteFile(legacyAuthPath(), []byte(body), 0o600); err != nil {
		return err
	}
	return os.Chmod(legacyAuthPath(), 0o600)
}

// LoadJiraCreds resolves Jira credentials, independent of Bitbucket's because a
// Bitbucket API token is not accepted by Jira. Order: env (JIRA_EMAIL /
// JIRA_TOKEN), the ~/.dotfiles/jira-auth file, then the Bitbucket creds as a
// fallback (works only when those are a full Atlassian API token). ok=false
// when nothing usable resolves.
func LoadJiraCreds(bb Creds) (Creds, bool) {
	email := firstEnv("JIRA_EMAIL", "ATLASSIAN_EMAIL")
	token := firstEnv("JIRA_TOKEN", "JIRA_API_TOKEN", "ATLASSIAN_TOKEN")

	if email == "" || token == "" {
		kv := parseShellEnv(jiraAuthPath())
		if email == "" {
			email = firstNonEmpty(kv["JIRA_EMAIL"], kv["JIRA_USER"])
		}
		if token == "" {
			token = firstNonEmpty(kv["JIRA_TOKEN"], kv["JIRA_API_TOKEN"])
		}
	}
	if email != "" && token != "" {
		return Creds{Email: email, Token: token}, true
	}
	return bb, bb.OK()
}

// SaveJiraCreds writes Jira credentials to ~/.dotfiles/jira-auth (chmod 600).
func SaveJiraCreds(c Creds) error {
	if err := os.MkdirAll(dataDir(), 0o755); err != nil {
		return err
	}
	body := fmt.Sprintf("JIRA_EMAIL=%q\nJIRA_TOKEN=%q\n", c.Email, c.Token)
	if err := os.WriteFile(jiraAuthPath(), []byte(body), 0o600); err != nil {
		return err
	}
	return os.Chmod(jiraAuthPath(), 0o600)
}

func firstEnv(keys ...string) string {
	for _, k := range keys {
		if v := strings.TrimSpace(os.Getenv(k)); v != "" {
			return v
		}
	}
	return ""
}

func firstNonEmpty(vals ...string) string {
	for _, v := range vals {
		if v != "" {
			return v
		}
	}
	return ""
}

// RepoSlug returns the workspace/repo slug: the config override if set, else
// derived from the git origin remote in dir.
func RepoSlug(dir string, s Settings) (string, error) {
	if s.RepoSlug != "" {
		return s.RepoSlug, nil
	}
	cmd := exec.Command("git", "remote", "get-url", "origin")
	if dir != "" {
		cmd.Dir = dir
	}
	out, err := cmd.Output()
	if err != nil {
		return "", fmt.Errorf("no 'origin' remote found (set repo_slug in %s)", settingsPath())
	}
	remote := strings.TrimSpace(string(out))
	if !strings.Contains(remote, "bitbucket.org") {
		return "", fmt.Errorf("origin is not a Bitbucket remote: %s", remote)
	}
	remote = strings.TrimSuffix(remote, ".git")
	// git@bitbucket.org:ws/repo  or  https://bitbucket.org/ws/repo
	i := strings.LastIndex(remote, "bitbucket.org")
	slug := remote[i+len("bitbucket.org"):]
	slug = strings.TrimLeft(slug, ":/")
	return slug, nil
}

// Workspace is the first path segment of a slug ("ws/repo" -> "ws").
func Workspace(slug string) string {
	if i := strings.IndexByte(slug, '/'); i >= 0 {
		return slug[:i]
	}
	return slug
}

// SettingsPath exposes the config file location for help text.
func SettingsPath() string { return settingsPath() }
