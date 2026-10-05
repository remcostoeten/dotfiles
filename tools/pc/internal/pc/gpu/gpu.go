// Package gpu reads and tunes an NVIDIA card through nvidia-smi and NVML.
package gpu

import (
	"errors"
	"fmt"
	"slices"
	"strconv"
	"strings"

	"pc/internal/pc/sh"
)

const (
	MinPower    = 100
	MaxPower    = 220
	PowerStep   = 10
	MinClock    = 600
	ClockStep   = 100
	clockFloor  = 210
	statsFields = "name,pstate,temperature.gpu,fan.speed,power.draw,power.limit,power.default_limit,utilization.gpu,memory.used,memory.total,clocks.gr,clocks.max.gr"
)

// FanModes are the fan settings the fan command cycles through, "auto" first.
var FanModes = []string{"auto", "40", "60", "80", "100"}

// Stats is one sample of the card's sensors and limits.
type Stats struct {
	Name         string
	PState       string
	Temp         int
	Fan          int
	Power        int
	PowerLimit   int
	PowerDefault int
	Util         int
	MemUsed      int
	MemTotal     int
	Clock        int
	ClockMax     int
	Throttle     []string
}

// Process is a program holding a GPU context.
type Process struct {
	PID     int
	Kind    string
	SM      int
	Mem     int
	Command string
}

// Source is everything the GPU screen needs from the machine.
type Source interface {
	Read() (Stats, error)
	Processes() []Process
	SetPowerLimit(watts int) error
	SetClockCap(mhz int) error
	ResetClocks() error
	SetFans(mode string) error
}

// Host is the Source backed by the real card.
type Host struct{}

// Read samples the card.
func (Host) Read() (Stats, error) {
	out, err := sh.Run("nvidia-smi", "--query-gpu="+statsFields, "--format=csv,noheader,nounits")
	if err != nil {
		return Stats{}, ReadError(out)
	}
	stats, err := ParseStats(out)
	if err != nil {
		return Stats{}, err
	}
	report, _ := sh.Run("nvidia-smi", "-q")
	stats.Throttle = ParseThrottle(report)
	return stats, nil
}

// Processes lists GPU processes, busiest first.
func (Host) Processes() []Process {
	out, _ := sh.Run("nvidia-smi", "pmon", "-c", "1")
	return ParseProcesses(out, commandName)
}

// SetPowerLimit sets the board power limit in watts.
func (Host) SetPowerLimit(watts int) error {
	return sh.Sudo("nvidia-smi", "-pl", strconv.Itoa(watts))
}

// SetClockCap locks graphics clocks to at most mhz.
func (Host) SetClockCap(mhz int) error {
	return sh.Sudo("nvidia-smi", "-lgc", fmt.Sprintf("%d,%d", clockFloor, mhz))
}

// ResetClocks removes a clock lock.
func (Host) ResetClocks() error {
	return sh.Sudo("nvidia-smi", "-rgc")
}

// SetFans sets every fan to a fixed duty cycle, or back to "auto".
func (Host) SetFans(mode string) error {
	return sh.Sudo("python3", "-c", fanScript, mode)
}

// ErrDriverMismatch means the loaded kernel module is older than the installed
// NVIDIA libraries, which happens after a driver update until the next reboot.
var ErrDriverMismatch = errors.New("NVIDIA driver and library versions differ — reboot to load the updated driver")

// ReadError turns failed nvidia-smi output into a one-line error.
func ReadError(out string) error {
	if strings.Contains(out, "Driver/library version mismatch") {
		return ErrDriverMismatch
	}
	return fmt.Errorf("nvidia-smi: %s", strings.Join(strings.Fields(out), " "))
}

// ParseStats reads one line of nvidia-smi CSV output.
func ParseStats(out string) (Stats, error) {
	fields := strings.Split(strings.TrimSpace(out), ",")
	if len(fields) < 12 {
		return Stats{}, errors.New("unexpected nvidia-smi output")
	}
	return Stats{
		Name:         strings.TrimSpace(fields[0]),
		PState:       strings.TrimSpace(fields[1]),
		Temp:         sh.Atoi(fields[2]),
		Fan:          sh.Atoi(fields[3]),
		Power:        sh.Atoi(fields[4]),
		PowerLimit:   sh.Atoi(fields[5]),
		PowerDefault: sh.Atoi(fields[6]),
		Util:         sh.Atoi(fields[7]),
		MemUsed:      sh.Atoi(fields[8]),
		MemTotal:     sh.Atoi(fields[9]),
		Clock:        sh.Atoi(fields[10]),
		ClockMax:     sh.Atoi(fields[11]),
	}, nil
}

// ParseThrottle lists the active clock event reasons in `nvidia-smi -q`
// output, ignoring Idle.
func ParseThrottle(report string) []string {
	var reasons []string
	inSection := false
	for _, line := range strings.Split(report, "\n") {
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

// ParseProcesses reads `nvidia-smi pmon` output, resolving each pid to a
// command name and dropping the ones that have already exited.
func ParseProcesses(out string, name func(pid string) string) []Process {
	var procs []Process
	for _, line := range strings.Split(out, "\n") {
		fields := strings.Fields(line)
		if len(fields) < 9 || fields[0] == "#" {
			continue
		}
		pid, err := strconv.Atoi(fields[1])
		if err != nil {
			continue
		}
		command := name(fields[1])
		if command == "" {
			continue
		}
		procs = append(procs, Process{PID: pid, Kind: fields[2], SM: sh.Atoi(fields[3]), Mem: sh.Atoi(fields[4]), Command: command})
	}
	slices.SortStableFunc(procs, func(a, b Process) int { return b.SM - a.SM })
	return procs
}

func commandName(pid string) string {
	out, _ := sh.Run("ps", "-p", pid, "-o", "comm=")
	return strings.TrimSpace(out)
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
