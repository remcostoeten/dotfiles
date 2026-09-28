// Package audio reads and controls PulseAudio/PipeWire sinks, paired bluetooth
// devices and MPRIS players.
package audio

import (
	"fmt"
	"regexp"
	"strings"

	"pc/internal/pc/sh"
)

const (
	VolumeStep    = 5
	maxBluetooth  = 8
	playerFormat  = "{{status}}\t{{playerName}}\t{{artist}}\t{{title}}"
	defaultTarget = "@DEFAULT_SINK@"
)

// Sink is an output device.
type Sink struct {
	Name        string
	Description string
	Default     bool
	Muted       bool
	Volume      int
}

// Bluetooth is a paired device.
type Bluetooth struct {
	MAC       string
	Name      string
	Connected bool
}

// Player is an MPRIS media player.
type Player struct {
	Status string
	Name   string
	Artist string
	Title  string
}

// Playing reports whether the player is currently playing.
func (p Player) Playing() bool {
	return p.Status == "Playing"
}

// Snapshot is everything the audio screen shows.
type Snapshot struct {
	Sinks     []Sink
	Bluetooth []Bluetooth
	Players   []Player
}

// MediaAction is a playerctl verb.
type MediaAction string

const (
	PlayPause MediaAction = "play-pause"
	Next      MediaAction = "next"
	Previous  MediaAction = "previous"
)

// Source is everything the audio screen needs from the machine.
type Source interface {
	Read() Snapshot
	SetDefault(sink string) error
	ChangeVolume(delta int) error
	ToggleMute() error
	SetConnected(mac string, connected bool) error
	Media(action MediaAction) error
}

// Host is the Source backed by pactl, bluetoothctl and playerctl.
type Host struct{}

// Read samples every audio source. A missing tool leaves its section empty.
func (Host) Read() Snapshot {
	return Snapshot{Sinks: readSinks(), Bluetooth: readBluetooth(), Players: readPlayers()}
}

// SetDefault makes a sink the default output.
func (Host) SetDefault(sink string) error {
	return sh.Exec("pactl", "set-default-sink", sink)
}

// ChangeVolume nudges the default sink by delta percent.
func (Host) ChangeVolume(delta int) error {
	return sh.Exec("pactl", "set-sink-volume", defaultTarget, fmt.Sprintf("%+d%%", delta))
}

// ToggleMute mutes or unmutes the default sink.
func (Host) ToggleMute() error {
	return sh.Exec("pactl", "set-sink-mute", defaultTarget, "toggle")
}

// SetConnected connects or disconnects a paired device.
func (Host) SetConnected(mac string, connected bool) error {
	verb := "disconnect"
	if connected {
		verb = "connect"
	}
	return sh.Exec("bluetoothctl", verb, mac)
}

// Media sends a verb to the active player.
func (Host) Media(action MediaAction) error {
	return sh.Exec("playerctl", string(action))
}

func readSinks() []Sink {
	out, err := sh.Run("pactl", "list", "sinks")
	if err != nil {
		return nil
	}
	def, _ := sh.Run("pactl", "get-default-sink")
	return ParseSinks(out, strings.TrimSpace(def))
}

func readBluetooth() []Bluetooth {
	out, err := sh.Run("bluetoothctl", "devices")
	if err != nil {
		return nil
	}
	return ParseBluetooth(out, func(mac string) bool {
		info, _ := sh.Run("bluetoothctl", "info", mac)
		return strings.Contains(info, "Connected: yes")
	})
}

func readPlayers() []Player {
	out, err := sh.Run("playerctl", "-a", "metadata", "--format", playerFormat)
	if err != nil {
		return nil
	}
	return ParsePlayers(out)
}

var volume = regexp.MustCompile(`(\d+)%`)

// ParseSinks reads `pactl list sinks` output.
func ParseSinks(out, def string) []Sink {
	var sinks []Sink
	blocks := strings.Split(out, "Sink #")
	for _, block := range blocks[min(1, len(blocks)):] {
		var s Sink
		seenVolume := false
		for _, line := range strings.Split(block, "\n") {
			trimmed := strings.TrimSpace(line)
			switch {
			case strings.HasPrefix(trimmed, "Name: "):
				s.Name = strings.TrimPrefix(trimmed, "Name: ")
			case strings.HasPrefix(trimmed, "Description: "):
				s.Description = strings.TrimPrefix(trimmed, "Description: ")
			case strings.HasPrefix(trimmed, "Mute: "):
				s.Muted = strings.HasSuffix(trimmed, "yes")
			case strings.HasPrefix(trimmed, "Volume: ") && !seenVolume:
				seenVolume = true
				if match := volume.FindStringSubmatch(trimmed); match != nil {
					s.Volume = sh.Atoi(match[1])
				}
			}
		}
		if s.Name != "" {
			s.Default = s.Name == def
			sinks = append(sinks, s)
		}
	}
	return sinks
}

// ParseBluetooth reads `bluetoothctl devices` output.
func ParseBluetooth(out string, connected func(mac string) bool) []Bluetooth {
	var devices []Bluetooth
	for _, line := range strings.Split(out, "\n") {
		fields := strings.Fields(line)
		if len(fields) < 3 || fields[0] != "Device" {
			continue
		}
		devices = append(devices, Bluetooth{MAC: fields[1], Name: strings.Join(fields[2:], " "), Connected: connected(fields[1])})
		if len(devices) == maxBluetooth {
			break
		}
	}
	return devices
}

// ParsePlayers reads playerctl metadata in playerFormat.
func ParsePlayers(out string) []Player {
	var players []Player
	for _, line := range strings.Split(strings.TrimSpace(out), "\n") {
		fields := strings.Split(line, "\t")
		if len(fields) < 4 {
			continue
		}
		players = append(players, Player{Status: fields[0], Name: fields[1], Artist: fields[2], Title: fields[3]})
	}
	return players
}
