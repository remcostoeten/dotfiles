package main

import (
	"os"
	"path/filepath"
	"testing"
)

func TestTrackReloadsEnabled(t *testing.T) {
	yes, no := true, false
	cases := []struct {
		env  string // "" = unset
		cfg  *bool
		want bool
	}{
		{"", nil, true},     // default on
		{"", &no, false},    // config off
		{"", &yes, true},    // config on
		{"0", &yes, false},  // env overrides config
		{"false", nil, false},
		{"off", &yes, false},
		{"1", &no, true},    // env overrides config
		{"yes", nil, true},
		{"garbage", &no, false}, // unrecognized -> fall back to config
		{"garbage", nil, true},  // unrecognized, no config -> default
	}
	for _, c := range cases {
		if c.env == "" {
			os.Unsetenv("WORK_TRACK_RELOADS")
		} else {
			os.Setenv("WORK_TRACK_RELOADS", c.env)
		}
		cfg := &Config{TrackReloads: c.cfg}
		if got := cfg.TrackReloadsEnabled(); got != c.want {
			t.Errorf("env=%q cfg=%v: got %v, want %v", c.env, c.cfg, got, c.want)
		}
	}
	os.Unsetenv("WORK_TRACK_RELOADS")
}

func TestRootOverridePersistence(t *testing.T) {
	cfgHome := t.TempDir()
	t.Setenv("XDG_CONFIG_HOME", cfgHome)
	os.Unsetenv("WORK_ROOT")
	defer func() { projectRoot = "" }()

	// save -> load round-trips
	if err := saveRootOverride("~/elsewhere/dev"); err != nil {
		t.Fatal(err)
	}
	if got := loadOverrides().Root; got != "~/elsewhere/dev" {
		t.Fatalf("loadOverrides root = %q, want %q", got, "~/elsewhere/dev")
	}

	cfg := &Config{Root: "~/configroot"}

	// override beats config.toml root
	resolveProjectRoot(cfg)
	if want := expandPath("~/elsewhere/dev"); projectRoot != want {
		t.Errorf("override precedence: projectRoot = %q, want %q", projectRoot, want)
	}

	// $WORK_ROOT beats the override
	t.Setenv("WORK_ROOT", "/env/root")
	resolveProjectRoot(cfg)
	if projectRoot != "/env/root" {
		t.Errorf("env precedence: projectRoot = %q, want /env/root", projectRoot)
	}
	os.Unsetenv("WORK_ROOT")

	// empty clears the file and falls back to config.toml root
	if err := saveRootOverride(""); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(overridesPath()); !os.IsNotExist(err) {
		t.Errorf("overrides file should have been removed")
	}
	resolveProjectRoot(cfg)
	if want := expandPath("~/configroot"); projectRoot != want {
		t.Errorf("config fallback: projectRoot = %q, want %q", projectRoot, want)
	}
}

func TestResolvedPathWorkRoot(t *testing.T) {
	// A project whose literal path doesn't exist should resolve under the root
	// when "<root>/<basename>" exists.
	root := t.TempDir()
	if err := os.MkdirAll(filepath.Join(root, "website-2022"), 0o755); err != nil {
		t.Fatal(err)
	}
	old := projectRoot
	projectRoot = root
	defer func() { projectRoot = old }()

	p := Project{Path: "/nonexistent/dev/website-2022"}
	want := filepath.Join(root, "website-2022")
	if got := p.ResolvedPath(); got != want {
		t.Errorf("ResolvedPath() = %q, want %q", got, want)
	}

	// With no root, it falls back to the literal path.
	projectRoot = ""
	if got := p.ResolvedPath(); got != p.Path {
		t.Errorf("fallback ResolvedPath() = %q, want %q", got, p.Path)
	}
}
