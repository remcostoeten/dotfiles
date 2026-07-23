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
