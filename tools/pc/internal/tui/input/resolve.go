package input

import (
	"slices"
	"strings"
	"time"

	"pc/internal/tui/command"
	"pc/internal/tui/kernel"
)

// ChordTimeout is how long a pending chord prefix waits for its second key
// before it is discarded.
const ChordTimeout = 700 * time.Millisecond

// Layer is a resolution level. Higher layers shadow lower ones, which is what
// lets j mean different things on different screens without that being a bug.
type Layer uint8

const (
	// LayerCapture is a text field owning every key except the ones bound here.
	LayerCapture Layer = iota
	// LayerOverlay is a modal, the palette or the help view.
	LayerOverlay
	// LayerComponent is the focused region's own bindings.
	LayerComponent
	// LayerScreen is the active route's bindings.
	LayerScreen
	// LayerGlobal is quit, palette, help, theme and navigation.
	LayerGlobal
)

const layerCount = int(LayerGlobal) + 1

func (l Layer) String() string {
	switch l {
	case LayerCapture:
		return "capture"
	case LayerOverlay:
		return "overlay"
	case LayerComponent:
		return "component"
	case LayerScreen:
		return "screen"
	default:
		return "global"
	}
}

// Binding maps a key or chord to a command.
type Binding struct {
	Keys     []string
	Command  command.ID
	When     command.Predicate
	Hint     string
	Priority int
}

// ResultKind is what the resolver decided.
type ResultKind uint8

const (
	// Passthrough means no binding matched; the key belongs to the focused view.
	Passthrough ResultKind = iota
	// Dispatch means a binding matched and its command should run.
	Dispatch
	// Pending means the key began a chord and the resolver is waiting.
	Pending
)

// Result is a resolution outcome.
type Result struct {
	Kind    ResultKind
	Command command.ID
	Prefix  []string
	// Next lists the bindings the pending prefix could still complete, so the
	// status bar can turn a chord from a memory test into a menu.
	Next []Binding
}

// Context is the state a resolution happens in.
type Context struct {
	Scope   command.Scope
	Capture bool
	Pending []string
}

// Resolver holds the layered keymap.
type Resolver struct {
	layers [layerCount][]Binding
}

// NewResolver builds an empty keymap.
func NewResolver() *Resolver {
	return &Resolver{}
}

// Add registers a binding, normalizing its keys.
func (r *Resolver) Add(layer Layer, b Binding) error {
	if int(layer) >= layerCount {
		return kernel.Errorf(kernel.KindConfig, "input.Add", "unknown layer %d", layer)
	}
	b.Keys = NormalizeAll(b.Keys)
	if len(b.Keys) == 0 {
		return kernel.Errorf(kernel.KindConfig, "input.Add", "binding for %q has no keys", b.Command)
	}
	if b.Command.IsZero() {
		return kernel.Errorf(kernel.KindConfig, "input.Add", "binding %v has no command", b.Keys)
	}
	r.layers[layer] = append(r.layers[layer], b)
	return nil
}

// Bindings lists a layer's bindings in registration order.
func (r *Resolver) Bindings(layer Layer) []Binding {
	if int(layer) >= layerCount {
		return nil
	}
	return slices.Clone(r.layers[layer])
}

// Resolve decides what a key means. Layers are consulted from the top down,
// and the first match wins.
func (r *Resolver) Resolve(key string, ctx Context) Result {
	key = Normalize(key)
	if key == "" {
		return Result{Kind: Passthrough}
	}
	sequence := append(slices.Clone(NormalizeAll(ctx.Pending)), key)

	// A focused text field owns every key the capture layer does not claim,
	// because routing each keystroke of a search box through the command
	// registry would be absurd.
	if ctx.Capture {
		if result, ok := match(r.layers[LayerCapture], sequence, ctx.Scope); ok {
			return result
		}
		return Result{Kind: Passthrough}
	}

	for layer := int(LayerOverlay); layer < layerCount; layer++ {
		if result, ok := match(r.layers[layer], sequence, ctx.Scope); ok {
			return result
		}
	}
	return Result{Kind: Passthrough}
}

// Hints lists the bindings that are available in a scope, ordered by declared
// priority. It is what generates the status bar rather than hand-written text.
func (r *Resolver) Hints(ctx Context) []Binding {
	layers := []Layer{LayerOverlay, LayerComponent, LayerScreen, LayerGlobal}
	if ctx.Capture {
		layers = []Layer{LayerCapture}
	}

	var out []Binding
	for _, layer := range layers {
		for _, b := range r.layers[layer] {
			if b.Hint != "" && b.When.Allow(ctx.Scope) {
				out = append(out, b)
			}
		}
	}
	slices.SortStableFunc(out, func(a, b Binding) int { return b.Priority - a.Priority })
	return out
}

func match(bindings []Binding, sequence []string, scope command.Scope) (Result, bool) {
	var continuations []Binding
	for _, b := range bindings {
		if !b.When.Allow(scope) {
			continue
		}
		if slices.Equal(b.Keys, sequence) {
			return Result{Kind: Dispatch, Command: b.Command}, true
		}
		if len(b.Keys) > len(sequence) && slices.Equal(b.Keys[:len(sequence)], sequence) {
			continuations = append(continuations, b)
		}
	}
	if len(continuations) > 0 {
		return Result{Kind: Pending, Prefix: sequence, Next: continuations}, true
	}
	return Result{}, false
}

// Conflict is a keymap problem found at boot.
type Conflict struct {
	Layer Layer
	Keys  []string
	A     command.ID
	B     command.ID
	Why   string
}

func (c Conflict) Error() string {
	return c.Layer.String() + " layer: " + strings.Join(c.Keys, " ") +
		" — " + string(c.A) + " and " + string(c.B) + ": " + c.Why
}

// Conflicts reports keymap problems. It only flags bindings it can prove
// collide: two unconditional bindings on the same sequence in the same layer,
// or an unconditional binding that shadows a chord prefix. Predicates are
// opaque functions, so two guarded bindings on one key are left alone — that
// is usually deliberate, and a false positive here would fail an honest build.
func (r *Resolver) Conflicts() []Conflict {
	var out []Conflict

	for layer := range layerCount {
		bindings := r.layers[layer]
		for i, a := range bindings {
			if a.When != nil {
				continue
			}
			for _, b := range bindings[i+1:] {
				if b.When != nil {
					continue
				}
				switch {
				case slices.Equal(a.Keys, b.Keys):
					out = append(out, Conflict{
						Layer: Layer(layer), Keys: a.Keys, A: a.Command, B: b.Command,
						Why: "both are bound to the same keys",
					})
				case isPrefix(a.Keys, b.Keys):
					out = append(out, Conflict{
						Layer: Layer(layer), Keys: a.Keys, A: a.Command, B: b.Command,
						Why: "the first shadows the chord the second completes",
					})
				case isPrefix(b.Keys, a.Keys):
					out = append(out, Conflict{
						Layer: Layer(layer), Keys: b.Keys, A: b.Command, B: a.Command,
						Why: "the first shadows the chord the second completes",
					})
				}
			}
		}
	}
	return out
}

func isPrefix(short, long []string) bool {
	return len(short) < len(long) && slices.Equal(long[:len(short)], short)
}
