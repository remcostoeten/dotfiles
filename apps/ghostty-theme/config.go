package main

import (
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

type settings struct {
	Theme         string
	Font          string
	FontSize      int
	LineHeight    int
	LetterSpacing int
	Opacity       int
	Blur          int
	Padding       int
	Decorations   bool
	Background    string
	ImageOpacity  int
}

func defaultSettings() settings {
	return settings{Theme: "default", Font: "monospace", FontSize: 14, Opacity: 100, Decorations: true, ImageOpacity: 100}
}

func parsePercent(s string, fallback int) int {
	s = strings.TrimSuffix(strings.TrimSpace(s), "%")
	n, err := strconv.Atoi(s)
	if err != nil {
		return fallback
	}
	return n
}

func loadSettings(path string) (settings, []byte, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return settings{}, nil, err
	}
	s := defaultSettings()
	for _, line := range strings.Split(string(raw), "\n") {
		key, value, ok := strings.Cut(line, "=")
		if !ok || strings.HasPrefix(strings.TrimSpace(line), "#") {
			continue
		}
		key, value = strings.TrimSpace(key), strings.Trim(strings.TrimSpace(value), `"`)
		switch key {
		case "theme":
			s.Theme = value
		case "font-family":
			s.Font = value
		case "font-size":
			if n, e := strconv.ParseFloat(value, 64); e == nil {
				s.FontSize = int(n + .5)
			}
		case "adjust-cell-height":
			s.LineHeight = parsePercent(value, s.LineHeight)
		case "adjust-cell-width":
			s.LetterSpacing = parsePercent(value, s.LetterSpacing)
		case "background-opacity":
			if n, e := strconv.ParseFloat(value, 64); e == nil {
				s.Opacity = int(n*100 + .5)
			}
		case "background-blur":
			s.Blur, _ = strconv.Atoi(value)
		case "window-padding-x":
			s.Padding, _ = strconv.Atoi(value)
		case "window-decoration":
			s.Decorations = value != "none" && value != "false"
		case "background-image":
			s.Background = value
		case "background-image-opacity":
			if n, e := strconv.ParseFloat(value, 64); e == nil {
				s.ImageOpacity = int(n*100 + .5)
			}
		}
	}
	return s, raw, nil
}

func settingValues(s settings) map[string]string {
	decoration := "none"
	if s.Decorations {
		decoration = "auto"
	}
	return map[string]string{
		"theme":                    s.Theme,
		"font-family":              fmt.Sprintf("%q", s.Font),
		"font-size":                strconv.Itoa(s.FontSize),
		"adjust-cell-height":       fmt.Sprintf("%d%%", s.LineHeight),
		"adjust-cell-width":        fmt.Sprintf("%d%%", s.LetterSpacing),
		"background-opacity":       fmt.Sprintf("%.2f", float64(s.Opacity)/100),
		"background-blur":          strconv.Itoa(s.Blur),
		"window-padding-x":         strconv.Itoa(s.Padding),
		"window-decoration":        decoration,
		"background-image":         s.Background,
		"background-image-opacity": fmt.Sprintf("%.2f", float64(s.ImageOpacity)/100),
	}
}

var managedKeys = []string{"theme", "font-family", "font-size", "adjust-cell-height", "adjust-cell-width", "background-opacity", "background-blur", "window-padding-x", "window-decoration", "background-image", "background-image-opacity"}

func renderConfig(raw []byte, s settings) []byte {
	values, seen := settingValues(s), map[string]bool{}
	lines := strings.Split(string(raw), "\n")
	for i, line := range lines {
		key, _, ok := strings.Cut(line, "=")
		key = strings.TrimSpace(key)
		if ok {
			if value, exists := values[key]; exists {
				lines[i] = key + " = " + value
				seen[key] = true
			}
		}
	}
	for _, key := range managedKeys {
		if !seen[key] {
			lines = append(lines, key+" = "+values[key])
		}
	}
	return []byte(strings.TrimRight(strings.Join(lines, "\n"), "\n") + "\n")
}

var themeImages = map[string]string{
	"pastel-dark":           "pastel-dark-bg.png",
	"warm-sunset":           "warm-sunset-bg.png",
	"Catppuccin Mocha":      "catppuccin-mocha-gradient.png",
	"Duskfox":               "duskfox-plum.png",
	"Gruvbox Dark":          "rice-gruvbox-mountains.png",
	"Gruvbox Dark Hard":     "rice-gruvbox-mountains.png",
	"Gruvbox Material":      "rice-gruvbox-lowpoly.png",
	"Gruvbox Material Dark": "rice-gruvbox-lowpoly.png",
	"Nord":                  "rice-nord-polar.png",
	"Nord Wave":             "rice-nord-polar.png",
	"Nordfox":               "rice-nord-polar.png",
	"TokyoNight":            "rice-tokyonight-outrun.png",
	"TokyoNight Night":      "rice-tokyonight-outrun.png",
	"TokyoNight Moon":       "rice-tokyonight-outrun.png",
	"TokyoNight Storm":      "rice-tokyonight-outrun.png",
	"Catppuccin Macchiato":  "rice-catppuccin-waves.png",
	"Catppuccin Frappe":     "rice-catppuccin-waves.png",
	"Rose Pine":             "rice-rosepine-moon.png",
	"Rose Pine Moon":        "rice-rosepine-moon.png",
	"Rosé Pine":             "rice-rosepine-moon.png",
	"Rosé Pine Moon":        "rice-rosepine-moon.png",
	"Dracula":               "rice-dracula-blobs.png",
	"Dracula+":              "rice-dracula-blobs.png",
	"Everforest Dark Hard":  "rice-everforest-pines.png",
	"Kanagawa Wave":         "rice-kanagawa-wave.png",
	"Kanagawa Dragon":       "rice-kanagawa-wave.png",
	"Ayu Mirage":            "rice-ayu-skyline.png",
	"Ayu":                   "rice-ayu-skyline.png",
}

/*
themeImage returns the wallpaper bundled with a curated theme, if any.
*/
func themeImage(themeName, assetsDir string) (string, bool) {
	image, ok := themeImages[themeName]
	if !ok {
		return "", false
	}
	return filepath.Join(assetsDir, image), true
}

func renderConfigWithAssets(raw []byte, s settings, assetsDir string) []byte {
	if s.Background == "" {
		if image, ok := themeImage(s.Theme, assetsDir); ok {
			s.Background = image
		}
	}
	return renderConfig(raw, s)
}

func replaceConfigValue(raw []byte, key, value string) []byte {
	lines, replaced := strings.Split(string(raw), "\n"), false
	for i, line := range lines {
		left, _, ok := strings.Cut(line, "=")
		if ok && strings.TrimSpace(left) == key {
			lines[i], replaced = key+" = "+value, true
		}
	}
	if !replaced {
		lines = append(lines, key+" = "+value)
	}
	return []byte(strings.TrimRight(strings.Join(lines, "\n"), "\n") + "\n")
}

func writeAtomic(path string, data []byte) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	f, err := os.CreateTemp(filepath.Dir(path), ".ghostty-config-*")
	if err != nil {
		return err
	}
	tmp := f.Name()
	defer os.Remove(tmp)
	if _, err = f.Write(data); err == nil {
		err = f.Chmod(0o644)
	}
	if closeErr := f.Close(); err == nil {
		err = closeErr
	}
	if err != nil {
		return err
	}
	return os.Rename(tmp, path)
}
