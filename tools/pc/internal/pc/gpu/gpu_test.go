package gpu

import (
	"errors"
	"slices"
	"testing"
)

func TestParseStats(t *testing.T) {
	s, err := ParseStats("NVIDIA GeForce RTX 3070, P2, 61, 45, 187.32, 220.00, 220.00, 97, 6120, 8192, 1905, 2100\n")
	if err != nil {
		t.Fatal(err)
	}
	if s.Name != "NVIDIA GeForce RTX 3070" || s.PState != "P2" || s.Power != 187 || s.MemTotal != 8192 || s.ClockMax != 2100 {
		t.Errorf("parsed %+v", s)
	}
	if _, err := ParseStats("garbage"); err == nil {
		t.Error("short output must fail")
	}
}

func TestParseThrottle(t *testing.T) {
	report := `GPU 00000000:01:00.0
    Clocks Event Reasons
        Idle                              : Active
        Applications Clocks Setting       : Not Active
        SW Power Cap                      : Active
        HW Slowdown                       : Not Active
    Sparse Operation Mode                 : N/A
        Fake Nested                       : Active
`
	if got := ParseThrottle(report); !slices.Equal(got, []string{"SW Power Cap"}) {
		t.Errorf("ParseThrottle = %v", got)
	}
}

func TestParseProcessesSortsBusiestFirst(t *testing.T) {
	out := `# gpu         pid   type     sm    mem    enc    dec    jpg    ofa    command
# Idx           #    C/G      %      %      %      %      %      %    name
    0        1234     G      3      1      -      -      -      -    Xorg
    0        5678     C     80     40      -      -      -      -    python
    0        9999     G      -      -      -      -      -      -    gone
`
	names := map[string]string{"1234": "Xorg", "5678": "python"}
	got := ParseProcesses(out, func(pid string) string { return names[pid] })
	if len(got) != 2 || got[0].PID != 5678 || got[0].SM != 80 || got[1].Command != "Xorg" {
		t.Errorf("ParseProcesses = %+v", got)
	}
}

func TestReadErrorIsOneLine(t *testing.T) {
	mismatch := "Failed to initialize NVML: Driver/library version mismatch\nNVML library version: 615.71\n"
	if err := ReadError(mismatch); !errors.Is(err, ErrDriverMismatch) {
		t.Errorf("ReadError = %v, want ErrDriverMismatch", err)
	}
	if got := ReadError("NVIDIA-SMI has failed\n  because it couldn't\n").Error(); got != "nvidia-smi: NVIDIA-SMI has failed because it couldn't" {
		t.Errorf("ReadError = %q", got)
	}
}
