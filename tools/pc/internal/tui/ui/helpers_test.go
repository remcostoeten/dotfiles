package ui_test

import (
	"strings"

	tea "charm.land/bubbletea/v2"
)

var namedKeys = map[string]rune{
	"enter":     tea.KeyEnter,
	"esc":       tea.KeyEsc,
	"tab":       tea.KeyTab,
	"up":        tea.KeyUp,
	"down":      tea.KeyDown,
	"left":      tea.KeyLeft,
	"right":     tea.KeyRight,
	"home":      tea.KeyHome,
	"end":       tea.KeyEnd,
	"pgup":      tea.KeyPgUp,
	"pgdown":    tea.KeyPgDown,
	"backspace": tea.KeyBackspace,
	"delete":    tea.KeyDelete,
	"space":     ' ',
}

// keyPress builds the key message a terminal would produce for a canonical key
// name, modifiers included, so tests drive widgets the way the resolver will.
func keyPress(name string) tea.KeyMsg {
	parts := strings.Split(name, "+")
	base := parts[len(parts)-1]

	msg := tea.KeyPressMsg{}
	for _, mod := range parts[:len(parts)-1] {
		switch mod {
		case "ctrl":
			msg.Mod |= tea.ModCtrl
		case "alt":
			msg.Mod |= tea.ModAlt
		case "shift":
			msg.Mod |= tea.ModShift
		}
	}

	if code, ok := namedKeys[base]; ok {
		msg.Code = code
		if base == "space" && msg.Mod == 0 {
			msg.Text = " "
		}
		return msg
	}

	msg.Code = []rune(base)[0]
	if msg.Mod == 0 {
		msg.Text = base
	}
	return msg
}
