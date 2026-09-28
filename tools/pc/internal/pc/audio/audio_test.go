package audio

import "testing"

func TestParseSinks(t *testing.T) {
	out := `Sink #52
	State: RUNNING
	Name: alsa_output.usb
	Description: USB Headset
	Mute: no
	Volume: front-left: 40000 /  61% / -12.88 dB,   front-right: 40000 /  61% / -12.88 dB
	Base Volume: 65536 / 100% / 0.00 dB
Sink #53
	Name: alsa_output.hdmi
	Description: HDMI
	Mute: yes
	Volume: front-left: 65536 / 100% / 0.00 dB
`
	got := ParseSinks(out, "alsa_output.usb")
	if len(got) != 2 || !got[0].Default || got[0].Volume != 61 || got[1].Default || !got[1].Muted || got[1].Volume != 100 {
		t.Errorf("ParseSinks = %+v", got)
	}
}

func TestParseBluetooth(t *testing.T) {
	out := "Device AA:BB Sony WH-1000XM4\nnoise\nDevice CC:DD Keyboard\n"
	got := ParseBluetooth(out, func(mac string) bool { return mac == "CC:DD" })
	if len(got) != 2 || got[0].Name != "Sony WH-1000XM4" || got[0].Connected || !got[1].Connected {
		t.Errorf("ParseBluetooth = %+v", got)
	}
}

func TestParsePlayers(t *testing.T) {
	got := ParsePlayers("Playing\tspotify\tRadiohead\tReckoner\nPaused\tfirefox\t\tA video\n")
	if len(got) != 2 || !got[0].Playing() || got[1].Playing() || got[1].Title != "A video" {
		t.Errorf("ParsePlayers = %+v", got)
	}
}
