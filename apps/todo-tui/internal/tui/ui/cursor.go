package ui

import tea "charm.land/bubbletea/v2"

// Move is a cursor movement decoded from a key. Stateful widgets share this
// vocabulary so that j/k, the arrow keys and the page keys behave identically
// in a list, a table and a tree.
type Move uint8

const (
	// MoveNone means the key was not a movement.
	MoveNone Move = iota
	MoveUp
	MoveDown
	MovePageUp
	MovePageDown
	MoveHome
	MoveEnd
)

// DecodeMove maps a key message to a movement. Anything else is MoveNone, and
// the widget must leave the message alone so it can reach whatever else wants it.
func DecodeMove(msg tea.Msg) Move {
	key, ok := msg.(tea.KeyMsg)
	if !ok {
		return MoveNone
	}
	switch key.String() {
	case "up", "k", "ctrl+p":
		return MoveUp
	case "down", "j", "ctrl+n":
		return MoveDown
	case "pgup", "ctrl+b":
		return MovePageUp
	case "pgdown", "ctrl+f":
		return MovePageDown
	case "home", "g":
		return MoveHome
	case "end", "G":
		return MoveEnd
	default:
		return MoveNone
	}
}

// apply moves a cursor within [0, count) for a viewport of the given height.
func (m Move) apply(cursor, count, page int) int {
	if count <= 0 {
		return 0
	}
	page = max(1, page)
	switch m {
	case MoveUp:
		cursor--
	case MoveDown:
		cursor++
	case MovePageUp:
		cursor -= page
	case MovePageDown:
		cursor += page
	case MoveHome:
		cursor = 0
	case MoveEnd:
		cursor = count - 1
	}
	return min(max(cursor, 0), count-1)
}
