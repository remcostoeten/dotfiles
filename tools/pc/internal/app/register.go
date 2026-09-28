package app

import (
	"pc/internal/modules/audio"
	"pc/internal/modules/gpu"
	"pc/internal/modules/live"
	"pc/internal/modules/procs"
	"pc/internal/modules/rgb"
	"pc/internal/modules/sys"
	"pc/internal/pc"
	"pc/internal/tui/core/config"
	"pc/internal/tui/core/registry"
	navigation "pc/internal/tui/navigation"
)

// Deps are the services a module needs, wired here rather than resolved from a
// container: constructor arguments, checked by the compiler.
type Deps struct {
	Config config.Config
	System pc.System
	Start  navigation.RouteID
}

// Modules is the whole module list. Adding one is a line here plus a
// directory — the honest version of "no giant central file".
//
// Module-owned state is constructed here too, so that app.go never names a
// module and scaffolding a fresh project is a matter of replacing this file.
func Modules(deps Deps) []registry.Module {
	return []registry.Module{
		live.New(deps.Start),
		gpu.New(deps.System.GPU, deps.System.Procs),
		procs.New(deps.System.Procs),
		rgb.New(deps.System.RGB),
		audio.New(deps.System.Audio),
		sys.New(deps.System.Sys),
	}
}
