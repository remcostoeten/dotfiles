package main

import (
	"os/exec"
	"runtime"
	"strings"
)

// opener returns the command (possibly multi-word, e.g. "gio open") used to
// open urls and directories on this OS / desktop.
func opener() []string {
	if runtime.GOOS == "darwin" {
		return []string{"open"}
	}
	candidates := [][]string{
		{"xdg-open"}, {"wslview"}, {"gio", "open"},
		{"nautilus"}, {"dolphin"}, {"nemo"}, {"thunar"},
	}
	for _, c := range candidates {
		if _, err := exec.LookPath(c[0]); err == nil {
			return c
		}
	}
	return nil
}

// openURL opens a url/path in the background; returns a human-readable result.
func openURL(target string) string {
	if strings.TrimSpace(target) == "" {
		return "nothing to open"
	}
	o := opener()
	if o == nil {
		return "no opener found (xdg-open/open/…)"
	}
	args := append(o[1:], target)
	cmd := exec.Command(o[0], args...)
	if err := cmd.Start(); err != nil {
		return "open failed: " + err.Error()
	}
	_ = cmd.Process.Release()
	return "opened " + target
}

// firstCmd returns the first command name that exists on PATH.
func firstCmd(names ...string) string {
	for _, n := range names {
		if _, err := exec.LookPath(n); err == nil {
			return n
		}
	}
	return ""
}
