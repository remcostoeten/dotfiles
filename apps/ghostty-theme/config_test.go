package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestLoadAndRenderConfigPreservesUnrelatedLines(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "config")
	original := `# keep this comment
theme = old-theme
font-family = "Old Mono"
font-size = 12.5
adjust-cell-height = 5%
adjust-cell-width = -2%
background-opacity = 0.80
window-decoration = none
keybind = ctrl+h=new_split:right
`
	if err := os.WriteFile(path, []byte(original), 0o644); err != nil {
		t.Fatal(err)
	}

	cfg, raw, err := loadSettings(path)
	if err != nil {
		t.Fatal(err)
	}
	if cfg.Theme != "old-theme" || cfg.Font != "Old Mono" || cfg.FontSize != 13 || cfg.LineHeight != 5 || cfg.LetterSpacing != -2 || cfg.Opacity != 80 || cfg.Decorations {
		t.Fatalf("unexpected parse result: %#v", cfg)
	}
	cfg.Theme, cfg.Font, cfg.LineHeight = "new-theme", "New Mono", 20
	rendered := string(renderConfig(raw, cfg))
	for _, want := range []string{
		"# keep this comment", "theme = new-theme", `font-family = "New Mono"`,
		"adjust-cell-height = 20%", "keybind = ctrl+h=new_split:right",
	} {
		if !strings.Contains(rendered, want) {
			t.Errorf("rendered config missing %q\n%s", want, rendered)
		}
	}
	if strings.Count(rendered, "theme = ") != 1 {
		t.Fatalf("theme was duplicated:\n%s", rendered)
	}
}

func TestRenderAddsMissingManagedSettings(t *testing.T) {
	cfg := defaultSettings()
	rendered := string(renderConfig([]byte("theme = demo\n"), cfg))
	for _, key := range []string{"font-family =", "font-size =", "adjust-cell-height =", "background-opacity =", "window-decoration ="} {
		if !strings.Contains(rendered, key) {
			t.Errorf("missing setting %q", key)
		}
	}
}

func TestMappedThemeUpdatesBackgroundImage(t *testing.T) {
	cfg := defaultSettings()
	cfg.Theme = "pastel-dark"
	rendered := string(renderConfigWithAssets([]byte("background-image = /old/image.png\n"), cfg, "/themes/assets"))
	if !strings.Contains(rendered, "background-image = /themes/assets/pastel-dark-bg.png") {
		t.Fatalf("mapped wallpaper was not rendered:\n%s", rendered)
	}
	if strings.Contains(rendered, "/old/image.png") {
		t.Fatalf("old image was retained:\n%s", rendered)
	}
}

func TestExplicitBackgroundWinsOverThemeImage(t *testing.T) {
	cfg := defaultSettings()
	cfg.Theme, cfg.Background, cfg.ImageOpacity = "pastel-dark", "/themes/assets/graphite.png", 70
	rendered := string(renderConfigWithAssets([]byte("background-image = /old.png\nbackground-image-opacity = 0.5\n"), cfg, "/themes/assets"))
	for _, want := range []string{"background-image = /themes/assets/graphite.png", "background-image-opacity = 0.70"} {
		if !strings.Contains(rendered, want) {
			t.Errorf("missing %q in:\n%s", want, rendered)
		}
	}
	if strings.Contains(rendered, "pastel-dark-bg.png") || strings.Count(rendered, "background-image =") != 1 {
		t.Fatalf("theme image leaked or duplicated:\n%s", rendered)
	}
}

func TestLoadSettingsReadsBackground(t *testing.T) {
	path := filepath.Join(t.TempDir(), "config")
	if err := os.WriteFile(path, []byte("background-image = /x/y.png\nbackground-image-opacity = 0.35\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	cfg, _, err := loadSettings(path)
	if err != nil || cfg.Background != "/x/y.png" || cfg.ImageOpacity != 35 {
		t.Fatalf("unexpected: %#v %v", cfg, err)
	}
}

func TestDiscoverBackgrounds(t *testing.T) {
	dir := t.TempDir()
	for _, name := range []string{"warm-sunset-bg.png", "b.jpg", "notes.txt", "zeta.PNG"} {
		if err := os.WriteFile(filepath.Join(dir, name), []byte("x"), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	got := discoverBackgrounds(dir)
	if len(got) != 3 || got[0].Name != "b" || got[1].Name != "warm-sunset" || got[2].Name != "zeta" {
		t.Fatalf("unexpected: %#v", got)
	}
	if b, ok := findBackground(got, "Warm-Sunset"); !ok || filepath.Base(b.Path) != "warm-sunset-bg.png" {
		t.Fatalf("lookup failed: %#v %v", b, ok)
	}
}
