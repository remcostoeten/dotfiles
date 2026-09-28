package ui

import (
	"strings"

	tea "charm.land/bubbletea/v2"

	"pc/internal/tui/core/render"
	"pc/internal/tui/kernel"
)

// ScrollArea scrolls a block of already-rendered text vertically. It is the
// escape hatch for content that is not a list: help text, logs, a rendered
// document.
type ScrollArea struct {
	Content string
	Focused bool
	Height  int

	offset int
}

// NewScrollArea builds a scroll area over content.
func NewScrollArea(content string) ScrollArea {
	return ScrollArea{Content: content}
}

// SetContent replaces the body, clamping the offset into the new range.
func (s ScrollArea) SetContent(content string) ScrollArea {
	s.Content = content
	s.offset = min(s.offset, s.ScrollPos().MaxOffset())
	return s
}

// SetHeight tells the area how many rows it will be rendered into.
func (s ScrollArea) SetHeight(h int) ScrollArea {
	s.Height = max(0, h)
	s.offset = min(s.offset, s.ScrollPos().MaxOffset())
	return s
}

// ScrollPos describes how much of the content is on screen.
func (s ScrollArea) ScrollPos() ScrollPos {
	return ScrollPos{Offset: s.offset, Visible: s.Height, Total: len(render.Lines(s.Content))}
}

// AtBottom reports whether the last line is visible, which is what a log view
// needs in order to decide whether to follow new output.
func (s ScrollArea) AtBottom() bool {
	return s.offset >= s.ScrollPos().MaxOffset()
}

// Update scrolls the viewport. It also handles the wheel, because scrolling is
// the one mouse gesture the shell supports.
func (s ScrollArea) Update(msg tea.Msg) (ScrollArea, tea.Cmd) {
	if !s.Focused {
		return s, nil
	}

	maxOffset := s.ScrollPos().MaxOffset()
	if wheel, ok := msg.(tea.MouseWheelMsg); ok {
		switch wheel.Button {
		case tea.MouseWheelUp:
			s.offset = max(0, s.offset-3)
		case tea.MouseWheelDown:
			s.offset = min(maxOffset, s.offset+3)
		}
		return s, nil
	}

	switch DecodeMove(msg) {
	case MoveUp:
		s.offset = max(0, s.offset-1)
	case MoveDown:
		s.offset = min(maxOffset, s.offset+1)
	case MovePageUp:
		s.offset = max(0, s.offset-max(1, s.Height))
	case MovePageDown:
		s.offset = min(maxOffset, s.offset+max(1, s.Height))
	case MoveHome:
		s.offset = 0
	case MoveEnd:
		s.offset = maxOffset
	}
	return s, nil
}

// Render draws the visible window of the content.
func (s ScrollArea) Render(rc render.Context) string {
	size := rc.Size()
	if size.IsZero() {
		return ""
	}
	lines := render.Lines(s.Content)
	if s.offset >= len(lines) {
		return render.Blank(size)
	}
	window := lines[s.offset:min(len(lines), s.offset+size.Height)]
	return render.Clip(strings.Join(window, "\n"), kernel.Size{Width: size.Width, Height: size.Height})
}
