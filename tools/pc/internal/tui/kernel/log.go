package kernel

// Logger is the framework's logging contract. It is deliberately narrower than
// slog so that kernel keeps zero dependencies; core/logging adapts slog to it.
type Logger interface {
	Debug(msg string, args ...any)
	Info(msg string, args ...any)
	Warn(msg string, args ...any)
	Error(msg string, args ...any)
	With(args ...any) Logger
}

type nopLogger struct{}

// NopLogger returns a Logger that discards everything. It is the zero value
// used by tests and by any component constructed without a logger.
func NopLogger() Logger {
	return nopLogger{}
}

func (nopLogger) Debug(string, ...any) {}

func (nopLogger) Info(string, ...any) {}

func (nopLogger) Warn(string, ...any) {}

func (nopLogger) Error(string, ...any) {}

func (l nopLogger) With(...any) Logger {
	return l
}
