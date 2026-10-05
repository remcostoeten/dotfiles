package tui_test

import (
	"encoding/json"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

const module = "pc"

type pkg struct {
	ImportPath  string
	Dir         string
	Imports     []string
	TestGoFiles []string
	GoFiles     []string
}

// packages lists every package in the module with its imports. The boundaries
// in the architecture are import rules, so this is the only honest way to
// assert them: read what the compiler sees.
func packages(t *testing.T) []pkg {
	t.Helper()

	cmd := exec.Command("go", "list", "-json", "./...")
	cmd.Dir = repoRoot(t)
	out, err := cmd.Output()
	if err != nil {
		t.Fatalf("go list: %v", err)
	}

	var pkgs []pkg
	decoder := json.NewDecoder(strings.NewReader(string(out)))
	for {
		var p pkg
		switch err := decoder.Decode(&p); err {
		case nil:
			pkgs = append(pkgs, p)
		case io.EOF:
			return pkgs
		default:
			t.Fatalf("decoding go list output: %v", err)
		}
	}
}

func repoRoot(t *testing.T) string {
	t.Helper()
	wd, err := os.Getwd()
	if err != nil {
		t.Fatalf("getwd: %v", err)
	}
	return filepath.Join(wd, "..", "..")
}

// TestFrameworkNeverDependsOnDomain is the one rule that matters. Everything
// else follows from Go's own refusal to compile an import cycle.
func TestFrameworkNeverDependsOnDomain(t *testing.T) {
	for _, p := range packages(t) {
		if !strings.HasPrefix(p.ImportPath, module+"/internal/tui/") {
			continue
		}
		for _, imported := range p.Imports {
			if strings.HasPrefix(imported, module+"/internal/modules") {
				t.Errorf("%s imports %s — the shell must never depend on a domain module", p.ImportPath, imported)
			}
		}
	}
}

// TestWidgetsStayPure keeps ui/ a function of its props. A widget that needs to
// know it is focused takes a bool; one that needs hints takes resolved hints.
func TestWidgetsStayPure(t *testing.T) {
	forbidden := []string{
		module + "/internal/tui/navigation",
		module + "/internal/tui/focus",
		module + "/internal/tui/input",
		module + "/internal/tui/command",
		module + "/internal/tui/shell",
		module + "/internal/tui/core/registry",
		module + "/internal/tui/core/runtime",
	}

	for _, p := range packages(t) {
		if p.ImportPath != module+"/internal/tui/ui" {
			continue
		}
		for _, imported := range p.Imports {
			for _, bad := range forbidden {
				if imported == bad {
					t.Errorf("ui imports %s — widgets take props, not framework state", imported)
				}
			}
		}
	}
}

// TestStateMachinesAreIndependent holds the L1 packages apart. input is the one
// documented exception: it names command.ID and reuses command.Predicate.
func TestStateMachinesAreIndependent(t *testing.T) {
	machines := []string{"navigation", "focus", "input", "command", "theme", "layout"}
	allowed := map[string]map[string]bool{
		"input": {module + "/internal/tui/command": true},
	}

	for _, p := range packages(t) {
		name := strings.TrimPrefix(p.ImportPath, module+"/internal/tui/")
		if !contains(machines, name) {
			continue
		}
		for _, imported := range p.Imports {
			if !strings.HasPrefix(imported, module+"/internal/tui/") {
				continue
			}
			target := strings.TrimPrefix(imported, module+"/internal/tui/")
			switch {
			case target == "kernel":
			case allowed[name][imported]:
			case !contains(machines, target):
				t.Errorf("%s imports %s, which is above it", name, target)
			default:
				t.Errorf("%s imports %s — the state machines must stay independent", name, target)
			}
		}
	}
}

// TestKernelHasNoDependencies keeps the bottom layer at zero, Bubble Tea
// included, so that geometry and identifiers are usable anywhere.
func TestKernelHasNoDependencies(t *testing.T) {
	for _, p := range packages(t) {
		if p.ImportPath != module+"/internal/tui/kernel" {
			continue
		}
		for _, imported := range p.Imports {
			if strings.Contains(imported, ".") {
				t.Errorf("kernel imports %s — it must depend on nothing but the standard library", imported)
			}
		}
	}
}

// TestOnlyRenderMeasuresText is the invariant that keeps the frame from
// tearing: escape sequences occupy no cells and wide runes occupy two, so byte
// length is never display width.
func TestOnlyRenderMeasuresText(t *testing.T) {
	root := filepath.Join(repoRoot(t), "internal")

	err := filepath.WalkDir(root, func(path string, d os.DirEntry, err error) error {
		if err != nil || d.IsDir() || !strings.HasSuffix(path, ".go") || strings.HasSuffix(path, "_test.go") {
			return err
		}
		if strings.Contains(path, filepath.Join("core", "render")) {
			return nil
		}

		body, err := os.ReadFile(path)
		if err != nil {
			return err
		}
		for _, forbidden := range []string{"utf8.RuneCountInString", "lipgloss.Width"} {
			if strings.Contains(string(body), forbidden) {
				t.Errorf("%s uses %s — measure display text through core/render", path, forbidden)
			}
		}
		return nil
	})
	if err != nil {
		t.Fatalf("walking the tree: %v", err)
	}
}

// TestColoursLiveInTheThemePackage catches the drift that always happens six
// months in: a component reaching for a hex value instead of a token.
func TestColoursLiveInTheThemePackage(t *testing.T) {
	root := filepath.Join(repoRoot(t), "internal")

	err := filepath.WalkDir(root, func(path string, d os.DirEntry, err error) error {
		if err != nil || d.IsDir() || !strings.HasSuffix(path, ".go") || strings.HasSuffix(path, "_test.go") {
			return err
		}
		if strings.Contains(path, filepath.Join("tui", "theme")) {
			return nil
		}

		body, err := os.ReadFile(path)
		if err != nil {
			return err
		}
		if strings.Contains(string(body), "lipgloss.Color(") {
			t.Errorf("%s constructs a colour — components read theme tokens, never hues", path)
		}
		return nil
	})
	if err != nil {
		t.Fatalf("walking the tree: %v", err)
	}
}

func contains(list []string, s string) bool {
	for _, item := range list {
		if item == s {
			return true
		}
	}
	return false
}
