package main

import (
	"os"
	"strings"
	"testing"
)

const fakeSetup = `#!/bin/bash
helper() {
    echo helper
}

set_default_terminal() {
    helper "$1"
}

install_category() {
    local category="$1"
    case "$category" in
        essential)
            install_apt "git"
            install_apt "python3-venv"
            setup_config_symlinks
            ;;
        langs|languages)
            install_curl "https://bun.sh/install" "bun" "bash"
            install_curl "https://sh.rustup.rs" "rustup" "bash" "-y"
            install_npm "@google/gemini-cli" "gemini"
            ;;
        terminals)
            install_ghostty
            set_default_terminal ghostty
            install_curl "https://sh.rustup.rs" "rustup" "bash" "-y"
            ;;
        media)
            install_snap "spotify" "Spotify" "--classic"
            mystery_call
            ;;
        *)
            log_error "Unknown category: $category"
            ;;
    esac
}
`

const fakeLib = `install_ghostty() {
    :
}
setup_config_symlinks() {
    :
}
`

func TestParseSetupScript(t *testing.T) {
	imp := parseSetupScript(fakeSetup, fakeLib, "setup", PackagesEnv{PackageManager: "apt", OSFamily: "debian"})

	ids := map[string]PackageEntry{}
	for _, e := range imp.entries {
		ids[e.ID] = e
	}
	for _, want := range []string{"git", "python3-venv", "setup-config-symlinks", "bun", "rustup", "gemini", "ghostty", "set-default-terminal-ghostty", "spotify"} {
		if _, ok := ids[want]; !ok {
			t.Errorf("missing entry %q; got %v", want, keys(ids))
		}
	}
	if len(imp.categories) != 4 || imp.categories[1].ID != "langs" {
		t.Errorf("categories = %+v", imp.categories)
	}

	git := ids["git"]
	if len(git.Sources) != 2 || git.Sources[0].Method != "pacman" || git.Sources[1].Method != "apt" {
		t.Errorf("git sources = %+v", git.Sources)
	}
	if venv := ids["python3-venv"]; len(venv.Sources) != 1 || venv.Sources[0].Method != "apt" {
		t.Errorf("python3-venv should skip pacman: %+v", venv.Sources)
	}
	if r := ids["rustup"]; r.Category != "langs" || r.Sources[0].Args != "-y" || r.Sources[0].Shell != "bash" {
		t.Errorf("rustup = %+v", r)
	}
	if g := ids["gemini"]; g.Sources[0].Package != "@google/gemini-cli" || g.Checks[0] != "gemini" {
		t.Errorf("gemini = %+v", g)
	}
	if s := ids["spotify"]; s.Sources[0].Args != "--classic" || s.Name != "Spotify" {
		t.Errorf("spotify = %+v", s)
	}

	term := ids["set-default-terminal-ghostty"].Sources[0].Script
	for _, want := range []string{"helper() {", "set_default_terminal() {", "set_default_terminal 'ghostty'", `source "$SCRIPT_DIR/lib/installers.sh"`} {
		if !strings.Contains(term, want) {
			t.Errorf("terminal script missing %q:\n%s", want, term)
		}
	}
	if strings.Index(term, "helper() {") > strings.Index(term, "set_default_terminal() {") {
		t.Errorf("dependencies must be defined before callers:\n%s", term)
	}

	joined := strings.Join(imp.notes, "\n")
	if !strings.Contains(joined, "mystery_call") || !strings.Contains(joined, "rustup appears in more than one category") {
		t.Errorf("notes = %v", imp.notes)
	}
}

func TestMergeImportKeepsExisting(t *testing.T) {
	current := emptyManifest()
	current.Packages = []PackageEntry{{ID: "git", Name: "my git", Category: "mine", Sources: []PackageSource{{Method: "shell", Script: "true"}}}}
	normalizeManifest(&current)
	imp := parseSetupScript(fakeSetup, fakeLib, "setup", PackagesEnv{PackageManager: "apt"})
	res := mergeImport(current, imp)
	if res.Manifest.Packages[0].Name != "my git" {
		t.Errorf("existing entry overwritten: %+v", res.Manifest.Packages[0])
	}
	if len(res.Skipped) != 1 || res.Skipped[0] != "git" {
		t.Errorf("skipped = %v", res.Skipped)
	}
	if err := validateManifest(res.Manifest); err != nil {
		t.Errorf("merged manifest invalid: %v", err)
	}
}

func TestImportRealSetupScript(t *testing.T) {
	src, err := os.ReadFile("../../setup/setup.sh")
	if err != nil {
		t.Skip("workspace setup.sh not present")
	}
	lib := ""
	for _, name := range libSources {
		data, _ := os.ReadFile("../../setup/lib/" + name + ".sh")
		lib += string(data)
	}
	imp := parseSetupScript(string(src), lib, "setup", PackagesEnv{PackageManager: "apt", OSFamily: "debian"})
	if len(imp.entries) < 30 {
		t.Errorf("expected the real setup.sh to yield 30+ entries, got %d", len(imp.entries))
	}
	m := emptyManifest()
	m.Categories, m.Packages = imp.categories, imp.entries
	normalizeManifest(&m)
	if err := validateManifest(m); err != nil {
		t.Errorf("imported manifest invalid: %v", err)
	}
	for _, e := range imp.entries {
		for _, s := range e.Sources {
			if s.Method == "shell" {
				if out, err := runQuiet("bash", "-n", "-c", s.Script); err != nil {
					t.Errorf("%s script does not parse: %s", e.ID, out)
				}
			}
		}
	}
}

func keys(m map[string]PackageEntry) []string {
	out := []string{}
	for k := range m {
		out = append(out, k)
	}
	return out
}

func TestInstallAllDrivesDefaults(t *testing.T) {
	src := fakeSetup + `
install_all() {
    install_category "essential"
    install_category "langs"
}
`
	imp := parseSetupScript(src, fakeLib, "setup", PackagesEnv{PackageManager: "apt"})
	for _, e := range imp.entries {
		want := e.Category != "essential" && e.Category != "langs"
		if e.Disabled != want {
			t.Errorf("%s (%s) disabled=%v, want %v", e.ID, e.Category, e.Disabled, want)
		}
	}
	for _, n := range imp.notes {
		if strings.Contains(n, "*)") {
			t.Errorf("wildcard arm leaked into notes: %q", n)
		}
	}
}
