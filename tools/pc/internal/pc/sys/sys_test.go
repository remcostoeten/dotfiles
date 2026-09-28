package sys

import (
	"errors"
	"slices"
	"testing"
)

func TestParseSensors(t *testing.T) {
	out := `r8169_0_400:00-mdio-0
Adapter: MDIO adapter
temp1:        +48.0°C  (high = +120.0°C)

k10temp-pci-00c3
Adapter: PCI adapter
Tctl:         +54.8°C

nvme-pci-0100
Adapter: PCI adapter
Composite:    +38.9°C  (low  = -273.1°C, high = +84.8°C)
                       (crit = +84.8°C)
Sensor 1:     +32.9°C  (low  = -273.1°C, high = +65261.8°C)
`
	want := []Temperature{
		{Label: "r8169_0_400:00 · temp1", Celsius: 48},
		{Label: "k10temp · Tctl", Celsius: 54},
		{Label: "nvme · Composite", Celsius: 38},
		{Label: "nvme · Sensor 1", Celsius: 32},
	}
	if got := ParseSensors(out); !slices.Equal(got, want) {
		t.Errorf("ParseSensors = %+v", got)
	}
}

func TestParseDisplays(t *testing.T) {
	got := ParseDisplays("Display 1\n   I2C bus:  /dev/i2c-4\n   Monitor:  DEL:DELL U2720Q:ABC\n\nDisplay 2\n   Monitor: LG\n")
	if len(got) != 2 || got[0].Model != "DEL:DELL U2720Q:ABC" || got[1].Number != 2 || got[1].Brightness != -1 {
		t.Errorf("ParseDisplays = %+v", got)
	}
	if b := ParseBrightness("VCP code 0x10 (Brightness): current value =    70, max value =   100"); b != 70 {
		t.Errorf("ParseBrightness = %d", b)
	}
}

func TestListSessions(t *testing.T) {
	files := map[string]string{
		"/s/plasma.desktop":   "[Desktop Entry]\nName=Plasma (Wayland)\n",
		"/s/hyprland.desktop": "[Desktop Entry]\nName=Hyprland\n",
		"/s/broken.desktop":   "",
	}
	read := func(p string) ([]byte, error) {
		if p == "/s/broken.desktop" {
			return nil, errors.New("unreadable")
		}
		return []byte(files[p]), nil
	}
	got := ListSessions([]string{"/s/plasma.desktop", "/s/hyprland.desktop", "/s/broken.desktop"}, read, "KDE")
	if len(got) != 2 || got[0].Name != "Plasma (Wayland)" || !got[0].Current || got[1].Current {
		t.Errorf("ListSessions = %+v", got)
	}
}
