package kernel

// ID names something addressable — a focus region, a route, a command, a
// module. Values are lowercase dotted paths, namespaced by their owner:
// "pods.table", "git.fetch".
type ID string

// IsZero reports whether the identifier is unset.
func (id ID) IsZero() bool {
	return id == ""
}

func (id ID) String() string {
	return string(id)
}
