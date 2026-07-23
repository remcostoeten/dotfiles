package main

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

type rgbDevice struct {
	idx  int
	name string
	kind string
}

type rgbListMsg struct {
	devices []rgbDevice
	err     error
}

type rgbTab struct {
	devices    []rgbDevice
	sel        int
	loading    bool
	busy       bool
	message    string
	messageErr bool
	ready      bool
}

func newRgbTab() tabModel { return rgbTab{loading: true} }

func (m rgbTab) name() string { return "rgb" }

func (m rgbTab) init() tea.Cmd { return fetchRgbDevices }

var rgbDeviceRe = regexp.MustCompile(`^(\d+): (.+)$`)

func fetchRgbDevices() tea.Msg {
	out, err := run("openrgb", "--list-devices")
	if err != nil && !strings.Contains(out, ":") {
		return rgbListMsg{err: fmt.Errorf("openrgb: %s", strings.TrimSpace(out))}
	}
	var devices []rgbDevice
	for _, line := range strings.Split(out, "\n") {
		if match := rgbDeviceRe.FindStringSubmatch(line); match != nil {
			idx, _ := strconv.Atoi(match[1])
			devices = append(devices, rgbDevice{idx: idx, name: match[2]})
		} else if trimmed, found := strings.CutPrefix(strings.TrimSpace(line), "Type:"); found && len(devices) > 0 {
			devices[len(devices)-1].kind = strings.TrimSpace(trimmed)
		}
	}
	return rgbListMsg{devices: devices}
}

var rgbColors = map[string]string{
	"w": "FFFFFF",
	"r": "FF0000",
	"g": "00FF00",
	"b": "0000FF",
	"p": "AA00FF",
	"o": "FF5500",
}

func rgbApply(label string, args ...string) tea.Cmd {
	return execCmd("rgb", label, "openrgb", args...)
}

func (m rgbTab) update(msg tea.Msg) (tabModel, tea.Cmd) {
	switch msg := msg.(type) {
	case refreshMsg:
		return m, nil

	case rgbListMsg:
		m.loading = false
		m.ready = true
		if msg.err != nil {
			m.message = msg.err.Error()
			m.messageErr = true
			return m, nil
		}
		m.devices = msg.devices
		if m.sel >= len(m.devices) {
			m.sel = max(0, len(m.devices)-1)
		}
		return m, nil

	case actionMsg:
		if msg.tab != "rgb" {
			return m, nil
		}
		m.busy = false
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

func (m rgbTab) handleKey(msg tea.KeyMsg) (tabModel, tea.Cmd) {
	key := msg.String()
	if m.busy && key != "j" && key != "k" && key != "up" && key != "down" {
		m.message = "still applying previous change…"
		m.messageErr = true
		return m, nil
	}
	switch key {
	case "j", "down":
		if m.sel < len(m.devices)-1 {
			m.sel++
		}
	case "k", "up":
		if m.sel > 0 {
			m.sel--
		}
	case "R":
		m.loading = true
		return m, fetchRgbDevices

	case "x":
		if len(m.devices) == 0 {
			break
		}
		d := m.devices[m.sel]
		m.busy = true
		return m, rgbApply(d.name+" → off", "-d", strconv.Itoa(d.idx), "-c", "000000")
	case "X":
		m.busy = true
		return m, rgbApply("all rgb → off", "-c", "000000")
	case "W":
		m.busy = true
		return m, rgbApply("all rgb → white", "-c", "FFFFFF")

	case "w", "r", "g", "b", "p", "o":
		if len(m.devices) == 0 {
			break
		}
		d := m.devices[m.sel]
		m.busy = true
		return m, rgbApply(fmt.Sprintf("%s → #%s", d.name, rgbColors[key]),
			"-d", strconv.Itoa(d.idx), "-c", rgbColors[key])
	}
	return m, nil
}

func rgbSwatch(hex string) string {
	return lipgloss.NewStyle().Foreground(lipgloss.Color("#" + hex)).Render("●")
}

func (m rgbTab) view() string {
	var b strings.Builder
	b.WriteString("\n" + section("rgb devices") + "\n\n")

	switch {
	case m.loading:
		b.WriteString("  " + styleDim.Render("scanning rgb devices (openrgb is slow, hang on)…") + "\n")
	case len(m.devices) == 0:
		b.WriteString("  " + styleDim.Render("no rgb devices found") + "\n")
	default:
		for i, d := range m.devices {
			line := fmt.Sprintf(" %-12s %-48s ", strings.ToLower(d.kind), d.name)
			if i == m.sel {
				line = styleSel.Render(line)
			} else {
				line = styleAccent.Render(fmt.Sprintf(" %-12s ", strings.ToLower(d.kind))) + fmt.Sprintf("%-48s ", d.name)
			}
			b.WriteString("  " + line + "\n")
		}
		b.WriteString("\n  " + styleDim.Render("colors: ") +
			rgbSwatch("FFFFFF") + styleDim.Render(" w  ") +
			rgbSwatch("FF0000") + styleDim.Render(" r  ") +
			rgbSwatch("00FF00") + styleDim.Render(" g  ") +
			rgbSwatch("0000FF") + styleDim.Render(" b  ") +
			rgbSwatch("AA00FF") + styleDim.Render(" p  ") +
			rgbSwatch("FF5500") + styleDim.Render(" o") + "\n")
	}

	if m.busy {
		b.WriteString("\n  " + styleWarn.Render("… applying") + "\n")
	} else {
		b.WriteString("\n" + statusLine(m.message, m.messageErr))
	}
	return b.String()
}

func (m rgbTab) hints() []string {
	return []string{
		keyHint("j/k", "select"),
		keyHint("w/r/g/b/p/o", "color"),
		keyHint("x", "off"),
		keyHint("X/W", "all off/on"),
		keyHint("R", "rescan"),
	}
}
