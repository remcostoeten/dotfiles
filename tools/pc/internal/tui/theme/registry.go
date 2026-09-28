package theme

import (
	"slices"

	"pc/internal/tui/kernel"
)

// Registry holds the themes available at runtime. It is populated during boot
// — by the built-in set and by any module that registers one — and read-only
// afterwards.
type Registry struct {
	order  []string
	byName map[string]Theme
}

// NewRegistry builds a registry from the given themes. The first theme becomes
// the default.
func NewRegistry(themes ...Theme) *Registry {
	r := &Registry{byName: make(map[string]Theme, len(themes))}
	for _, t := range themes {
		r.Add(t)
	}
	return r
}

// Add registers a theme, replacing any theme of the same name in place.
func (r *Registry) Add(t Theme) {
	if _, exists := r.byName[t.Name]; !exists {
		r.order = append(r.order, t.Name)
	}
	r.byName[t.Name] = t
}

// Get looks a theme up by name.
func (r *Registry) Get(name string) (Theme, error) {
	t, ok := r.byName[name]
	if !ok {
		return Theme{}, kernel.Errorf(kernel.KindNotFound, "theme.Get", "no theme named %q", name)
	}
	return t, nil
}

// Names lists the registered theme names in registration order.
func (r *Registry) Names() []string {
	return slices.Clone(r.order)
}

// Default is the first registered theme.
func (r *Registry) Default() Theme {
	if len(r.order) == 0 {
		return Theme{}
	}
	return r.byName[r.order[0]]
}

// Next returns the theme after name, wrapping, so that a single key can cycle
// through the palette list.
func (r *Registry) Next(name string) Theme {
	if len(r.order) == 0 {
		return Theme{}
	}
	i := slices.Index(r.order, name)
	return r.byName[r.order[(i+1)%len(r.order)]]
}
