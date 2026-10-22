package navigation

import tea "charm.land/bubbletea/v2"

// Kind is what a NavigateMsg asks the router to do.
type Kind uint8

const (
	// KindSwitch moves to a sibling section, discarding drill-in depth.
	KindSwitch Kind = iota
	// KindPush drills into a nested route.
	KindPush
	// KindPop unwinds one level.
	KindPop
	// KindBack steps back through visited sections.
	KindBack
	// KindForward reverses a back step.
	KindForward
)

// NavigateMsg is the only way navigation state changes. Routing every move
// through one message keeps the root reducer free of screen names.
type NavigateMsg struct {
	Kind   Kind
	Route  RouteID
	Params Params
}

// Switch returns a command that moves to a sibling section.
func Switch(id RouteID, params Params) tea.Cmd {
	return func() tea.Msg {
		return NavigateMsg{Kind: KindSwitch, Route: id, Params: params}
	}
}

// Push returns a command that drills into a nested route.
func Push(id RouteID, params Params) tea.Cmd {
	return func() tea.Msg {
		return NavigateMsg{Kind: KindPush, Route: id, Params: params}
	}
}

// Pop returns a command that unwinds one level.
func Pop() tea.Cmd {
	return func() tea.Msg {
		return NavigateMsg{Kind: KindPop}
	}
}

// Back returns a command that steps back through visited sections.
func Back() tea.Cmd {
	return func() tea.Msg {
		return NavigateMsg{Kind: KindBack}
	}
}

// Forward returns a command that reverses a back step.
func Forward() tea.Cmd {
	return func() tea.Msg {
		return NavigateMsg{Kind: KindForward}
	}
}

// Apply reduces a navigation message, reporting whether anything changed so
// that the caller can skip re-solving layout and focus when nothing did.
func (s State) Apply(msg NavigateMsg) (State, bool) {
	switch msg.Kind {
	case KindPush:
		next := s.Push(msg.Route, msg.Params)
		return next, next.Depth() != s.Depth()
	case KindPop:
		return s.Pop()
	case KindBack:
		return s.Back()
	case KindForward:
		return s.Forward()
	default:
		next := s.Switch(msg.Route, msg.Params)
		return next, next.Current().Route != s.Current().Route || next.Depth() != s.Depth()
	}
}
