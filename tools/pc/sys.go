package main

import (
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"

	tea "github.com/charmbracelet/bubbletea"
)

type tempEntry struct {
	label string
	val   int
}

type dispEntry struct {
	num        int
	model      string
	brightness int
}

type sessEntry struct {
	name    string
	path    string
	current bool
}

type tempsMsg []tempEntry

type displaysMsg []dispEntry

type sysTab struct {
	temps       []tempEntry
	displays    []dispEntry
	sessions    []sessEntry
	sel         int
	loadingDisp bool
	armedLogout bool
	message     string
	messageErr  bool
}

func newSysTab() tabModel {
	return sysTab{sessions: fetchSessions(), loadingDisp: true}
}

func (m sysTab) name() string { return "sys" }

func (m sysTab) init() tea.Cmd {
	return tea.Batch(fetchTemps, fetchDisplays)
}

func fetchSessions() []sessEntry {
	current := strings.ToLower(os.Getenv("XDG_CURRENT_DESKTOP"))
	desktopAlias := map[string]string{"kde": "plasma"}
	if alias, ok := desktopAlias[current]; ok {
		current = alias
	}
	files, _ := filepath.Glob("/usr/share/wayland-sessions/*.desktop")
	var sessions []sessEntry
	for _, f := range files {
		data, err := os.ReadFile(f)
		if err != nil {
			continue
		}
		name := strings.TrimSuffix(filepath.Base(f), ".desktop")
		for _, line := range strings.Split(string(data), "\n") {
			if display, found := strings.CutPrefix(line, "Name="); found {
				name = display
				break
			}
		}
		base := strings.TrimSuffix(filepath.Base(f), ".desktop")
		sessions = append(sessions, sessEntry{
			name:    name,
			path:    f,
			current: strings.Contains(base, current) || strings.Contains(current, base),
		})
	}
	return sessions
}

var tempRe = regexp.MustCompile(`^([^:]{1,30}):\s+\+([0-9.]+)°C`)

func fetchTemps() tea.Msg {
	out, err := run("sensors")
	if err != nil {
		return tempsMsg(nil)
	}
	var temps []tempEntry
	chip := ""
	for _, line := range strings.Split(out, "\n") {
		if line == "" {
			chip = ""
			continue
		}
		if !strings.Contains(line, ":") {
			chip = line
			continue
		}
		if match := tempRe.FindStringSubmatch(line); match != nil {
			label := strings.TrimSpace(match[1])
			if chip != "" {
				label = chip + " · " + label
			}
			temps = append(temps, tempEntry{label: label, val: atoiLoose(match[2])})
		}
		if len(temps) == 10 {
			break
		}
	}
	return tempsMsg(temps)
}

var (
	dispRe   = regexp.MustCompile(`^Display (\d+)`)
	monRe    = regexp.MustCompile(`Monitor:\s+(.+)`)
	brightRe = regexp.MustCompile(`current value =\s*(\d+)`)
)

func fetchDisplays() tea.Msg {
	out, err := run("ddcutil", "detect", "--brief")
	if err != nil {
		return displaysMsg(nil)
	}
	var displays []dispEntry
	for _, line := range strings.Split(out, "\n") {
		if match := dispRe.FindStringSubmatch(line); match != nil {
			num, _ := strconv.Atoi(match[1])
			displays = append(displays, dispEntry{num: num, brightness: -1})
		} else if match := monRe.FindStringSubmatch(line); match != nil && len(displays) > 0 {
			displays[len(displays)-1].model = strings.TrimSpace(match[1])
		}
	}
	for i, d := range displays {
		out, err := run("ddcutil", "getvcp", "10", "--display", strconv.Itoa(d.num))
		if err != nil {
			continue
		}
		if match := brightRe.FindStringSubmatch(out); match != nil {
			displays[i].brightness = atoiLoose(match[1])
		}
	}
	return displaysMsg(displays)
}

func setSessionCmd(s sessEntry) tea.Cmd {
	script := fmt.Sprintf(`sed -i 's|^Session=.*|Session=%s|' /var/lib/sddm/state.conf`, s.path)
	return sudoCmd("sys", "next login → "+s.name+" (press L to log out)", "sh", "-c", script)
}

func (m sysTab) update(msg tea.Msg) (tabModel, tea.Cmd) {
	switch msg := msg.(type) {
	case refreshMsg:
		return m, fetchTemps

	case tempsMsg:
		m.temps = msg
		return m, nil

	case displaysMsg:
		m.displays = msg
		m.loadingDisp = false
		return m, nil

	case actionMsg:
		if msg.tab != "sys" {
			return m, nil
		}
		if msg.err != nil {
			m.message = msg.label + " failed: " + msg.err.Error()
			m.messageErr = true
		} else {
			m.message = msg.label
			m.messageErr = false
		}
		return m, nil

	case tea.KeyMsg:
		return m.handleKey(msg)
	}
	return m, nil
}

func (m sysTab) handleKey(msg tea.KeyMsg) (tabModel, tea.Cmd) {
	key := msg.String()
	if key != "L" {
		m.armedLogout = false
	}
	total := len(m.displays) + len(m.sessions)
	switch key {
	case "j", "down":
		if m.sel < total-1 {
			m.sel++
		}
	case "k", "up":
		if m.sel > 0 {
			m.sel--
		}

	case "+", "=", "-":
		if m.sel >= len(m.displays) {
			break
		}
		d := m.displays[m.sel]
		if d.brightness < 0 {
			break
		}
		step := 10
		if key == "-" {
			step = -10
		}
		target := min(max(d.brightness+step, 0), 100)
		m.displays[m.sel].brightness = target
		return m, execCmd("sys", fmt.Sprintf("display %d brightness → %d%%", d.num, target),
			"ddcutil", "setvcp", "10", strconv.Itoa(target), "--display", strconv.Itoa(d.num))

	case "enter":
		if i := m.sel - len(m.displays); i >= 0 && i < len(m.sessions) {
			return m, setSessionCmd(m.sessions[i])
		}

	case "L":
		if !m.armedLogout {
			m.armedLogout = true
			m.message = "press L again to log out (this ends your session)"
			m.messageErr = true
			break
		}
		m.armedLogout = false
		return m, execCmd("sys", "logging out", "loginctl", "terminate-session", os.Getenv("XDG_SESSION_ID"))

	case "r":
		m.loadingDisp = true
		return m, tea.Batch(fetchTemps, fetchDisplays)
	}
	return m, nil
}

func (m sysTab) view() string {
	var b strings.Builder

	b.WriteString("\n" + section("temperatures") + "\n\n")
	if len(m.temps) == 0 {
		b.WriteString("  " + styleDim.Render("no sensors data") + "\n")
	}
	for i := 0; i < len(m.temps); i += 2 {
		left := m.temps[i]
		row := fmt.Sprintf("  %-26s %s", left.label, heatStyle(left.val, 60, 80).Render(fmt.Sprintf("%3d°C", left.val)))
		if i+1 < len(m.temps) {
			right := m.temps[i+1]
			row += fmt.Sprintf("    %-26s %s", right.label, heatStyle(right.val, 60, 80).Render(fmt.Sprintf("%3d°C", right.val)))
		}
		b.WriteString(row + "\n")
	}

	b.WriteString("\n" + section("displays") + "\n\n")
	switch {
	case m.loadingDisp:
		b.WriteString("  " + styleDim.Render("detecting displays (ddcutil is slow)…") + "\n")
	case len(m.displays) == 0:
		b.WriteString("  " + styleDim.Render("no ddc-capable displays found") + "\n")
	default:
		for i, d := range m.displays {
			value := "  n/a"
			barStr := bar(0, 100, styleAccent)
			if d.brightness >= 0 {
				value = fmt.Sprintf("%3d%%", d.brightness)
				barStr = bar(d.brightness, 100, styleAccent)
			}
			line := fmt.Sprintf(" %-28s %s %s ", d.model, barStr, value)
			if i == m.sel {
				line = styleSel.Render(line)
			}
			b.WriteString("  " + line + "\n")
		}
	}

	b.WriteString("\n" + section("session") + "\n\n")
	for i, s := range m.sessions {
		marker := styleDim.Render("○")
		if s.current {
			marker = styleAccent.Render("●")
		}
		line := fmt.Sprintf(" %-30s ", s.name)
		if len(m.displays)+i == m.sel {
			line = styleSel.Render(line)
		}
		suffix := ""
		if s.current {
			suffix = styleDim.Render("current")
		}
		b.WriteString("  " + marker + line + suffix + "\n")
	}
	b.WriteString("\n  " + styleDim.Render("⏎ sets the session for next login · compositors can't be swapped live") + "\n")

	b.WriteString("\n" + statusLine(m.message, m.messageErr))
	return b.String()
}

func (m sysTab) hints() []string {
	return []string{
		keyHint("j/k", "select"),
		keyHint("+/-", "brightness"),
		keyHint("⏎", "set session"),
		keyHint("L", "logout"),
		keyHint("r", "rescan"),
	}
}
