// Package procs lists the current user's processes and signals them.
package procs

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"syscall"

	"pc/internal/pc/sh"
)

// protected are processes whose death ends or cripples the desktop session.
var protected = map[string]bool{
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

// Process is one of the user's processes.
type Process struct {
	PID       int
	Command   string
	RSSKB     int
	CPU       int
	Protected bool
}

// Memory is system-wide RAM and swap usage in KiB.
type Memory struct {
	UsedKB      int
	TotalKB     int
	SwapUsedKB  int
	SwapTotalKB int
}

// Source is everything the process screen needs from the machine.
type Source interface {
	List(limit int) ([]Process, error)
	Memory() Memory
	Signal(pid int, sig syscall.Signal) error
}

// Host is the Source backed by ps and /proc.
type Host struct{}

// List returns up to limit of the user's processes, largest first.
func (Host) List(limit int) ([]Process, error) {
	out, err := sh.Run("ps", "-eo", "pid,rss,pcpu,user:32,comm", "--sort=-rss")
	if err != nil {
		return nil, fmt.Errorf("ps: %s", strings.TrimSpace(out))
	}
	return ParseList(out, os.Getenv("USER"), os.Getpid(), limit), nil
}

// Memory reads /proc/meminfo.
func (Host) Memory() Memory {
	data, err := os.ReadFile("/proc/meminfo")
	if err != nil {
		return Memory{}
	}
	return ParseMeminfo(string(data))
}

// Signal sends sig to pid.
func (Host) Signal(pid int, sig syscall.Signal) error {
	return syscall.Kill(pid, sig)
}

// IsProtected reports whether killing a command would take the session down.
func IsProtected(command string) bool {
	return protected[command]
}

// ParseList reads `ps -eo pid,rss,pcpu,user,comm` output, keeping user's own
// resident processes and skipping self.
func ParseList(out, user string, self, limit int) []Process {
	var list []Process
	lines := strings.Split(out, "\n")
	if len(lines) > 0 {
		lines = lines[1:]
	}
	for _, line := range lines {
		fields := strings.Fields(line)
		if len(fields) < 5 {
			continue
		}
		pid, err := strconv.Atoi(fields[0])
		if err != nil || pid == self {
			continue
		}
		rss := sh.Atoi(fields[1])
		if rss == 0 || fields[3] != user {
			continue
		}
		command := strings.Join(fields[4:], " ")
		list = append(list, Process{PID: pid, Command: command, RSSKB: rss, CPU: sh.Atoi(fields[2]), Protected: IsProtected(command)})
		if len(list) == limit {
			break
		}
	}
	return list
}

// ParseMeminfo derives used memory as total minus available.
func ParseMeminfo(data string) Memory {
	values := map[string]int{}
	for _, line := range strings.Split(data, "\n") {
		fields := strings.Fields(line)
		if len(fields) >= 2 {
			values[strings.TrimSuffix(fields[0], ":")] = sh.Atoi(fields[1])
		}
	}
	return Memory{
		UsedKB:      values["MemTotal"] - values["MemAvailable"],
		TotalKB:     values["MemTotal"],
		SwapUsedKB:  values["SwapTotal"] - values["SwapFree"],
		SwapTotalKB: values["SwapTotal"],
	}
}

// HumanKB formats KiB as M or G.
func HumanKB(kb int) string {
	if kb >= 1<<20 {
		return fmt.Sprintf("%.1fG", float64(kb)/(1<<20))
	}
	return fmt.Sprintf("%dM", kb/1024)
}
