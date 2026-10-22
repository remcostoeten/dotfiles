package focus

import tea "charm.land/bubbletea/v2"

// Kind is what a focus message asks for.
type Kind uint8

const (
	// KindNext moves to the following region.
	KindNext Kind = iota
	// KindPrev moves to the preceding region.
	KindPrev
	// KindSet focuses a named region.
	KindSet
	// KindDirectional moves geometrically.
	KindDirectional
	// KindJumpMode toggles the jump badges.
	KindJumpMode
)

// Msg is the only way focus changes.
type Msg struct {
	Kind   Kind
	Region ID
	Dir    Dir
	On     bool
}

// Next returns a command that advances focus.
func Next() tea.Cmd {
	return func() tea.Msg { return Msg{Kind: KindNext} }
}

// Prev returns a command that reverses focus.
func Prev() tea.Cmd {
	return func() tea.Msg { return Msg{Kind: KindPrev} }
}

// Set returns a command that focuses a named region.
func Set(id ID) tea.Cmd {
	return func() tea.Msg { return Msg{Kind: KindSet, Region: id} }
}

// Move returns a command that moves focus geometrically.
func Move(d Dir) tea.Cmd {
	return func() tea.Msg { return Msg{Kind: KindDirectional, Dir: d} }
}

// SetJump returns a command that turns jump mode on or off.
func SetJump(on bool) tea.Cmd {
	return func() tea.Msg { return Msg{Kind: KindJumpMode, On: on} }
}
