package main

import (
	"bufio"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
)

type theme struct {
	Name, Path, Background, Foreground, Cursor, Selection string
	Palette                                               [16]string
	Custom                                                bool
}

func parseTheme(name, path string, custom bool) theme {
	t := theme{Name: name, Path: path, Custom: custom, Background: "#111118", Foreground: "#e8e8f0", Cursor: "#a78bfa", Selection: "#303040"}
	f, err := os.Open(path)
	if err != nil {
		return t
	}
	defer f.Close()
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		key, value, ok := strings.Cut(line, "=")
		if !ok || strings.HasPrefix(line, "#") {
			continue
		}
		key, value = strings.TrimSpace(key), strings.TrimSpace(value)
		switch key {
		case "background":
			t.Background = value
		case "foreground":
			t.Foreground = value
		case "cursor-color":
			t.Cursor = value
		case "selection-background":
			t.Selection = value
		case "palette":
			i, color, found := strings.Cut(value, "=")
			n, e := strconv.Atoi(strings.TrimSpace(i))
			if found && e == nil && n >= 0 && n < len(t.Palette) {
				t.Palette[n] = strings.TrimSpace(color)
			}
		}
	}
	return t
}

func discoverThemes(customDir, systemDir string) []theme {
	byName := map[string]theme{}
	for _, source := range []struct {
		dir    string
		custom bool
	}{{systemDir, false}, {customDir, true}} {
		entries, _ := os.ReadDir(source.dir)
		for _, entry := range entries {
			if entry.IsDir() || strings.HasPrefix(entry.Name(), ".") {
				continue
			}
			byName[strings.ToLower(entry.Name())] = parseTheme(entry.Name(), filepath.Join(source.dir, entry.Name()), source.custom)
		}
	}
	result := make([]theme, 0, len(byName))
	for _, t := range byName {
		result = append(result, t)
	}
	sort.Slice(result, func(i, j int) bool { return strings.ToLower(result[i].Name) < strings.ToLower(result[j].Name) })
	return result
}

func validColor(value, fallback string) string {
	value = strings.TrimSpace(value)
	if len(value) == 7 && value[0] == '#' {
		return value
	}
	return fallback
}
