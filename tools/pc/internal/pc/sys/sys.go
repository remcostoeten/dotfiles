// Package sys reads temperatures, drives DDC/CI monitor brightness and manages
// the SDDM login session.
package sys

import (
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"

	"pc/internal/pc/sh"
)

const (
	BrightnessStep  = 10
	maxTemperatures = 24
	sessionsGlob    = "/usr/share/wayland-sessions/*.desktop"
	sddmState       = "/var/lib/sddm/state.conf"
)

// Temperature is one sensor reading.
type Temperature struct {
	Label   string
	Celsius int
}

// Display is a DDC/CI capable monitor. Brightness is -1 when unreadable.
type Display struct {
	Number     int
	Model      string
	Brightness int
}

// Session is an installed Wayland session.
type Session struct {
	Name    string
	Path    string
	Current bool
}

// Source is everything the system screen needs from the machine.
type Source interface {
	Temperatures() []Temperature
	Displays() []Display
	SetBrightness(display, percent int) error
	Sessions() []Session
	SetNextSession(s Session) error
	Logout() error
}

// Host is the Source backed by lm_sensors, ddcutil, SDDM and logind.
type Host struct{}

// Temperatures reads lm_sensors.
func (Host) Temperatures() []Temperature {
	out, err := sh.Run("sensors")
	if err != nil {
		return nil
	}
	return ParseSensors(out)
}

// Displays detects monitors and reads their brightness. ddcutil is slow.
func (Host) Displays() []Display {
	out, err := sh.Run("ddcutil", "detect", "--brief")
	if err != nil {
		return nil
	}
	displays := ParseDisplays(out)
	for i, d := range displays {
		vcp, err := sh.Run("ddcutil", "getvcp", "10", "--display", strconv.Itoa(d.Number))
		if err == nil {
			displays[i].Brightness = ParseBrightness(vcp)
		}
	}
	return displays
}

// SetBrightness sets a monitor's brightness in percent.
func (Host) SetBrightness(display, percent int) error {
	return sh.Exec("ddcutil", "setvcp", "10", strconv.Itoa(percent), "--display", strconv.Itoa(display))
}

// Sessions lists installed Wayland sessions, marking the running one.
func (Host) Sessions() []Session {
	files, _ := filepath.Glob(sessionsGlob)
	return ListSessions(files, os.ReadFile, os.Getenv("XDG_CURRENT_DESKTOP"))
}

// SetNextSession makes SDDM preselect a session at the next login.
func (Host) SetNextSession(s Session) error {
	script := fmt.Sprintf(`sed -i 's|^Session=.*|Session=%s|' %s`, s.Path, sddmState)
	return sh.Sudo("sh", "-c", script)
}

// Logout ends the current login session.
func (Host) Logout() error {
	return sh.Exec("loginctl", "terminate-session", os.Getenv("XDG_SESSION_ID"))
}

var sensorLine = regexp.MustCompile(`^([^:]{1,30}):\s+\+([0-9.]+)°C`)

// ParseSensors reads `sensors` output. The first line of each blank-separated
// block names the chip, which prefixes that block's readings in short form.
func ParseSensors(out string) []Temperature {
	var temps []Temperature
	chip, header := "", true
	for _, line := range strings.Split(out, "\n") {
		switch {
		case strings.TrimSpace(line) == "":
			chip, header = "", true
			continue
		case header:
			chip, _, _ = strings.Cut(line, "-")
			header = false
			continue
		case strings.HasPrefix(line, " "):
			continue
		}
		match := sensorLine.FindStringSubmatch(line)
		if match == nil {
			continue
		}
		label := strings.TrimSpace(match[1])
		if chip != "" {
			label = chip + " · " + label
		}
		temps = append(temps, Temperature{Label: label, Celsius: sh.Atoi(match[2])})
		if len(temps) == maxTemperatures {
			break
		}
	}
	return temps
}

var (
	displayLine    = regexp.MustCompile(`^Display (\d+)`)
	monitorLine    = regexp.MustCompile(`Monitor:\s+(.+)`)
	brightnessLine = regexp.MustCompile(`current value =\s*(\d+)`)
)

// ParseDisplays reads `ddcutil detect --brief` output.
func ParseDisplays(out string) []Display {
	var displays []Display
	for _, line := range strings.Split(out, "\n") {
		if match := displayLine.FindStringSubmatch(line); match != nil {
			number, _ := strconv.Atoi(match[1])
			displays = append(displays, Display{Number: number, Brightness: -1})
			continue
		}
		if match := monitorLine.FindStringSubmatch(line); match != nil && len(displays) > 0 {
			displays[len(displays)-1].Model = strings.TrimSpace(match[1])
		}
	}
	return displays
}

// ParseBrightness reads `ddcutil getvcp 10` output, returning -1 when absent.
func ParseBrightness(out string) int {
	if match := brightnessLine.FindStringSubmatch(out); match != nil {
		return sh.Atoi(match[1])
	}
	return -1
}

// ListSessions reads session desktop files, marking the one matching desktop.
func ListSessions(files []string, read func(string) ([]byte, error), desktop string) []Session {
	current := strings.ToLower(desktop)
	if current == "kde" {
		current = "plasma"
	}
	var sessions []Session
	for _, f := range files {
		data, err := read(f)
		if err != nil {
			continue
		}
		base := strings.TrimSuffix(filepath.Base(f), ".desktop")
		name := base
		for _, line := range strings.Split(string(data), "\n") {
			if display, found := strings.CutPrefix(line, "Name="); found {
				name = display
				break
			}
		}
		sessions = append(sessions, Session{
			Name:    name,
			Path:    f,
			Current: current != "" && (strings.Contains(base, current) || strings.Contains(current, base)),
		})
	}
	return sessions
}
