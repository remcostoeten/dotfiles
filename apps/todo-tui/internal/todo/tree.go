package todo

import (
	"slices"
	"strings"
	"time"
)

// Row is one line of the indented task tree.
type Row struct {
	Task Task
	// Depth is 0 for roots.
	Depth int
	// SiblingFollows has one entry per ancestor level plus the row itself.
	SiblingFollows []bool
	HasChildren    bool
	ChildCount     int
	Collapsed      bool
	Done, Total    int
}

// Prefix renders the box-drawing guides for a nested row.
func (r Row) Prefix() string {
	if r.Depth == 0 {
		return ""
	}
	var b strings.Builder
	for _, follows := range r.SiblingFollows[1 : len(r.SiblingFollows)-1] {
		if follows {
			b.WriteString("│  ")
		} else {
			b.WriteString("   ")
		}
	}
	if r.SiblingFollows[len(r.SiblingFollows)-1] {
		b.WriteString("├─ ")
	} else {
		b.WriteString("└─ ")
	}
	return b.String()
}

// BuildRows lays visible tasks out as a tree. A task whose parent is not
// visible becomes a root, so filtered views still show their matches.
func BuildRows(visible, all []Task, collapsed map[string]bool) []Row {
	visibleIDs := make(map[string]bool, len(visible))
	for _, t := range visible {
		visibleIDs[t.ID] = true
	}
	children := map[string][]Task{}
	for _, t := range visible {
		parent := ""
		if t.ParentID != "" && t.ParentID != t.ID && visibleIDs[t.ParentID] {
			parent = t.ParentID
		}
		children[parent] = append(children[parent], t)
	}
	for _, siblings := range children {
		slices.SortStableFunc(siblings, compareTasks)
	}

	var rows []Row
	visited := map[string]bool{}
	var visit func(parent string, depth int, trail []bool)
	visit = func(parent string, depth int, trail []bool) {
		siblings := children[parent]
		for i, t := range siblings {
			if visited[t.ID] {
				continue
			}
			visited[t.ID] = true
			follows := append(slices.Clone(trail), i < len(siblings)-1)
			kids := children[t.ID]
			done, total := Progress(all, t.ID)
			rows = append(rows, Row{
				Task: t, Depth: depth, SiblingFollows: follows,
				HasChildren: len(kids) > 0, ChildCount: len(kids),
				Collapsed: collapsed[t.ID], Done: done, Total: total,
			})
			if !collapsed[t.ID] {
				visit(t.ID, depth+1, follows)
			}
		}
	}
	visit("", 0, nil)
	return rows
}

// Descendants lists every task nested under id, not including id.
func Descendants(all []Task, id string) map[string]bool {
	byParent := map[string][]string{}
	for _, t := range all {
		if t.ParentID != "" {
			byParent[t.ParentID] = append(byParent[t.ParentID], t.ID)
		}
	}
	out := map[string]bool{}
	queue := []string{id}
	for len(queue) > 0 {
		next := queue[len(queue)-1]
		queue = queue[:len(queue)-1]
		for _, child := range byParent[next] {
			if !out[child] {
				out[child] = true
				queue = append(queue, child)
			}
		}
	}
	delete(out, id)
	return out
}

// Progress counts completed descendants against all descendants.
func Progress(all []Task, id string) (done, total int) {
	ids := Descendants(all, id)
	for _, t := range all {
		if ids[t.ID] && !t.Pending() {
			done++
		}
	}
	return done, len(ids)
}

func compareTasks(a, b Task) int {
	ad, aok := a.Due()
	bd, bok := b.Due()
	switch {
	case aok && bok:
		return ad.Compare(bd)
	case aok:
		return -1
	case bok:
		return 1
	}
	return int(a.CreatedAt - b.CreatedAt)
}

// Workspace is a saved filter in the sidebar.
type Workspace struct {
	Key   string
	Label string
}

// Workspaces are the sidebar entries, in order.
var Workspaces = []Workspace{
	{"all", "all tasks"},
	{"today", "today"},
	{"overdue", "overdue"},
	{"high", "high priority"},
	{"archive", "archive"},
}

// Filter applies a workspace to the task list.
func Filter(all []Task, key string, now time.Time) []Task {
	var out []Task
	for _, t := range all {
		if key == "archive" {
			if !t.Pending() {
				out = append(out, t)
			}
			continue
		}
		if !t.Pending() {
			continue
		}
		due, hasDue := t.Due()
		switch key {
		case "today":
			if !hasDue || !SameDay(due, now) {
				continue
			}
		case "overdue":
			if !hasDue || !due.Before(now) {
				continue
			}
		case "high":
			if t.Priority != PriorityHigh {
				continue
			}
		}
		out = append(out, t)
	}
	return out
}

// Search keeps the tasks whose description contains query, case-insensitively.
func Search(tasks []Task, query string) []Task {
	query = strings.ToLower(strings.TrimSpace(query))
	if query == "" {
		return tasks
	}
	var out []Task
	for _, t := range tasks {
		if strings.Contains(strings.ToLower(t.Description), query) {
			out = append(out, t)
		}
	}
	return out
}

// SameDay reports whether two instants share a local calendar day.
func SameDay(a, b time.Time) bool {
	ay, am, ad := a.Local().Date()
	by, bm, bd := b.Local().Date()
	return ay == by && am == bm && ad == bd
}
