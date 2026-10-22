package main

import (
	"fmt"
	"strings"

	tea "github.com/charmbracelet/bubbletea"
)

type pickItem struct {
	label string
	hint  string
}

type pickResult struct {
	indices   []int
	custom    []string
	cancelled bool
}

type pickerModel struct {
	title       string
	items       []pickItem
	multi       bool
	allowCustom bool
	filter      string
	visible     []int
	cursor      int
	selected    map[int]bool
	custom      []string
	result      pickResult
	done        bool
}

const pickerRows = 12

func (m pickerModel) Init() tea.Cmd { return nil }

func (m *pickerModel) refilter() {
	m.visible = m.visible[:0]
	q := strings.ToLower(m.filter)
	for i, it := range m.items {
		if q == "" || strings.Contains(strings.ToLower(it.label), q) || strings.Contains(strings.ToLower(it.hint), q) {
			m.visible = append(m.visible, i)
		}
	}
	m.cursor = min(m.cursor, max(m.rowCount()-1, 0))
}

func (m pickerModel) customRow() bool {
	if !m.allowCustom {
		return false
	}
	f := strings.TrimSpace(m.filter)
	if f == "" || strings.ContainsAny(f, " ") {
		return false
	}
	for _, it := range m.items {
		if strings.EqualFold(it.label, f) {
			return false
		}
	}
	for _, c := range m.custom {
		if strings.EqualFold(c, f) {
			return false
		}
	}
	return true
}

func (m pickerModel) rowCount() int {
	n := len(m.visible)
	if m.customRow() {
		n++
	}
	return n
}

func (m pickerModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	key, ok := msg.(tea.KeyMsg)
	if !ok {
		return m, nil
	}
	switch key.Type {
	case tea.KeyCtrlC, tea.KeyEsc:
		if key.Type == tea.KeyEsc && m.filter != "" {
			m.filter = ""
			m.refilter()
			return m, nil
		}
		m.result.cancelled = true
		m.done = true
		return m, tea.Quit
	case tea.KeyUp, tea.KeyCtrlP:
		if m.cursor > 0 {
			m.cursor--
		}
	case tea.KeyDown, tea.KeyCtrlN:
		if m.cursor < m.rowCount()-1 {
			m.cursor++
		}
	case tea.KeyTab, tea.KeySpace:
		if m.multi {
			m.toggle()
			return m, nil
		}
		if key.Type == tea.KeySpace {
			m.filter += " "
			m.refilter()
		}
	case tea.KeyEnter:
		if m.multi {
			if m.filter != "" && m.rowCount() > 0 {
				m.toggle()
				m.filter = ""
				m.refilter()
				return m, nil
			}
			for i := range m.items {
				if m.selected[i] {
					m.result.indices = append(m.result.indices, i)
				}
			}
			m.result.custom = m.custom
		} else {
			if m.cursor >= len(m.visible) {
				return m, nil
			}
			m.result.indices = []int{m.visible[m.cursor]}
		}
		m.done = true
		return m, tea.Quit
	case tea.KeyBackspace:
		if m.filter != "" {
			m.filter = m.filter[:len(m.filter)-1]
			m.refilter()
		}
	case tea.KeyRunes:
		m.filter += string(key.Runes)
		m.refilter()
	}
	return m, nil
}

func (m *pickerModel) toggle() {
	if m.cursor < len(m.visible) {
		i := m.visible[m.cursor]
		m.selected[i] = !m.selected[i]
		return
	}
	if m.customRow() {
		m.custom = append(m.custom, strings.TrimSpace(m.filter))
		m.filter = ""
		m.refilter()
	}
}

func (m pickerModel) View() string {
	if m.done {
		return ""
	}
	var b strings.Builder
	b.WriteString(cBold.Render(m.title) + "\n")
	b.WriteString(cCyan.Render("  › ") + m.filter + cCyan.Render("▏") + "\n")

	start := 0
	if m.cursor >= pickerRows {
		start = m.cursor - pickerRows + 1
	}
	rows := m.rowCount()
	for r := start; r < rows && r < start+pickerRows; r++ {
		pointer := "  "
		if r == m.cursor {
			pointer = cBlue.Render("▸ ")
		}
		if r >= len(m.visible) {
			b.WriteString("  " + pointer + cGreen.Render(fmt.Sprintf("+ new label %q", strings.TrimSpace(m.filter))) + "\n")
			continue
		}
		i := m.visible[r]
		box := ""
		if m.multi {
			box = cDim.Render("[ ] ")
			if m.selected[i] {
				box = cGreen.Render("[x] ")
			}
		}
		label := m.items[i].label
		if r == m.cursor {
			label = cBold.Render(label)
		}
		line := "  " + pointer + box + label
		if m.items[i].hint != "" {
			line += "  " + cDim.Render(m.items[i].hint)
		}
		b.WriteString(line + "\n")
	}
	if rows == 0 {
		b.WriteString(cYellow.Render("    no matches") + "\n")
	} else if rows > pickerRows {
		b.WriteString(cDim.Render(fmt.Sprintf("    … %d of %d", min(start+pickerRows, rows), rows)) + "\n")
	}
	if m.multi {
		var chosen []string
		for i, it := range m.items {
			if m.selected[i] {
				chosen = append(chosen, it.label)
			}
		}
		chosen = append(chosen, m.custom...)
		if len(chosen) > 0 {
			b.WriteString(cGreen.Render("  selected: ") + strings.Join(chosen, ", ") + "\n")
		}
		b.WriteString(cDim.Render("  type to filter · tab/space toggle · enter confirm · esc cancel") + "\n")
	} else {
		b.WriteString(cDim.Render("  type to filter · ↑↓ move · enter pick · esc cancel") + "\n")
	}
	return b.String()
}

func runPicker(title string, items []pickItem, multi, allowCustom bool, initial int, preselect ...int) (pickResult, error) {
	m := pickerModel{
		title:       title,
		items:       items,
		multi:       multi,
		allowCustom: allowCustom,
		selected:    map[int]bool{},
	}
	for _, i := range preselect {
		m.selected[i] = true
	}
	m.refilter()
	if initial > 0 && initial < len(items) {
		m.cursor = initial
	}
	out, err := tea.NewProgram(m).Run()
	if err != nil {
		return pickResult{cancelled: true}, err
	}
	return out.(pickerModel).result, nil
}

func pickOne(title string, items []pickItem, initial int) (int, error) {
	r, err := runPicker(title, items, false, false, initial)
	if err != nil {
		return -1, err
	}
	if r.cancelled || len(r.indices) == 0 {
		return -1, errCancelled
	}
	return r.indices[0], nil
}
