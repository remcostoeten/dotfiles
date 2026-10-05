package procs

import "testing"

func TestParseList(t *testing.T) {
	out := `    PID   RSS %CPU USER                             COMMAND
    100 900000 12.5 me                               firefox
    200 500000  1.0 root                             Xorg
    300 400000  0.0 me                               plasmashell
    400      0  0.0 me                               kthread
    500 300000  3.0 me                               pc
    600 200000  2.0 me                               code
`
	got := ParseList(out, "me", 500, 2)
	if len(got) != 2 || got[0].Command != "firefox" || got[0].CPU != 12 || !got[1].Protected {
		t.Errorf("ParseList = %+v", got)
	}
}

func TestParseMeminfo(t *testing.T) {
	m := ParseMeminfo("MemTotal:       16000 kB\nMemAvailable:    6000 kB\nSwapTotal:        4000 kB\nSwapFree:         3000 kB\n")
	if m.UsedKB != 10000 || m.TotalKB != 16000 || m.SwapUsedKB != 1000 || m.SwapTotalKB != 4000 {
		t.Errorf("ParseMeminfo = %+v", m)
	}
}

func TestHumanKB(t *testing.T) {
	if got := HumanKB(2 << 20); got != "2.0G" {
		t.Errorf("HumanKB = %q", got)
	}
	if got := HumanKB(51200); got != "50M" {
		t.Errorf("HumanKB = %q", got)
	}
}
