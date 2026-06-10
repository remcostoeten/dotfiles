package main

import (
	"bytes"
	"os"
	"path/filepath"
	"strings"

	"github.com/BurntSushi/toml"
)

// Service is one startable docker-compose unit shown in the launcher.
type Service struct {
	Name     string   `toml:"name"`
	Label    string   `toml:"label"`
	Profile  string   `toml:"profile"`  // compose profile to enable
	Services []string `toml:"services"` // compose service names that make it up
	URL      string   `toml:"url"`      // opened with 'o'
	// ReloadPort is the live-reload SSE port (0 = none). When set, the TUI shows
	// a "live" badge only while that port is actually accepting connections.
	ReloadPort int `toml:"reload_port"`
}

// Command is an arbitrary shell command (often a docker exec) runnable from the TUI.
type Command struct {
	Name  string `toml:"name"`
	Label string `toml:"label"`
	Run   string `toml:"run"` // executed via `sh -c` in the project dir
}

// Project bundles a repo path with its services, commands and external links.
type Project struct {
	Name       string    `toml:"name"`
	Path       string    `toml:"path"`
	AltPaths   []string  `toml:"alt_paths"`
	JiraBoard  string    `toml:"jira_board"`
	JiraBrowse string    `toml:"jira_browse"` // base url; key from branch is appended
	RepoURL    string    `toml:"repo_url"`    // override; else derived from git remote
	Services   []Service `toml:"service"`
	Commands   []Command `toml:"command"`
}

type Config struct {
	// Root relocates where repos live without editing each project path: a
	// project at path ".../<dir>" is also looked for under "<root>/<dir>".
	// The $WORK_ROOT env var overrides this (handy for binary-only sharing).
	Root string `toml:"root"`
	// TrackReloads enables the SSE reload-event subscriber (count / last-seen
	// badge). Nil = default on; $WORK_TRACK_RELOADS overrides. Turn off to avoid
	// the persistent connections it holds open.
	TrackReloads *bool     `toml:"track_reloads"`
	Projects     []Project `toml:"project"`
}

// projectRoot is the resolved base dir used to relocate project paths; set by
// LoadConfig from $WORK_ROOT (preferred) or the config's `root`. "" = none.
var projectRoot string

// expandPath expands a leading ~ and any $VAR / ${VAR} environment references.
func expandPath(p string) string {
	p = os.ExpandEnv(p)
	if p == "~" || strings.HasPrefix(p, "~/") {
		if home, err := os.UserHomeDir(); err == nil {
			return filepath.Join(home, strings.TrimPrefix(p, "~"))
		}
	}
	return p
}

// candidates lists the dirs to try for a project, most-specific first. When a
// project root is configured, "<root>/<dir>" is tried before the literal path,
// so a colleague can point all projects at their own dev folder in one place.
func (p Project) candidates() []string {
	var c []string
	if projectRoot != "" {
		c = append(c, filepath.Join(projectRoot, filepath.Base(expandPath(p.Path))))
	}
	return append(append(c, p.Path), p.AltPaths...)
}

// ResolvedPath returns the first existing candidate dir, else the literal path.
func (p Project) ResolvedPath() string {
	for _, cand := range p.candidates() {
		c := expandPath(cand)
		if st, err := os.Stat(c); err == nil && st.IsDir() {
			return c
		}
	}
	return expandPath(p.Path)
}

// TrackReloadsEnabled reports whether to run the SSE reload subscribers.
// $WORK_TRACK_RELOADS (1/0, true/false, on/off, yes/no) wins; else the config
// value; else true.
func (c *Config) TrackReloadsEnabled() bool {
	switch strings.ToLower(strings.TrimSpace(os.Getenv("WORK_TRACK_RELOADS"))) {
	case "0", "false", "off", "no":
		return false
	case "1", "true", "on", "yes":
		return true
	}
	if c.TrackReloads != nil {
		return *c.TrackReloads
	}
	return true
}

func configDir() string {
	base := os.Getenv("XDG_CONFIG_HOME")
	if base == "" {
		home, _ := os.UserHomeDir()
		base = filepath.Join(home, ".config")
	}
	return filepath.Join(base, "work")
}

func configPath() string    { return filepath.Join(configDir(), "config.toml") }
func overridesPath() string { return filepath.Join(configDir(), "overrides.toml") }

// Overrides holds machine-written settings (set from inside the app) that layer
// on top of config.toml, so the hand-written, commented config stays untouched.
type Overrides struct {
	Root string `toml:"root"` // base dir for repos; set via the in-app "set base path"
}

func loadOverrides() Overrides {
	var o Overrides
	_, _ = toml.DecodeFile(overridesPath(), &o) // missing/invalid file -> zero value
	return o
}

// saveRootOverride persists (or clears, when root is empty) the base-path
// override to overrides.toml.
func saveRootOverride(root string) error {
	path := overridesPath()
	if strings.TrimSpace(root) == "" {
		if err := os.Remove(path); err != nil && !os.IsNotExist(err) {
			return err
		}
		return nil
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	var buf bytes.Buffer
	buf.WriteString("# Written by `work` (set base path). Layered over config.toml; safe to delete.\n")
	if err := toml.NewEncoder(&buf).Encode(Overrides{Root: root}); err != nil {
		return err
	}
	return os.WriteFile(path, buf.Bytes(), 0o644)
}

// resolveProjectRoot sets the package-level projectRoot from the highest-priority
// source available: $WORK_ROOT, then the in-app override, then config.toml.
func resolveProjectRoot(cfg *Config) {
	switch {
	case os.Getenv("WORK_ROOT") != "":
		projectRoot = expandPath(os.Getenv("WORK_ROOT"))
	case loadOverrides().Root != "":
		projectRoot = expandPath(loadOverrides().Root)
	default:
		projectRoot = expandPath(cfg.Root)
	}
}

// LoadConfig reads the config, writing a default file on first run.
func LoadConfig() (*Config, string, error) {
	path := configPath()
	if _, err := os.Stat(path); os.IsNotExist(err) {
		if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
			return nil, path, err
		}
		if err := os.WriteFile(path, []byte(defaultConfigTOML), 0o644); err != nil {
			return nil, path, err
		}
	}
	var cfg Config
	if _, err := toml.DecodeFile(path, &cfg); err != nil {
		return nil, path, err
	}
	resolveProjectRoot(&cfg)
	return &cfg, path, nil
}

// CurrentProject picks the project whose path contains cwd, else the first.
func (c *Config) CurrentProject() *Project {
	cwd, _ := os.Getwd()
	cwd, _ = filepath.Abs(cwd)
	for i := range c.Projects {
		for _, cand := range c.Projects[i].candidates() {
			base := expandPath(cand)
			if cwd == base || strings.HasPrefix(cwd, base+string(os.PathSeparator)) {
				return &c.Projects[i]
			}
		}
	}
	if len(c.Projects) > 0 {
		return &c.Projects[0]
	}
	return nil
}

const defaultConfigTOML = `# work — dev launcher config
#
# Add more [[project]] blocks for other repos. The tool auto-selects the
# project whose path (or alt_paths) contains your current directory, and
# otherwise falls back to the first project below.

# Where your repos live. A project at path ".../<dir>" is also looked for under
# "<root>/<dir>", so colleagues who cloned elsewhere only set this once instead
# of editing every path. The $WORK_ROOT env var overrides it:
#   WORK_ROOT=~/code work
# root = "~/dev"

# Live-reload tracking: the SSE subscriber that powers the "⟳ live · N · Xs"
# badge holds a connection open per reload_port. Set false (or env
# WORK_TRACK_RELOADS=0) to disable it; the cheap live/off check still works.
# track_reloads = true

[[project]]
name = "website-2022"
path = "~/dev/website-2022"
alt_paths = ["~/dev/website2022"]

# Jira: the issue key parsed from your branch (e.g. DCR-3061) is appended to
# jira_browse to open the ticket; jira_board is the fallback / board view.
# >>> EDIT THESE to your real Jira URLs <<<
jira_board  = "https://concreetgeregeld.atlassian.net/jira/software/projects/DCR/boards/8"
jira_browse = "https://concreetgeregeld.atlassian.net/browse/"

# repo_url is auto-derived from the git remote (Bitbucket); set to override.
repo_url = ""

  [[project.service]]
  name     = "regeljelease"
  label    = "Regeljelease"
  profile  = "regeljelease"
  services = ["regeljelease-php", "regeljelease-js", "regeljelease-sanity"]
  url      = "http://localhost:8001"
  # Live-reload SSE port (build.mjs --watch). Shown as a badge only when active.
  reload_port = 8071

  [[project.service]]
  name     = "vanderwalvans"
  label    = "Van der Wal Vans"
  profile  = "vanderwalvans"
  services = ["vanderwalvans-php", "vanderwalvans-js", "vanderwalvans-sanity"]
  url      = "http://localhost:8002"
  reload_port = 8072

  [[project.service]]
  name     = "studio"
  label    = "Sanity Studio"
  profile  = "regeljelease"
  services = ["regeljelease-sanity"]
  url      = "http://localhost:8061"

  [[project.command]]
  name  = "cache:clear"
  label = "Symfony cache:clear (regeljelease)"
  run   = "docker exec website-2022-regeljelease-php-1 sh -c 'cd /app && php bin/console cache:clear'"

  [[project.command]]
  name  = "composer:install"
  label = "composer install (regeljelease)"
  run   = "docker compose run --rm regeljelease-php composer install"

  [[project.command]]
  name  = "npm:install"
  label = "npm install (regeljelease-js)"
  run   = "docker compose run --rm regeljelease-js npm install"

  [[project.command]]
  name  = "php:lint"
  label = "composer lint (regeljelease)"
  run   = "docker exec website-2022-regeljelease-php-1 sh -c 'cd /app && composer lint'"
`
