// Package pc bundles the machine-facing sources every screen reads from.
package pc

import (
	"pc/internal/pc/audio"
	"pc/internal/pc/gpu"
	"pc/internal/pc/procs"
	"pc/internal/pc/rgb"
	"pc/internal/pc/sys"
)

// System is one Source per screen.
type System struct {
	GPU   gpu.Source
	Procs procs.Source
	RGB   rgb.Source
	Audio audio.Source
	Sys   sys.Source
}

// Host is the System backed by the real machine.
func Host() System {
	return System{
		GPU:   gpu.Host{},
		Procs: procs.Host{},
		RGB:   rgb.NewHost(),
		Audio: audio.Host{},
		Sys:   sys.Host{},
	}
}
