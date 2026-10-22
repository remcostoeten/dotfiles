// Package todo reads the task file shared with the Bun `todo` CLI and forwards
// every mutation the CLI already implements to it, so parsing, id allocation,
// undo archives and reminder state keep a single owner.
package todo

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"time"
)

// Priority mirrors the CLI's TaskPriority.
type Priority string

const (
	PriorityNone   Priority = "none"
	PriorityLow    Priority = "low"
	PriorityMedium Priority = "medium"
	PriorityHigh   Priority = "high"
)

// Next cycles none → low → medium → high → none.
func (p Priority) Next() Priority {
	switch p {
	case PriorityLow:
		return PriorityMedium
	case PriorityMedium:
		return PriorityHigh
	case PriorityHigh:
		return PriorityNone
	default:
		return PriorityLow
	}
}

// Task is the read-only view of one entry in tasks.json.
type Task struct {
	ID          string   `json:"id"`
	Description string   `json:"description"`
	Status      string   `json:"status"`
	Priority    Priority `json:"priority"`
	CreatedAt   int64    `json:"createdAt"`
	UpdatedAt   int64    `json:"updatedAt"`
	DueDate     *int64   `json:"dueDate,omitempty"`
	ParentID    string   `json:"parentId,omitempty"`
	Kind        string   `json:"kind,omitempty"`
	Hidden      bool     `json:"hidden,omitempty"`
	Reminder    *struct {
		DueAt int64 `json:"dueAt"`
	} `json:"reminder,omitempty"`
}

// Pending reports whether the task is still open.
func (t Task) Pending() bool {
	return t.Status != "completed"
}

// Epic reports whether the task was created as an epic.
func (t Task) Epic() bool {
	return t.Kind == "epic"
}

// Due is the effective due time; a reminder owns it when present.
func (t Task) Due() (time.Time, bool) {
	if t.Reminder != nil {
		return time.UnixMilli(t.Reminder.DueAt), true
	}
	if t.DueDate != nil {
		return time.UnixMilli(*t.DueDate), true
	}
	return time.Time{}, false
}

// DataDir resolves the directory the CLI stores its files in.
func DataDir() string {
	if dir := os.Getenv("DOTFILES_DATA_DIR"); dir != "" {
		return filepath.Join(dir, "todo")
	}
	home, _ := os.UserHomeDir()
	return filepath.Join(home, ".dotfiles", "todo")
}

// Store reads and minimally patches tasks.json.
type Store struct {
	Path string
}

// NewStore points at the CLI's task file.
func NewStore() *Store {
	return &Store{Path: filepath.Join(DataDir(), "tasks.json")}
}

// Load reads every task. A missing file is an empty list.
func (s *Store) Load() ([]Task, error) {
	raw, err := os.ReadFile(s.Path)
	if errors.Is(err, os.ErrNotExist) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	var tasks []Task
	if err := json.Unmarshal(raw, &tasks); err != nil {
		return nil, fmt.Errorf("could not read %s: %w", s.Path, err)
	}
	for i := range tasks {
		if tasks[i].Priority == "" {
			tasks[i].Priority = PriorityNone
		}
	}
	return tasks, nil
}

// Patch rewrites one task's fields in place. It decodes into untyped maps so
// fields this package does not model survive the round trip untouched.
func (s *Store) Patch(id string, fields map[string]any) error {
	raw, err := os.ReadFile(s.Path)
	if err != nil {
		return err
	}
	var entries []map[string]any
	if err := json.Unmarshal(raw, &entries); err != nil {
		return err
	}
	found := false
	for _, entry := range entries {
		if entry["id"] != id {
			continue
		}
		for key, value := range fields {
			entry[key] = value
		}
		entry["updatedAt"] = time.Now().UnixMilli()
		found = true
	}
	if !found {
		return fmt.Errorf("task not found: %s", id)
	}
	out, err := json.MarshalIndent(entries, "", "  ")
	if err != nil {
		return err
	}
	tmp := fmt.Sprintf("%s.%d.tmp", s.Path, os.Getpid())
	if err := os.WriteFile(tmp, append(out, '\n'), 0o644); err != nil {
		return err
	}
	return os.Rename(tmp, s.Path)
}
