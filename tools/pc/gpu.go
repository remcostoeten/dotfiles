package main

import (
	"fmt"
	"strconv"
	"strings"
	"syscall"

	tea "github.com/charmbracelet/bubbletea"
)

var fanModes = []string{"auto", "40", "60", "80", "100"}

type gpuStats struct {
	name       string
	pstate     string
	temp       int
	fan        int
	power      int
	powerLimit int
	powerDef   int
	util       int
	memUsed    int
	memTotal   int
	clock      int
	clockMax   int
	throttle   []string
}

type gpuProc struct {
	pid  int
	kind string
	sm   int
	mem  int
	cmd  string
}

type gpuStatsMsg struct {
	stats gpuStats
	procs []gpuProc
	err   error
}

type gpuTab struct {
	stats      gpuStats
	procs      []gpuProc
	utilHist   []int
	powerHist  []int
	tempHist   []int
	sel        int
	message    string
	messageErr bool
	clockCap   int
	fanIdx     int
	killArmed  int
	ready      bool
}

func newGpuTab() tabModel { return gpuTab{} }

func (m gpuTab) name() string { return "gpu" }

func (m gpuTab) init() tea.Cmd { return fetchGpuStats }

func fetchGpuStats() tea.Msg {
	out, err := run("nvidia-smi",
		"--query-gpu=name,pstate,temperature.gpu,fan.speed,power.draw,power.limit,power.default_limit,utilization.gpu,memory.used,memory.total,clocks.gr,clocks.max.gr",
		"--format=csv,noheader,nounits")
	if err != nil {
		return gpuStatsMsg{err: fmt.Errorf("nvidia-smi: %s", strings.TrimSpace(out))}
	}
	fields := strings.Split(strings.TrimSpace(out), ",")
	if len(fields) < 12 {
		return gpuStatsMsg{err: fmt.Errorf("unexpected nvidia-smi output")}
	}
	s := gpuStats{
		name:       strings.TrimSpace(fields[0]),
		pstate:     strings.TrimSpace(fields[1]),
		temp:       atoiLoose(fields[2]),
		fan:        atoiLoose(fields[3]),
		power:      atoiLoose(fields[4]),
		powerLimit: atoiLoose(fields[5]),
		powerDef:   atoiLoose(fields[6]),
		util:       atoiLoose(fields[7]),
		memUsed:    atoiLoose(fields[8]),
		memTotal:   atoiLoose(fields[9]),
		clock:      atoiLoose(fields[10]),
		clockMax:   atoiLoose(fields[11]),
		throttle:   fetchThrottle(),
	}
	return gpuStatsMsg{stats: s, procs: fetchGpuProcs()}
}

func fetchThrottle() []string {
	out, _ := run("nvidia-smi", "-q")
	var reasons []string
	inSection := false
	for _, line := range strings.Split(out, "\n") {
		trimmed := strings.TrimSpace(line)
		if strings.Contains(trimmed, "Clocks Event Reasons") {
			inSection = true
			continue
		}
		if !inSection {
			continue
		}
		indent := len(line) - len(strings.TrimLeft(line, " "))
		if indent <= 4 && trimmed != "" {
			break
		}
		key, val, found := strings.Cut(trimmed, ":")
		if !found {
			continue
		}
		key = strings.TrimSpace(key)
		if strings.TrimSpace(val) == "Active" && key != "Idle" {
			reasons = append(reasons, key)
		}
	}
	return reasons
}

func fetchGpuProcs() []gpuProc {
	out, _ := run("nvidia-smi", "pmon", "-c", "1")
	var procs []gpuProc
	for _, line := range strings.Split(out, "\n") {
		fields := strings.Fields(line)
		if len(fields) < 9 || fields[0] == "#" {
			continue
		}
		pid, err := strconv.Atoi(fields[1])
		if err != nil {
			continue
		}
		comm, _ := run("ps", "-p", fields[1], "-o", "comm=")
		comm = strings.TrimSpace(comm)
		if comm == "" {
			continue
		}
		procs = append(procs, gpuProc{
			pid:  pid,
			kind: fields[2],
			sm:   atoiLoose(fields[3]),
			mem:  atoiLoose(fields[4]),
			cmd:  comm,
		})
	}
	for i := range procs {
		for j := i + 1; j < len(procs); j++ {
			if procs[j].sm > procs[i].sm {
				procs[i], procs[j] = procs[j], procs[i]
			}
		}
	}
	return procs
}

const fanScript = `
import ctypes, sys
target = sys.argv[1]
nvml = ctypes.CDLL("libnvidia-ml.so.1")
assert nvml.nvmlInit_v2() == 0
dev = ctypes.c_void_p()
assert nvml.nvmlDeviceGetHandleByIndex_v2(0, ctypes.byref(dev)) == 0
n = ctypes.c_uint()
nvml.nvmlDeviceGetNumFans(dev, ctypes.byref(n))
for i in range(n.value):
    if target == "auto":
        nvml.nvmlDeviceSetDefaultFanSpeed_v2(dev, i)
    else:
        nvml.nvmlDeviceSetFanSpeed_v2(dev, i, int(target))
`

func setFans(mode string) tea.Cmd {
	return sudoCmd("gpu", "fans → "+mode, "python3", "-c", fanScript, mode)
}

func push(hist []int, v int) []int {
	hist = append(hist, v)
	if len(hist) > historyLen {
		hist = hist[len(hist)-historyLen:]
	}
	return hist
}

func (m gpuTab) update(msg tea.Msg) (tabModel, tea.Cmd) {
	switch msg := msg.(type) {
	case refreshMsg:
		return m, fetchGpuStats

	case gpuStatsMsg:
		if msg.err != nil {
			m.message = msg.err.Error()
			m.messageErr = true
			return m, nil
		}
		m.stats = msg.stats
		m.procs = msg.procs
		m.utilHist = push(m.utilHist, msg.stats.util)
		m.powerHist = push(m.powerHist, msg.stats.power)
		m.tempHist = push(m.tempHist, msg.stats.temp)
		if m.sel >= len(m.procs) {
			m.sel = max(0, len(m.procs)-1)
		}
		m.ready = true
		return m, nil

	case actionMsg:
		if msg.tab != "gpu" {
			return m, nil
		}
		if msg.err != nil {
			m.message = msg.label + " failed: " + msg.err.Error()
			m.messageErr = true
		} else {
			m.message = msg.label
			m.messageErr = false
		}
		return m, fetchGpuStats

	case tea.KeyMsg:
		return m.handleKey(msg)
	}
	return m, nil
}

func (m gpuTab) handleKey(msg tea.KeyMsg) (tabModel, tea.Cmd) {
	if msg.String() != "x" {
		m.killArmed = 0
	}
	switch msg.String() {
	case "j", "down":
		if m.sel < len(m.procs)-1 {
			m.sel++
		}
	case "k", "up":
		if m.sel > 0 {
			m.sel--
		}

	case "]":
		target := min(m.stats.powerLimit+10, 220)
		return m, sudoCmd("gpu", fmt.Sprintf("power limit → %dW", target), "nvidia-smi", "-pl", strconv.Itoa(target))
	case "[":
		target := max(m.stats.powerLimit-10, 100)
		return m, sudoCmd("gpu", fmt.Sprintf("power limit → %dW", target), "nvidia-smi", "-pl", strconv.Itoa(target))

	case "}":
		base := m.clockCap
		if base == 0 {
			base = m.stats.clockMax
		}
		m.clockCap = min(base+100, m.stats.clockMax)
		return m, sudoCmd("gpu", fmt.Sprintf("clock cap → %dMHz", m.clockCap), "nvidia-smi", "-lgc", fmt.Sprintf("210,%d", m.clockCap))
	case "{":
		base := m.clockCap
		if base == 0 {
			base = m.stats.clockMax
		}
		m.clockCap = max(base-100, 600)
		return m, sudoCmd("gpu", fmt.Sprintf("clock cap → %dMHz", m.clockCap), "nvidia-smi", "-lgc", fmt.Sprintf("210,%d", m.clockCap))

	case "f":
		m.fanIdx = (m.fanIdx + 1) % len(fanModes)
		return m, setFans(fanModes[m.fanIdx])

	case "r":
		m.clockCap = 0
		m.fanIdx = 0
		return m, tea.Batch(
			sudoCmd("gpu", "power limit → default", "nvidia-smi", "-pl", strconv.Itoa(m.stats.powerDef)),
			sudoCmd("gpu", "clocks → unlocked", "nvidia-smi", "-rgc"),
			setFans("auto"),
		)

	case "x":
		if len(m.procs) == 0 {
			break
		}
		target := m.procs[m.sel]
		if protectedProcs[target.cmd] {
			m.killArmed = 0
			m.message = target.cmd + " is session-critical — killing it would end your session"
			m.messageErr = true
			break
		}
		if m.killArmed == target.pid {
			m.killArmed = 0
			err := syscall.Kill(target.pid, syscall.SIGTERM)
			return m, func() tea.Msg {
				return actionMsg{tab: "gpu", label: fmt.Sprintf("killed %s (%d)", target.cmd, target.pid), err: err}
			}
		}
		m.killArmed = target.pid
		m.message = fmt.Sprintf("press x again to kill %s (%d)", target.cmd, target.pid)
		m.messageErr = true
	}
	return m, nil
}

func (m gpuTab) view() string {
	if !m.ready {
		return "\n  " + styleDim.Render("loading gpu stats…") + "\n"
	}
	s := m.stats
	var b strings.Builder

	badges := []string{styleDim.Render("pstate " + s.pstate)}
	if m.fanIdx == 0 {
		badges = append(badges, styleDim.Render("fans auto"))
	} else {
		badges = append(badges, styleWarn.Render("fans "+fanModes[m.fanIdx]+"%"))
	}
	if m.clockCap > 0 {
		badges = append(badges, styleWarn.Render(fmt.Sprintf("clocks ≤ %d MHz", m.clockCap)))
	}
	if s.powerLimit != s.powerDef {
		badges = append(badges, styleWarn.Render(fmt.Sprintf("power capped %dW (default %dW)", s.powerLimit, s.powerDef)))
	}
	b.WriteString("\n  " + styleAccent.Render("▌") + " " + styleTitle.Render(s.name) + "   " + strings.Join(badges, styleDim.Render("  ·  ")) + "\n\n")

	b.WriteString(section("sensors") + "\n\n")
	b.WriteString(gaugeRow("temp", s.temp, 90, heatStyle(s.temp, 65, 80), fmt.Sprintf("%d°C", s.temp), m.tempHist, 90) + "\n")
	b.WriteString(gaugeRow("fan", s.fan, 100, heatStyle(s.fan, 60, 85), "duty cycle", nil, 0) + "\n")
	b.WriteString(gaugeRow("power", s.power, s.powerLimit, heatStyle(s.power, s.powerLimit*70/100, s.powerLimit*90/100), fmt.Sprintf("%dW / %dW", s.power, s.powerLimit), m.powerHist, s.powerLimit) + "\n")
	b.WriteString(gaugeRow("util", s.util, 100, styleAccent, "", m.utilHist, 100) + "\n")
	b.WriteString(gaugeRow("vram", s.memUsed, s.memTotal, styleAccent, fmt.Sprintf("%d / %d MiB", s.memUsed, s.memTotal), nil, 0) + "\n")
	b.WriteString(gaugeRow("clock", s.clock, s.clockMax, styleAccent, fmt.Sprintf("%d / %d MHz", s.clock, s.clockMax), nil, 0) + "\n\n")

	if len(s.throttle) > 0 {
		b.WriteString("  " + styleBad.Render("▲ throttling: "+strings.Join(s.throttle, ", ")) + "\n")
	} else {
		b.WriteString("  " + styleGood.Render("● no throttling") + "\n")
	}

	b.WriteString("\n" + section("processes") + "\n\n")
	if len(m.procs) == 0 {
		b.WriteString("  " + styleDim.Render("nothing is using the gpu") + "\n")
	} else {
		b.WriteString("  " + styleDim.Render(fmt.Sprintf(" %-20s %8s  %-5s %5s %6s ", "command", "pid", "type", "sm", "mem")) + "\n")
		shown := min(len(m.procs), 8)
		for i := 0; i < shown; i++ {
			p := m.procs[i]
			line := fmt.Sprintf(" %-20s %8d  %-5s %4d%% %5d%% ", p.cmd, p.pid, p.kind, p.sm, p.mem)
			if i == m.sel {
				line = styleSel.Render(line)
			}
			if protectedProcs[p.cmd] {
				line += styleDim.Render(" 🔒 session")
			}
			b.WriteString("  " + line + "\n")
		}
	}

	b.WriteString("\n" + statusLine(m.message, m.messageErr))
	return b.String()
}

func (m gpuTab) hints() []string {
	return []string{
		keyHint("[ ]", "power ±10W"),
		keyHint("{ }", "clocks ±100MHz"),
		keyHint("f", "fans"),
		keyHint("r", "reset"),
		keyHint("j/k", "select"),
		keyHint("x", "kill"),
	}
}
