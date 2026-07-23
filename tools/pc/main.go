package main

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

const (
	refreshRate = 2 * time.Second
	innerWidth  = 68
	barWidth    = 24
	historyLen  = 40
)

var (
	styleTitle  = lipgloss.NewStyle().Bold(true)
	styleDim    = lipgloss.NewStyle().Faint(true)
	styleGood   = lipgloss.NewStyle().Foreground(lipgloss.Color("2"))
	styleWarn   = lipgloss.NewStyle().Foreground(lipgloss.Color("3"))
	styleBad    = lipgloss.NewStyle().Foreground(lipgloss.Color("1"))
	styleAccent = lipgloss.NewStyle().Foreground(lipgloss.Color("6"))
	styleKey    = lipgloss.NewStyle().Foreground(lipgloss.Color("6")).Bold(true)
	styleSel    = lipgloss.NewStyle().Reverse(true)
)

type refreshMsg struct{}

type actionMsg struct {
	tab   string
	label string
	err   error
}

type tabModel interface {
	name() string
	init() tea.Cmd
	update(msg tea.Msg) (tabModel, tea.Cmd)
	view() string
	hints() []string
}

func atoiLoose(s string) int {
	s = strings.TrimSpace(s)
	if i := strings.IndexByte(s, '.'); i >= 0 {
		s = s[:i]
	}
	n, err := strconv.Atoi(s)
	if err != nil {
		return 0
	}
	return n
}

func run(name string, args ...string) (string, error) {
	out, err := exec.Command(name, args...).CombinedOutput()
	return string(out), err
}

func execCmd(tab, label, name string, args ...string) tea.Cmd {
	return func() tea.Msg {
		out, err := run(name, args...)
		if err != nil {
			return actionMsg{tab: tab, label: label, err: fmt.Errorf("%s", strings.TrimSpace(out))}
		}
		return actionMsg{tab: tab, label: label}
	}
}

func sudoCmd(tab, label string, args ...string) tea.Cmd {
	return func() tea.Msg {
		out, err := run("sudo", append([]string{"-n"}, args...)...)
		if err != nil {
			if strings.Contains(out, "password") {
				return actionMsg{tab: tab, label: label, err: fmt.Errorf("sudo needs a password — run `sudo -v` in another terminal first")}
			}
			return actionMsg{tab: tab, label: label, err: fmt.Errorf("%s", strings.TrimSpace(out))}
		}
		return actionMsg{tab: tab, label: label}
	}
}

func bar(val, maxVal int, style lipgloss.Style) string {
	pct := 0
	if maxVal > 0 {
		pct = val * 100 / maxVal
	}
	pct = min(pct, 100)
	filled := pct * barWidth / 100
	if filled == 0 && val > 0 {
		filled = 1
	}
	return style.Render(strings.Repeat("█", filled)) +
		styleDim.Render(strings.Repeat("─", barWidth-filled))
}

func gaugeRow(label string, val, maxVal int, style lipgloss.Style, value string, hist []int, histMax int) string {
	pct := 0
	if maxVal > 0 {
		pct = min(val*100/maxVal, 100)
	}
	spark := ""
	if hist != nil {
		spark = styleDim.Render(sparkline(hist, histMax))
	}
	return fmt.Sprintf("  %s %s %s  %s%s",
		styleDim.Render(fmt.Sprintf("%-6s", label)),
		bar(val, maxVal, style),
		style.Render(fmt.Sprintf("%3d%%", pct)),
		fmt.Sprintf("%-16s", value),
		spark)
}

func heatStyle(val, warn, hot int) lipgloss.Style {
	switch {
	case val >= hot:
		return styleBad
	case val >= warn:
		return styleWarn
	default:
		return styleGood
	}
}

func sparkline(hist []int, maxVal int) string {
	blocks := []rune("▁▂▃▄▅▆▇█")
	var b strings.Builder
	for i := max(0, len(hist)-historyLen); i < len(hist); i++ {
		idx := 0
		if maxVal > 0 {
			idx = hist[i] * (len(blocks) - 1) / maxVal
		}
		b.WriteRune(blocks[min(idx, len(blocks)-1)])
	}
	return b.String()
}

func section(title string) string {
	rule := innerWidth - lipgloss.Width(title) - 6
	if rule < 0 {
		rule = 0
	}
	return styleDim.Render("  ── ") + styleTitle.Render(title) + " " + styleDim.Render(strings.Repeat("─", rule))
}

func keyHint(key, desc string) string {
	return styleKey.Render(key) + " " + styleDim.Render(desc)
}

func statusLine(message string, isErr bool) string {
	if message == "" {
		return ""
	}
	style, icon := styleGood, "✓ "
	if isErr {
		style, icon = styleWarn, "▲ "
	}
	return "  " + style.Render(icon+message) + "\n"
}

type rootTickMsg time.Time

func rootTick() tea.Cmd {
	return tea.Tick(refreshRate, func(t time.Time) tea.Msg { return rootTickMsg(t) })
}

type rootModel struct {
	tabs   []tabModel
	inited []bool
	active int
}

func newRoot(start int) rootModel {
	tabs := []tabModel{newGpuTab(), newProcTab(), newRgbTab(), newAudioTab(), newSysTab()}
	inited := make([]bool, len(tabs))
	inited[start] = true
	return rootModel{tabs: tabs, inited: inited, active: start}
}

func (m rootModel) Init() tea.Cmd {
	return tea.Batch(m.tabs[m.active].init(), rootTick())
}

func (m rootModel) switchTo(i int) (rootModel, tea.Cmd) {
	if i < 0 {
		i = len(m.tabs) - 1
	}
	i %= len(m.tabs)
	m.active = i
	var cmd tea.Cmd
	if !m.inited[i] {
		m.inited[i] = true
		cmd = m.tabs[i].init()
	}
	return m, cmd
}

func (m rootModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case rootTickMsg:
		t, cmd := m.tabs[m.active].update(refreshMsg{})
		m.tabs[m.active] = t
		return m, tea.Batch(cmd, rootTick())

	case tea.KeyMsg:
		switch msg.String() {
		case "q", "ctrl+c", "esc":
			return m, tea.Quit
		case "tab":
			return m.switchTo(m.active + 1)
		case "shift+tab":
			return m.switchTo(m.active - 1)
		case "1", "2", "3", "4", "5":
			return m.switchTo(int(msg.String()[0] - '1'))
		}
		t, cmd := m.tabs[m.active].update(msg)
		m.tabs[m.active] = t
		return m, cmd

	default:
		var cmds []tea.Cmd
		for i, t := range m.tabs {
			nt, cmd := t.update(msg)
			m.tabs[i] = nt
			if cmd != nil {
				cmds = append(cmds, cmd)
			}
		}
		return m, tea.Batch(cmds...)
	}
}

func (m rootModel) View() string {
	var b strings.Builder
	b.WriteString("\n  ")
	for i, t := range m.tabs {
		label := fmt.Sprintf("%d %s", i+1, t.name())
		if i == m.active {
			b.WriteString(styleAccent.Render("▌") + styleKey.Render(label))
		} else {
			b.WriteString(styleDim.Render(" " + label))
		}
		b.WriteString("   ")
	}
	b.WriteString("\n")
	b.WriteString(m.tabs[m.active].view())
	b.WriteString("\n  " + strings.Join(m.tabs[m.active].hints(), "   ") + "\n")
	b.WriteString("  " + keyHint("⇥/1-5", "switch tab") + "   " + keyHint("q", "quit") + "\n")
	return b.String()
}

func startTab() int {
	arg := filepath.Base(os.Args[0])
	if len(os.Args) > 1 {
		arg = os.Args[1]
	}
	switch arg {
	case "proc", "ram", "mem":
		return 1
	case "rgb":
		return 2
	case "audio", "media", "bt":
		return 3
	case "sys", "system":
		return 4
	}
	return 0
}

func main() {
	p := tea.NewProgram(newRoot(startTab()), tea.WithAltScreen())
	if _, err := p.Run(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
