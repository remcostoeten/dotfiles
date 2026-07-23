package main

import (
	"os"
	"path/filepath"
	"testing"
)

func TestParseTheme(t *testing.T) {
	path := filepath.Join(t.TempDir(), "neon")
	data := `palette = 0=#101018
palette = 15=#ffffff
background = #111119
foreground = #eeeeff
cursor-color = #7cf7d4
selection-background = #303044
`
	if err := os.WriteFile(path, []byte(data), 0o644); err != nil {
		t.Fatal(err)
	}
	got := parseTheme("neon", path, true)
	if got.Background != "#111119" || got.Foreground != "#eeeeff" || got.Cursor != "#7cf7d4" || got.Palette[0] != "#101018" || got.Palette[15] != "#ffffff" || !got.Custom {
		t.Fatalf("unexpected theme: %#v", got)
	}
}

func TestCustomThemeOverridesSystemTheme(t *testing.T) {
	root := t.TempDir()
	system, custom := filepath.Join(root, "system"), filepath.Join(root, "custom")
	if err := os.MkdirAll(system, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(custom, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(system, "same"), []byte("background = #000000\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(custom, "same"), []byte("background = #121212\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	themes := discoverThemes(custom, system)
	if len(themes) != 1 || themes[0].Background != "#121212" || !themes[0].Custom {
		t.Fatalf("custom theme did not win: %#v", themes)
	}
}
