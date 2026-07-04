// Package cache is a tiny on-disk JSON cache used to paint the dashboard
// instantly from the last known state while fresh data loads in the background.
package cache

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"time"
)

func dir() string {
	base := os.Getenv("XDG_CACHE_HOME")
	if base == "" {
		home, _ := os.UserHomeDir()
		base = filepath.Join(home, ".cache")
	}
	return filepath.Join(base, "bpr")
}

// safeName turns an arbitrary key (e.g. "prs-ws/repo") into a filename.
func safeName(key string) string {
	return strings.NewReplacer("/", "_", " ", "_").Replace(key) + ".json"
}

func path(key string) string { return filepath.Join(dir(), safeName(key)) }

// Save writes v as JSON under key (best-effort; errors are ignored).
func Save(key string, v any) {
	_ = os.MkdirAll(dir(), 0o755)
	b, err := json.Marshal(v)
	if err != nil {
		return
	}
	_ = os.WriteFile(path(key), b, 0o644)
}

// Load decodes the cached value for key into out and returns its age. ok is
// false when there is no usable cache entry.
func Load(key string, out any) (age time.Duration, ok bool) {
	p := path(key)
	info, err := os.Stat(p)
	if err != nil {
		return 0, false
	}
	b, err := os.ReadFile(p)
	if err != nil {
		return 0, false
	}
	if err := json.Unmarshal(b, out); err != nil {
		return 0, false
	}
	return time.Since(info.ModTime()), true
}
