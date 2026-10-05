// Package rgb drives lighting through the openrgb CLI.
package rgb

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"sync"

	"pc/internal/pc/sh"
)

// Device is one lighting controller.
type Device struct {
	Index int
	Name  string
	Kind  string
}

// Color is a preset reachable by a single key.
type Color struct {
	Key  string
	Name string
	Hex  string
}

// Off is the colour that turns a device dark.
const Off = "000000"

// Presets are the single-key colours.
var Presets = []Color{
	{Key: "w", Name: "White", Hex: "FFFFFF"},
	{Key: "r", Name: "Red", Hex: "FF0000"},
	{Key: "g", Name: "Green", Hex: "00FF00"},
	{Key: "b", Name: "Blue", Hex: "0000FF"},
	{Key: "p", Name: "Purple", Hex: "AA00FF"},
	{Key: "o", Name: "Orange", Hex: "FF5500"},
}

// Source is everything the RGB screen needs from the machine.
type Source interface {
	Devices() ([]Device, error)
	SetDevice(index int, hex string) error
	SetAll(hex string) error
}

// Host is the Source backed by openrgb. openrgb cannot take two writes at once,
// so writes are serialised rather than refused.
type Host struct {
	mu *sync.Mutex
}

// NewHost builds the openrgb-backed source.
func NewHost() Host {
	return Host{mu: &sync.Mutex{}}
}

// Devices lists controllers. openrgb exits non-zero on some healthy systems,
// so its output decides success.
func (h Host) Devices() ([]Device, error) {
	out, err := sh.Run("openrgb", "--list-devices")
	if err != nil && !strings.Contains(out, ":") {
		return nil, fmt.Errorf("openrgb: %s", strings.TrimSpace(out))
	}
	return ParseDevices(out), nil
}

// SetDevice sets one controller to a colour.
func (h Host) SetDevice(index int, hex string) error {
	h.mu.Lock()
	defer h.mu.Unlock()
	return sh.Exec("openrgb", "-d", strconv.Itoa(index), "-c", hex)
}

// SetAll sets every controller to a colour.
func (h Host) SetAll(hex string) error {
	h.mu.Lock()
	defer h.mu.Unlock()
	return sh.Exec("openrgb", "-c", hex)
}

var deviceLine = regexp.MustCompile(`^(\d+): (.+)$`)

// ParseDevices reads `openrgb --list-devices` output.
func ParseDevices(out string) []Device {
	var devices []Device
	for _, line := range strings.Split(out, "\n") {
		if match := deviceLine.FindStringSubmatch(line); match != nil {
			index, _ := strconv.Atoi(match[1])
			devices = append(devices, Device{Index: index, Name: match[2]})
			continue
		}
		if kind, found := strings.CutPrefix(strings.TrimSpace(line), "Type:"); found && len(devices) > 0 {
			devices[len(devices)-1].Kind = strings.TrimSpace(kind)
		}
	}
	return devices
}
