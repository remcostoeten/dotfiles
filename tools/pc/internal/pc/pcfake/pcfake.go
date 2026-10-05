// Package pcfake is a deterministic System for tests and golden frames. Writes
// are recorded, never executed.
package pcfake

import (
	"fmt"
	"sync"
	"syscall"

	"pc/internal/pc"
	"pc/internal/pc/audio"
	"pc/internal/pc/gpu"
	"pc/internal/pc/procs"
	"pc/internal/pc/rgb"
	"pc/internal/pc/sys"
)

// Recorder collects the writes a test caused.
type Recorder struct {
	mu    sync.Mutex
	calls []string
}

// Calls lists the recorded writes in order.
func (r *Recorder) Calls() []string {
	r.mu.Lock()
	defer r.mu.Unlock()
	return append([]string(nil), r.calls...)
}

func (r *Recorder) record(format string, args ...any) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.calls = append(r.calls, fmt.Sprintf(format, args...))
	return nil
}

// New builds a fake System and the recorder its writes land in.
func New() (pc.System, *Recorder) {
	rec := &Recorder{}
	return pc.System{
		GPU:   gpuFake{rec},
		Procs: procsFake{rec},
		RGB:   rgbFake{rec},
		Audio: audioFake{rec},
		Sys:   sysFake{rec},
	}, rec
}

type gpuFake struct{ *Recorder }

func (gpuFake) Read() (gpu.Stats, error) {
	return gpu.Stats{
		Name: "NVIDIA GeForce RTX 3070", PState: "P2", Temp: 61, Fan: 45, Power: 187,
		PowerLimit: 220, PowerDefault: 220, Util: 97, MemUsed: 6120, MemTotal: 8192,
		Clock: 1905, ClockMax: 2100,
	}, nil
}

func (gpuFake) Processes() []gpu.Process {
	return []gpu.Process{
		{PID: 4242, Kind: "C", SM: 88, Mem: 41, Command: "python3"},
		{PID: 1337, Kind: "G", SM: 4, Mem: 3, Command: "Xwayland"},
	}
}

func (f gpuFake) SetPowerLimit(w int) error { return f.record("gpu.power %d", w) }
func (f gpuFake) SetClockCap(mhz int) error { return f.record("gpu.clock %d", mhz) }
func (f gpuFake) ResetClocks() error        { return f.record("gpu.clock reset") }
func (f gpuFake) SetFans(mode string) error { return f.record("gpu.fans %s", mode) }

type procsFake struct{ *Recorder }

func (procsFake) List(int) ([]procs.Process, error) {
	return []procs.Process{
		{PID: 2001, Command: "firefox", RSSKB: 2 << 20, CPU: 12},
		{PID: 2002, Command: "code", RSSKB: 900 << 10, CPU: 3},
		{PID: 1100, Command: "plasmashell", RSSKB: 400 << 10, CPU: 1, Protected: true},
	}, nil
}

func (procsFake) Memory() procs.Memory {
	return procs.Memory{UsedKB: 9 << 20, TotalKB: 16 << 20, SwapUsedKB: 1 << 20, SwapTotalKB: 4 << 20}
}

func (f procsFake) Signal(pid int, sig syscall.Signal) error {
	return f.record("signal %d %d", pid, sig)
}

type rgbFake struct{ *Recorder }

func (rgbFake) Devices() ([]rgb.Device, error) {
	return []rgb.Device{
		{Index: 0, Name: "ASUS ROG STRIX B550-F", Kind: "Motherboard"},
		{Index: 1, Name: "Corsair Vengeance RGB", Kind: "DRAM"},
	}, nil
}

func (f rgbFake) SetDevice(i int, hex string) error { return f.record("rgb %d %s", i, hex) }
func (f rgbFake) SetAll(hex string) error           { return f.record("rgb all %s", hex) }

type audioFake struct{ *Recorder }

func (audioFake) Read() audio.Snapshot {
	return audio.Snapshot{
		Sinks: []audio.Sink{
			{Name: "usb", Description: "USB Headset", Default: true, Volume: 61},
			{Name: "hdmi", Description: "HDMI Output", Muted: true, Volume: 100},
		},
		Bluetooth: []audio.Bluetooth{{MAC: "AA:BB", Name: "WH-1000XM4", Connected: true}},
		Players:   []audio.Player{{Status: "Playing", Name: "spotify", Artist: "Radiohead", Title: "Reckoner"}},
	}
}

func (f audioFake) SetDefault(s string) error       { return f.record("audio.default %s", s) }
func (f audioFake) ChangeVolume(d int) error        { return f.record("audio.volume %+d", d) }
func (f audioFake) ToggleMute() error               { return f.record("audio.mute") }
func (f audioFake) Media(a audio.MediaAction) error { return f.record("audio.media %s", a) }
func (f audioFake) SetConnected(mac string, on bool) error {
	return f.record("audio.bluetooth %s %t", mac, on)
}

type sysFake struct{ *Recorder }

func (sysFake) Temperatures() []sys.Temperature {
	return []sys.Temperature{{Label: "k10temp · Tctl", Celsius: 54}, {Label: "nvme · Composite", Celsius: 38}}
}

func (sysFake) Displays() []sys.Display {
	return []sys.Display{{Number: 1, Model: "DELL U2720Q", Brightness: 70}}
}

func (sysFake) Sessions() []sys.Session {
	return []sys.Session{{Name: "Plasma (Wayland)", Path: "/s/plasma.desktop", Current: true}, {Name: "Hyprland", Path: "/s/hyprland.desktop"}}
}

func (f sysFake) SetBrightness(d, p int) error       { return f.record("sys.brightness %d %d", d, p) }
func (f sysFake) SetNextSession(s sys.Session) error { return f.record("sys.session %s", s.Path) }
func (f sysFake) Logout() error                      { return f.record("sys.logout") }
