package kernel

import (
	"errors"
	"testing"
)

func TestErrorFormatting(t *testing.T) {
	cause := errors.New("permission denied")

	tests := []struct {
		name string
		err  *Error
		want string
	}{
		{
			name: "op and cause",
			err:  &Error{Kind: KindConfig, Op: "config.load", Msg: "reading config.toml", Err: cause},
			want: "config.load: reading config.toml: permission denied",
		},
		{
			name: "op only",
			err:  &Error{Kind: KindNotFound, Op: "registry.route", Msg: `no route "git"`},
			want: `registry.route: no route "git"`,
		},
		{
			name: "cause only",
			err:  &Error{Kind: KindTerminal, Msg: "restoring terminal", Err: cause},
			want: "restoring terminal: permission denied",
		},
		{
			name: "bare message",
			err:  &Error{Kind: KindInternal, Msg: "unreachable"},
			want: "unreachable",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := tt.err.Error(); got != tt.want {
				t.Errorf("Error() = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestWrapAndKind(t *testing.T) {
	if Wrap(KindConfig, "op", nil, "ignored") != nil {
		t.Fatal("Wrap of a nil error must be nil")
	}

	cause := errors.New("boom")
	wrapped := Wrap(KindModule, "pods.list", cause, "listing pods in %q", "default")

	if !errors.Is(wrapped, cause) {
		t.Error("wrapped error must unwrap to its cause")
	}
	if got := KindOf(wrapped); got != KindModule {
		t.Errorf("KindOf() = %v, want %v", got, KindModule)
	}
	if !IsKind(wrapped, KindModule) {
		t.Error("IsKind(KindModule) = false, want true")
	}
	if IsKind(wrapped, KindConfig) {
		t.Error("IsKind(KindConfig) = true, want false")
	}
	if got := KindOf(cause); got != KindInternal {
		t.Errorf("a foreign error must classify as internal, got %v", got)
	}
	if IsKind(cause, KindInternal) {
		t.Error("IsKind must be false for an error with no *Error in its chain")
	}
}

func TestErrorfCarriesKind(t *testing.T) {
	err := Errorf(KindConflict, "input.bind", "key %q is bound twice", "ctrl+k")
	if got := KindOf(err); got != KindConflict {
		t.Errorf("KindOf() = %v, want %v", got, KindConflict)
	}
	if want := `input.bind: key "ctrl+k" is bound twice`; err.Error() != want {
		t.Errorf("Error() = %q, want %q", err.Error(), want)
	}
}

func TestKindString(t *testing.T) {
	tests := map[Kind]string{
		KindInternal: "internal",
		KindConfig:   "config",
		KindNotFound: "not_found",
		KindConflict: "conflict",
		KindModule:   "module",
		KindTerminal: "terminal",
	}
	for kind, want := range tests {
		if got := kind.String(); got != want {
			t.Errorf("Kind(%d).String() = %q, want %q", kind, got, want)
		}
	}
}
