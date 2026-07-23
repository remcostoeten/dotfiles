package main

import (
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"
)

func statePath(name string) string {
	home, _ := os.UserHomeDir()
	return filepath.Join(home, ".local", "state", "ghostty-theme", name)
}

func readLines(path string) []string {
	b, _ := os.ReadFile(path)
	var out []string
	for _, line := range strings.Split(string(b), "\n") {
		if line = strings.TrimSpace(line); line != "" {
			out = append(out, line)
		}
	}
	return out
}

func writeLines(path string, lines []string) error {
	return writeAtomic(path, []byte(strings.Join(lines, "\n")+"\n"))
}

func toggleLine(path, value string) bool {
	lines, found := readLines(path), false
	out := make([]string, 0, len(lines)+1)
	for _, line := range lines {
		if line == value {
			found = true
			continue
		}
		out = append(out, line)
	}
	if !found {
		out = append(out, value)
	}
	sort.Slice(out, func(i, j int) bool { return strings.ToLower(out[i]) < strings.ToLower(out[j]) })
	_ = writeLines(path, out)
	return !found
}

func recordRecent(value string) {
	lines := []string{value}
	for _, line := range readLines(statePath("recents")) {
		if line != value && len(lines) < 15 {
			lines = append(lines, line)
		}
	}
	_ = writeLines(statePath("recents"), lines)
}

func discoverFonts() []string {
	cmd := exec.Command("fc-list", ":", "family")
	b, err := cmd.Output()
	if err != nil {
		return []string{"JetBrainsMono Nerd Font", "FiraCode Nerd Font", "Hack Nerd Font", "CaskaydiaCove Nerd Font", "MesloLGS Nerd Font", "monospace"}
	}
	seen := map[string]bool{}
	for _, line := range strings.Split(string(b), "\n") {
		for _, family := range strings.Split(line, ",") {
			family = strings.TrimSpace(family)
			if family != "" {
				seen[family] = true
			}
		}
	}
	fonts := make([]string, 0, len(seen))
	for font := range seen {
		fonts = append(fonts, font)
	}
	sort.Slice(fonts, func(i, j int) bool { return strings.ToLower(fonts[i]) < strings.ToLower(fonts[j]) })
	return fonts
}

func contains(lines []string, value string) bool {
	for _, line := range lines {
		if line == value {
			return true
		}
	}
	return false
}
