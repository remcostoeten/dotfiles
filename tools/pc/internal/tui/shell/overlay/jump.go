package overlay

import (
	"maps"
	"slices"

	tea "charm.land/bubbletea/v2"

	"pc/internal/tui/core/registry"
	"pc/internal/tui/core/render"
	"pc/internal/tui/focus"
	"pc/internal/tui/kernel"
	"pc/internal/tui/layout"
	"pc/internal/tui/ui"
)

// JumpID names the jump-mode overlay.
const JumpID registry.OverlayID = "jump"

// Jump draws a badge at the corner of every reachable region and focuses the
// one whose key is pressed. It needs no support from any component: it reads
// the current ring and the rectangles layout already solved, so it works for
// regions written long after it.
type Jump struct {
	keys  map[focus.ID]rune
	rects map[focus.ID]kernel.Rect
	frame layout.Frame
}

// NewJump captures the current ring and where its regions were drawn.
func NewJump(state focus.State, frame layout.Frame) *Jump {
	rects := map[focus.ID]kernel.Rect{}
	for _, id := range frame.Regions() {
		if r, ok := frame.Region(id); ok {
			rects[id] = r
		}
	}
	return &Jump{keys: state.JumpKeys(), rects: rects, frame: frame}
}

// ID identifies the overlay.
func (j *Jump) ID() registry.OverlayID {
	return JumpID
}

// FocusRegions returns nothing: jump mode does not move focus into itself, it
// hands focus to whatever the user picks.
func (j *Jump) FocusRegions() []focus.Region {
	return nil
}

// Placement covers the whole frame so badges can be drawn anywhere on it.
func (j *Jump) Placement(frame layout.Frame) kernel.Rect {
	return frame.Size.Rect()
}

// Init has nothing to load: the ring was captured at construction.
func (j *Jump) Init(registry.Context) tea.Cmd {
	return nil
}

// Update focuses the region whose badge was pressed.
func (j *Jump) Update(_ registry.Context, msg tea.Msg) (registry.Overlay, tea.Cmd) {
	key, ok := msg.(tea.KeyMsg)
	if !ok {
		return j, nil
	}
	if key.String() == "esc" {
		return j, registry.Close()
	}

	pressed := key.Key().Code
	for id, k := range j.keys {
		if k == pressed {
			return j, tea.Sequence(registry.Close(), focus.Set(id))
		}
	}
	return j, nil
}

// Blocks draws one badge per region, at the region's top-left corner. Each is
// its own block so the frame beneath the gaps stays visible.
func (j *Jump) Blocks(rc render.Context, _ layout.Frame) []render.Block {
	ids := slices.Sorted(maps.Keys(j.keys))
	blocks := make([]render.Block, 0, len(ids))

	for _, id := range ids {
		rect, ok := j.rects[id]
		if !ok || rect.IsEmpty() {
			continue
		}
		badge := ui.Badge{Text: " " + string(j.keys[id]) + " ", Accent: true}.Render(rc)
		at := kernel.Rect{X: rect.X + 1, Y: rect.Y, Width: 3, Height: 1}
		blocks = append(blocks, render.At(at, badge))
	}
	return blocks
}

// Render is unused: jump mode composites through Blocks. It satisfies the
// Overlay interface and draws nothing on its own.
func (j *Jump) Render(render.Context) string {
	return ""
}
