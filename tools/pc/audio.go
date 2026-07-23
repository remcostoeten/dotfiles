package main

import (
	"fmt"
	"regexp"
	"strings"

	tea "github.com/charmbracelet/bubbletea"
)

type sinkEntry struct {
	name string
	desc string
	def  bool
	mute bool
	vol  int
}

type btEntry struct {
	mac       string
	name      string
	connected bool
}

type audioMsg struct {
	sinks   []sinkEntry
	bts     []btEntry
	players []string
}

type audioTab struct {
	sinks      []sinkEntry
	bts        []btEntry
	players    []string
	sel        int
	message    string
	messageErr bool
	ready      bool
}

func newAudioTab() tabModel { return audioTab{} }

func (m audioTab) name() string { return "audio" }

func (m audioTab) init() tea.Cmd { return fetchAudio }

var volRe = regexp.MustCompile(`(\d+)%`)

func fetchSinks() []sinkEntry {
	out, err := run("pactl", "list", "sinks")
	if err != nil {
		return nil
	}
	defSink, _ := run("pactl", "get-default-sink")
	defSink = strings.TrimSpace(defSink)
	var sinks []sinkEntry
	for _, block := range strings.Split(out, "Sink #")[1:] {
		var s sinkEntry
		for _, line := range strings.Split(block, "\n") {
			trimmed := strings.TrimSpace(line)
			switch {
			case strings.HasPrefix(trimmed, "Name: "):
				s.name = strings.TrimPrefix(trimmed, "Name: ")
			case strings.HasPrefix(trimmed, "Description: "):
				s.desc = strings.TrimPrefix(trimmed, "Description: ")
			case strings.HasPrefix(trimmed, "Mute: "):
				s.mute = strings.HasSuffix(trimmed, "yes")
			case strings.HasPrefix(trimmed, "Volume: ") && s.vol == 0:
				if match := volRe.FindStringSubmatch(trimmed); match != nil {
					s.vol = atoiLoose(match[1])
				}
			}
		}
		if s.name != "" {
			s.def = s.name == defSink
			sinks = append(sinks, s)
		}
	}
	return sinks
}

func fetchBt() []btEntry {
	out, err := run("bluetoothctl", "devices")
	if err != nil {
		return nil
	}
	var bts []btEntry
	for _, line := range strings.Split(out, "\n") {
		fields := strings.Fields(line)
		if len(fields) < 3 || fields[0] != "Device" {
			continue
		}
		info, _ := run("bluetoothctl", "info", fields[1])
		bts = append(bts, btEntry{
			mac:       fields[1],
			name:      strings.Join(fields[2:], " "),
			connected: strings.Contains(info, "Connected: yes"),
		})
		if len(bts) == 8 {
			break
		}
	}
	return bts
}

func fetchAudio() tea.Msg {
	var players []string
	if out, err := run("playerctl", "-a", "metadata", "--format", "{{status}}  {{playerName}}: {{artist}} — {{title}}"); err == nil {
		for _, line := range strings.Split(strings.TrimSpace(out), "\n") {
			if strings.TrimSpace(line) != "" {
				players = append(players, line)
			}
		}
	}
	return audioMsg{sinks: fetchSinks(), bts: fetchBt(), players: players}
}

func (m audioTab) update(msg tea.Msg) (tabModel, tea.Cmd) {
	switch msg := msg.(type) {
	case refreshMsg:
		return m, fetchAudio

	case audioMsg:
		m.sinks = msg.sinks
		m.bts = msg.bts
		m.players = msg.players
		total := len(m.sinks) + len(m.bts)
		if m.sel >= total {
			m.sel = max(0, total-1)
		}
		m.ready = true
		return m, nil

	case actionMsg:
		if msg.tab != "audio" {
			return m, nil
		}
		if msg.err != nil {
			m.message = msg.label + " failed: " + msg.err.Error()
			m.messageErr = true
		} else {
			m.message = msg.label
			m.messageErr = false
		}
		return m, fetchAudio

	case tea.KeyMsg:
		return m.handleKey(msg)
	}
	return m, nil
}

func (m audioTab) handleKey(msg tea.KeyMsg) (tabModel, tea.Cmd) {
	total := len(m.sinks) + len(m.bts)
	switch msg.String() {
	case "j", "down":
		if m.sel < total-1 {
			m.sel++
		}
	case "k", "up":
		if m.sel > 0 {
			m.sel--
		}

	case "enter":
		if m.sel < len(m.sinks) {
			s := m.sinks[m.sel]
			return m, execCmd("audio", "default output → "+s.desc, "pactl", "set-default-sink", s.name)
		}
		if i := m.sel - len(m.sinks); i < len(m.bts) {
			d := m.bts[i]
			if d.connected {
				return m, execCmd("audio", "disconnected "+d.name, "bluetoothctl", "disconnect", d.mac)
			}
			return m, execCmd("audio", "connected "+d.name, "bluetoothctl", "connect", d.mac)
		}

	case "+", "=":
		return m, execCmd("audio", "volume +5%", "pactl", "set-sink-volume", "@DEFAULT_SINK@", "+5%")
	case "-":
		return m, execCmd("audio", "volume -5%", "pactl", "set-sink-volume", "@DEFAULT_SINK@", "-5%")
	case "m":
		return m, execCmd("audio", "mute toggled", "pactl", "set-sink-mute", "@DEFAULT_SINK@", "toggle")

	case " ":
		return m, execCmd("audio", "play/pause", "playerctl", "play-pause")
	case ">":
		return m, execCmd("audio", "next track", "playerctl", "next")
	case "<":
		return m, execCmd("audio", "previous track", "playerctl", "previous")
	}
	return m, nil
}

func (m audioTab) view() string {
	if !m.ready {
		return "\n  " + styleDim.Render("loading audio devices…") + "\n"
	}
	var b strings.Builder

	b.WriteString("\n" + section("outputs") + "\n\n")
	if len(m.sinks) == 0 {
		b.WriteString("  " + styleDim.Render("no sinks found (is pactl installed?)") + "\n")
	}
	for i, s := range m.sinks {
		marker := styleDim.Render("○")
		if s.def {
			marker = styleAccent.Render("●")
		}
		vol := fmt.Sprintf("%3d%%", s.vol)
		if s.mute {
			vol = styleWarn.Render("MUTE")
		}
		line := fmt.Sprintf(" %-46s %s ", s.desc, vol)
		if i == m.sel {
			line = styleSel.Render(line)
		}
		b.WriteString("  " + marker + line + "\n")
	}

	b.WriteString("\n" + section("bluetooth") + "\n\n")
	if len(m.bts) == 0 {
		b.WriteString("  " + styleDim.Render("no paired devices") + "\n")
	}
	for i, d := range m.bts {
		marker := styleDim.Render("○")
		state := styleDim.Render("disconnected")
		if d.connected {
			marker = styleGood.Render("●")
			state = styleGood.Render("connected")
		}
		line := fmt.Sprintf(" %-40s ", d.name)
		if len(m.sinks)+i == m.sel {
			line = styleSel.Render(line)
		}
		b.WriteString("  " + marker + line + state + "\n")
	}

	b.WriteString("\n" + section("media") + "\n\n")
	if len(m.players) == 0 {
		b.WriteString("  " + styleDim.Render("nothing playing") + "\n")
	}
	for _, p := range m.players {
		icon := styleDim.Render("⏸")
		if strings.HasPrefix(p, "Playing") {
			icon = styleGood.Render("▶")
		}
		_, rest, _ := strings.Cut(p, "  ")
		b.WriteString("  " + icon + " " + rest + "\n")
	}

	b.WriteString("\n" + statusLine(m.message, m.messageErr))
	return b.String()
}

func (m audioTab) hints() []string {
	return []string{
		keyHint("j/k", "select"),
		keyHint("⏎", "set default / (dis)connect"),
		keyHint("+/-", "volume"),
		keyHint("m", "mute"),
		keyHint("␣", "play/pause"),
		keyHint("</>", "track"),
	}
}
