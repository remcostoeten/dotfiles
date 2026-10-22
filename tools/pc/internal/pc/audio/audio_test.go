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
	if got[0].Index != 52 || got[1].Index != 53 {
		t.Errorf("ParseSinks indexes = %d, %d", got[0].Index, got[1].Index)
	}
}

func TestParseStreams(t *testing.T) {
	out := `[
	{"index": 7, "sink": 52, "mute": false, "corked": false,
	 "volume": {"front-left": {"value": 65536}, "front-right": {"value": 32768}},
	 "properties": {"application.name": "Firefox", "media.name": "Playback"}},
	{"index": 9, "sink": 4294967295, "mute": true, "corked": true,
	 "volume": {"mono": {"value": 65536}},
	 "properties": {"node.name": "mpv", "target.object": "alsa_output.hdmi"}},
	{"index": 11, "sink": 52, "mute": false, "corked": false, "volume": {},
	 "properties": {"node.virtual": "true", "media.name": "Rear Jack output"}}
]`
	sinks := []Sink{{Index: 52, Name: "alsa_output.usb"}, {Index: 53, Name: "alsa_output.hdmi"}}

	got := ParseStreams(out, sinks)
	if len(got) != 2 {
		t.Fatalf("ParseStreams kept %d streams, want 2: %+v", len(got), got)
	}
	if first := got[0]; first.Index != 7 || first.App != "Firefox" || first.Media != "Playback" || first.Sink != "alsa_output.usb" || first.Volume != 75 || first.Muted || first.Corked {
		t.Errorf("first stream = %+v", first)
	}
	if second := got[1]; second.App != "mpv" || second.Sink != "alsa_output.hdmi" || !second.Muted || !second.Corked || second.Volume != 100 {
		t.Errorf("pinned stream = %+v", second)
	}
}

func TestParseStreamsRejectsBrokenJSON(t *testing.T) {
	if got := ParseStreams("not json", nil); got != nil {
		t.Errorf("ParseStreams = %+v, want nil", got)
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
