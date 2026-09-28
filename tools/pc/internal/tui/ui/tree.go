package ui

import (
	"strings"

	tea "charm.land/bubbletea/v2"

	"pc/internal/tui/core/render"
	"pc/internal/tui/kernel"
)

// TreeNode is one node of a Tree. Children are held by value, so a tree is a
// plain data structure the owner can rebuild from scratch each time.
type TreeNode struct {
	ID       kernel.ID
	Label    string
	Children []TreeNode
}

// Tree is a collapsible hierarchy. Expansion state is keyed by node id so that
// rebuilding the node slice does not lose what the user opened.
type Tree struct {
	Nodes    []TreeNode
	Focused  bool
	Height   int
	Expanded map[kernel.ID]bool

	cursor int
	offset int
}

// NewTree builds a tree with every node collapsed.
func NewTree(nodes ...TreeNode) Tree {
	return Tree{Nodes: nodes, Expanded: map[kernel.ID]bool{}}
}

type treeRow struct {
	node  TreeNode
	depth int
	leaf  bool
	open  bool
}

// SetHeight tells the tree how many rows it will be rendered into.
func (t Tree) SetHeight(h int) Tree {
	t.Height = max(0, h)
	t.offset = Window(t.offset, t.cursor, t.Height, len(t.flatten()))
	return t
}

// Selected returns the node under the cursor.
func (t Tree) Selected() (TreeNode, bool) {
	rows := t.flatten()
	if t.cursor < 0 || t.cursor >= len(rows) {
		return TreeNode{}, false
	}
	return rows[t.cursor].node, true
}

// ScrollPos describes how much of the tree is on screen.
func (t Tree) ScrollPos() ScrollPos {
	return ScrollPos{Offset: t.offset, Visible: t.Height, Total: len(t.flatten())}
}

// Toggle opens or closes a node.
func (t Tree) Toggle(id kernel.ID) Tree {
	expanded := make(map[kernel.ID]bool, len(t.Expanded)+1)
	for k, v := range t.Expanded {
		expanded[k] = v
	}
	expanded[id] = !expanded[id]
	t.Expanded = expanded
	return t
}

// Update handles movement plus left/right and enter to collapse and expand.
func (t Tree) Update(msg tea.Msg) (Tree, tea.Cmd) {
	if !t.Focused {
		return t, nil
	}
	rows := t.flatten()

	if key, ok := msg.(tea.KeyMsg); ok {
		switch key.String() {
		case "right", "l", "enter":
			if t.cursor < len(rows) && !rows[t.cursor].leaf && !rows[t.cursor].open {
				return t.Toggle(rows[t.cursor].node.ID), nil
			}
		case "left", "h":
			if t.cursor < len(rows) && rows[t.cursor].open {
				return t.Toggle(rows[t.cursor].node.ID), nil
			}
		}
	}

	move := DecodeMove(msg)
	if move == MoveNone {
		return t, nil
	}
	t.cursor = move.apply(t.cursor, len(rows), t.Height)
	t.offset = Window(t.offset, t.cursor, t.Height, len(rows))
	return t, nil
}

// Render draws the visible window of the flattened tree.
func (t Tree) Render(rc render.Context) string {
	size := rc.Size()
	rows := t.flatten()
	if size.IsZero() {
		return ""
	}
	if len(rows) == 0 {
		return EmptyState{Title: "Nothing here yet"}.Render(rc)
	}

	st := rc.Styles()
	visible := min(size.Height, len(rows)-t.offset)
	lines := make([]string, 0, visible)

	for i := range visible {
		index := t.offset + i
		row := rows[index]

		marker := " "
		if !row.leaf {
			marker = rc.Glyphs.Chevron
			if row.open {
				marker = rc.Glyphs.Arrow
			}
		}
		body := strings.Repeat("  ", row.depth) + marker + " " + row.node.Label

		style := st.Base
		if index == t.cursor {
			style = st.SelectionDim
			if t.Focused {
				style = st.Selection
			}
		}
		lines = append(lines, style.Render(render.Fit(body, size.Width, render.Left, rc.Glyphs.Ellipsis)))
	}
	return render.Clip(strings.Join(lines, "\n"), size)
}

// flatten walks the visible nodes in display order.
func (t Tree) flatten() []treeRow {
	var out []treeRow
	var walk func(nodes []TreeNode, depth int)
	walk = func(nodes []TreeNode, depth int) {
		for _, n := range nodes {
			open := t.Expanded[n.ID]
			out = append(out, treeRow{node: n, depth: depth, leaf: len(n.Children) == 0, open: open})
			if open {
				walk(n.Children, depth+1)
			}
		}
	}
	walk(t.Nodes, 0)
	return out
}
