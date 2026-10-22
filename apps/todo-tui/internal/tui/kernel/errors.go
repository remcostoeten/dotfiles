package kernel

import (
	"errors"
	"fmt"
)

// Kind classifies a framework error so that the runtime can decide between an
// error overlay, a toast and a fatal exit without string matching.
type Kind uint8

const (
	// KindInternal is an invariant violation inside the framework.
	KindInternal Kind = iota
	// KindConfig is a malformed or unreadable configuration value.
	KindConfig
	// KindNotFound is a lookup for a route, command or region that is not registered.
	KindNotFound
	// KindConflict is a duplicate registration or a keybinding collision.
	KindConflict
	// KindModule is a failure originating in domain code, including a recovered panic.
	KindModule
	// KindTerminal is a failure to read from, write to or restore the terminal.
	KindTerminal
)

func (k Kind) String() string {
	switch k {
	case KindConfig:
		return "config"
	case KindNotFound:
		return "not_found"
	case KindConflict:
		return "conflict"
	case KindModule:
		return "module"
	case KindTerminal:
		return "terminal"
	default:
		return "internal"
	}
}

// Error is the framework's error type. Op names the operation that failed so
// that wrapped errors read as a call path.
type Error struct {
	Kind Kind
	Op   string
	Msg  string
	Err  error
}

func (e *Error) Error() string {
	switch {
	case e.Op != "" && e.Err != nil:
		return fmt.Sprintf("%s: %s: %v", e.Op, e.Msg, e.Err)
	case e.Op != "":
		return fmt.Sprintf("%s: %s", e.Op, e.Msg)
	case e.Err != nil:
		return fmt.Sprintf("%s: %v", e.Msg, e.Err)
	default:
		return e.Msg
	}
}

func (e *Error) Unwrap() error {
	return e.Err
}

// Errorf builds an Error with a formatted message.
func Errorf(kind Kind, op, format string, args ...any) *Error {
	return &Error{Kind: kind, Op: op, Msg: fmt.Sprintf(format, args...)}
}

// Wrap annotates err with a kind and an operation, returning nil when err is nil.
func Wrap(kind Kind, op string, err error, format string, args ...any) *Error {
	if err == nil {
		return nil
	}
	return &Error{Kind: kind, Op: op, Msg: fmt.Sprintf(format, args...), Err: err}
}

// KindOf reports the kind of the first *Error in err's chain, defaulting to
// KindInternal for foreign errors.
func KindOf(err error) Kind {
	var e *Error
	if errors.As(err, &e) {
		return e.Kind
	}
	return KindInternal
}

// IsKind reports whether err's chain carries the given kind.
func IsKind(err error, kind Kind) bool {
	var e *Error
	if !errors.As(err, &e) {
		return false
	}
	return e.Kind == kind
}
