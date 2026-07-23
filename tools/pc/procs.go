package main

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"syscall"

	tea "github.com/charmbracelet/bubbletea"
)

var protectedProcs = map[string]bool{
	"kwin_wayland":    true,
	"kwin_x11":        true,
	"Xwayland":        true,
	"Xorg":            true,
	"Hyprland":        true,
	"sway":            true,
	"gnome-shell":     true,
	"niri":            true,
	"river":           true,
	"plasmashell":     true,
	"ksmserver":       true,
	"kded6":           true,
	"kded5":           true,
	"kwalletd6":       true,
	"kglobalacceld":   true,
	"systemd":         true,
	"init":            true,
	"dbus-daemon":     true,
	"dbus-broker":     true,
	"dbus-broker-lau": true,
	"pipewire":        true,
	"pipewire-pulse":  true,
	"wireplumber":     true,
	"sddm":            true,
	"sddm-helper":     true,
}

type procEntry struct {
	pid       int
	cmd       string
	rssKB     int
	cpu       int
	protected bool
}

type procListMsg struct {
	list      []procEntry
	memUsedKB int
	memTotKB  int
	err       error
}

type procTab struct {
	list       []procEntry
	memUsedKB  int
	memTotKB   int
	sel        int
	killArmed  int
	killSignal syscall.Signal
	message    string
	messageErr bool
	ready      bool
}

func newProcTab() tabModel { return procTab{} }

func (m procTab) name() string { return "proc" }

func (m procTab) init() tea.Cmd { return fetchProcList }

func meminfoKB() (used, total int) {
	data, err := os.ReadFile("/proc/meminfo")
	if err != nil {
		return 0, 0
	}
	avail := 0
	for _, line := range strings.Split(string(data), "\n") {
		fields := strings.Fields(line)
		if len(fields) < 2 {
			continue
		}
		switch fields[0] {
		case "MemTotal:":
			total = atoiLoose(fields[1])
		case "MemAvailable:":
			avail = atoiLoose(fields[1])
		}
	}
	return total - avail, total
}

func fetchProcList() tea.Msg {
	out, err := run("ps", "-eo", "pid,rss,pcpu,user:32,comm", "--sort=-rss")
	if err != nil {
		return procListMsg{err: fmt.Errorf("ps: %s", strings.TrimSpace(out))}
	}
	self := os.Getpid()
	user := os.Getenv("USER")
	var list []procEntry
	for _, line := range strings.Split(out, "\n")[1:] {
		fields := strings.Fields(line)
		if len(fields) < 5 {
			continue
		}
		pid, err := strconv.Atoi(fields[0])
		if err != nil || pid == self {
			continue
		}
		rss := atoiLoose(fields[1])
		if rss == 0 || fields[3] != user {
			continue
		}
		cmd := strings.Join(fields[4:], " ")
		list = append(list, procEntry{
			pid:       pid,
			cmd:       cmd,
			rssKB:     rss,
			cpu:       atoiLoose(fields[2]),
			protected: protectedProcs[cmd],
		})
		if len(list) == 18 {
			break
		}
	}
	used, total := meminfoKB()
	return procListMsg{list: list, memUsedKB: used, memTotKB: total}
}

func humanKB(kb int) string {
	if kb >= 1<<20 {
		return fmt.Sprintf("%.1fG", float64(kb)/(1<<20))
	}
	return fmt.Sprintf("%dM", kb/1024)
}

func (m procTab) update(msg tea.Msg) (tabModel, tea.Cmd) {
	switch msg := msg.(type) {
	case refreshMsg:
		return m, fetchProcList

	case procListMsg:
		if msg.err != nil {
			m.message = msg.err.Error()
			m.messageErr = true
			return m, nil
		}
		m.list = msg.list
		m.memUsedKB = msg.memUsedKB
		m.memTotKB = msg.memTotKB
		if m.sel >= len(m.list) {
			m.sel = max(0, len(m.list)-1)
		}
		m.ready = true
		return m, nil

	case actionMsg:
		if msg.tab != "proc" {
			return m, nil
		}
		if msg.err != nil {
			m.message = msg.label + " failed: " + msg.err.Error()
			m.messageErr = true
		} else {
			m.message = msg.label
			m.messageErr = false
		}
		return m, fetchProcList

	case tea.KeyMsg:
		return m.handleKey(msg)
	}
	return m, nil
}

func (m procTab) kill(sig syscall.Signal, verb string) (tabModel, tea.Cmd) {
	if len(m.list) == 0 {
		return m, nil
	}
	target := m.list[m.sel]
	if target.protected {
		m.killArmed = 0
		m.message = target.cmd + " is session-critical — killing it can end your session, refusing"
		m.messageErr = true
		return m, nil
	}
	if m.killArmed == target.pid && m.killSignal == sig {
		m.killArmed = 0
		err := syscall.Kill(target.pid, sig)
		return m, func() tea.Msg {
			return actionMsg{tab: "proc", label: fmt.Sprintf("%s %s (%d)", verb, target.cmd, target.pid), err: err}
		}
	}
	m.killArmed = target.pid
	m.killSignal = sig
	m.message = fmt.Sprintf("press again to %s %s (%d)", verb, target.cmd, target.pid)
	m.messageErr = true
	return m, nil
}

func (m procTab) handleKey(msg tea.KeyMsg) (tabModel, tea.Cmd) {
	key := msg.String()
	if key != "x" && key != "X" {
		m.killArmed = 0
	}
	switch key {
	case "j", "down":
		if m.sel < len(m.list)-1 {
			m.sel++
		}
	case "k", "up":
		if m.sel > 0 {
			m.sel--
		}
	case "g":
		m.sel = 0
	case "x":
		return m.kill(syscall.SIGTERM, "terminated")
	case "X":
		return m.kill(syscall.SIGKILL, "force-killed")
	case "r":
		return m, fetchProcList
	}
	return m, nil
}

func (m procTab) view() string {
	if !m.ready {
		return "\n  " + styleDim.Render("loading processes…") + "\n"
	}
	var b strings.Builder

	b.WriteString("\n" + section("memory") + "\n\n")
	usedStyle := heatStyle(m.memUsedKB, m.memTotKB*70/100, m.memTotKB*90/100)
	b.WriteString(gaugeRow("ram", m.memUsedKB, m.memTotKB, usedStyle,
		fmt.Sprintf("%s / %s", humanKB(m.memUsedKB), humanKB(m.memTotKB)), nil, 0) + "\n")

	b.WriteString("\n" + section("your processes · by memory") + "\n\n")
	b.WriteString("  " + styleDim.Render(fmt.Sprintf(" %-24s %8s %8s %5s ", "command", "pid", "mem", "cpu")) + "\n")
	for i, p := range m.list {
		line := fmt.Sprintf(" %-24s %8d %8s %4d%% ", p.cmd, p.pid, humanKB(p.rssKB), p.cpu)
		switch {
		case i == m.sel:
			line = styleSel.Render(line)
		case p.protected:
			line = styleDim.Render(line)
		}
		if p.protected {
			line += styleDim.Render(" 🔒 session")
		}
		b.WriteString("  " + line + "\n")
	}

	b.WriteString("\n" + statusLine(m.message, m.messageErr))
	return b.String()
}

func (m procTab) hints() []string {
	return []string{
		keyHint("j/k", "select"),
		keyHint("x", "terminate"),
		keyHint("X", "force kill"),
		keyHint("r", "refresh"),
	}
}
