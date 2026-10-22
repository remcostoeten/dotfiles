// Package audio reads and controls PulseAudio/PipeWire sinks, application
// streams, paired bluetooth devices and MPRIS players.
package audio

import (
	"encoding/json"
	"fmt"
	"regexp"
	"strconv"
	"strings"

	"pc/internal/pc/sh"
)

const (
	VolumeStep   = 5
	maxBluetooth = 8
	playerFormat = "{{status}}\t{{playerName}}\t{{artist}}\t{{title}}"
	testSound    = "/usr/share/sounds/alsa/Front_Center.wav"
	fullScale    = 65536
)

// Sink is an output device.
type Sink struct {
	Index       int
	Name        string
	Description string
	Default     bool
	Muted       bool
	Volume      int
}

// Stream is one application's playback and the output it is routed to. Sink is
// empty when the route cannot be resolved to a known output.
type Stream struct {
	Index  int
	App    string
	Media  string
	Sink   string
	Volume int
	Muted  bool
	Corked bool
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
	Streams   []Stream
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
	ChangeVolume(sink string, delta int) error
	ToggleMute(sink string) error
	ChangeStreamVolume(stream, delta int) error
	ToggleStreamMute(stream int) error
	MoveStream(stream int, sink string) error
	Test(sink string) error
	SetConnected(mac string, connected bool) error
	Media(action MediaAction) error
}

// Host is the Source backed by pactl, paplay, bluetoothctl and playerctl.
type Host struct{}

// Read samples every audio source. A missing tool leaves its section empty.
func (Host) Read() Snapshot {
	sinks := readSinks()
	return Snapshot{Sinks: sinks, Streams: readStreams(sinks), Bluetooth: readBluetooth(), Players: readPlayers()}
}

// SetDefault makes a sink the default output.
func (Host) SetDefault(sink string) error {
	return sh.Exec("pactl", "set-default-sink", sink)
}

// ChangeVolume nudges a sink by delta percent.
func (Host) ChangeVolume(sink string, delta int) error {
	return sh.Exec("pactl", "set-sink-volume", sink, fmt.Sprintf("%+d%%", delta))
}

// ToggleMute mutes or unmutes a sink.
func (Host) ToggleMute(sink string) error {
	return sh.Exec("pactl", "set-sink-mute", sink, "toggle")
}

// ChangeStreamVolume nudges one application's volume by delta percent.
func (Host) ChangeStreamVolume(stream, delta int) error {
	return sh.Exec("pactl", "set-sink-input-volume", strconv.Itoa(stream), fmt.Sprintf("%+d%%", delta))
}

// ToggleStreamMute mutes or unmutes one application.
func (Host) ToggleStreamMute(stream int) error {
	return sh.Exec("pactl", "set-sink-input-mute", strconv.Itoa(stream), "toggle")
}

// MoveStream routes one application to a sink.
func (Host) MoveStream(stream int, sink string) error {
	return sh.Exec("pactl", "move-sink-input", strconv.Itoa(stream), sink)
}

// Test plays a short sample on a sink.
func (Host) Test(sink string) error {
	return sh.Exec("paplay", "--device="+sink, testSound)
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

func readStreams(sinks []Sink) []Stream {
	out, err := sh.Run("pactl", "-f", "json", "list", "sink-inputs")
	if err != nil {
		return nil
	}
	return ParseStreams(out, sinks)
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
		header, body, _ := strings.Cut(block, "\n")
		s := Sink{Index: sh.Atoi(header)}
		seenVolume := false
		for _, line := range strings.Split(body, "\n") {
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

type rawStream struct {
	Index      int                      `json:"index"`
	Sink       int                      `json:"sink"`
	Mute       bool                     `json:"mute"`
	Corked     bool                     `json:"corked"`
	Volume     map[string]channelVolume `json:"volume"`
	Properties map[string]any           `json:"properties"`
}

type channelVolume struct {
	Value int `json:"value"`
}

// ParseStreams reads `pactl -f json list sink-inputs` output. Internal
// loopback streams are left out, and a stream pinned to an output by name
// keeps that route when pactl reports it as unlinked.
func ParseStreams(out string, sinks []Sink) []Stream {
	var raw []rawStream
	if err := json.Unmarshal([]byte(out), &raw); err != nil {
		return nil
	}
	names := make(map[int]string, len(sinks))
	known := make(map[string]bool, len(sinks))
	for _, s := range sinks {
		names[s.Index] = s.Name
		known[s.Name] = true
	}

	var streams []Stream
	for _, r := range raw {
		if property(r.Properties, "node.virtual") == "true" {
			continue
		}
		sink := names[r.Sink]
		if pinned := property(r.Properties, "target.object"); sink == "" && known[pinned] {
			sink = pinned
		}
		streams = append(streams, Stream{
			Index:  r.Index,
			App:    firstOf(property(r.Properties, "application.name"), property(r.Properties, "node.name"), property(r.Properties, "media.name"), "unknown"),
			Media:  property(r.Properties, "media.name"),
			Sink:   sink,
			Volume: percent(r.Volume),
			Muted:  r.Mute,
			Corked: r.Corked,
		})
	}
	return streams
}

func property(props map[string]any, key string) string {
	value, _ := props[key].(string)
	return value
}

func firstOf(values ...string) string {
	for _, v := range values {
		if v != "" {
			return v
		}
	}
	return ""
}

func percent(channels map[string]channelVolume) int {
	if len(channels) == 0 {
		return 0
	}
	sum := 0
	for _, c := range channels {
		sum += c.Value
	}
	return (sum*100/len(channels) + fullScale/2) / fullScale
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
