// Package logging adapts slog to kernel.Logger. Output goes to a file and to
// an in-memory ring, never to stdout — stdout is the UI. The ring is what
// makes a hidden logs route possible, so debugging a terminal app does not
// require a second terminal.
package logging

import (
	"context"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"sync"
	"time"

	"pc/internal/tui/kernel"
)

// DefaultRingSize is how many recent entries stay in memory.
const DefaultRingSize = 500

// Entry is one retained log line.
type Entry struct {
	Time    time.Time
	Level   slog.Level
	Message string
	Attrs   []slog.Attr
}

// Ring retains the most recent entries for the logs view. It is written from
// the logging handler and read from the render path, so it holds a mutex.
type Ring struct {
	mu      sync.RWMutex
	entries []Entry
	size    int
}

// NewRing builds a ring of the given capacity.
func NewRing(size int) *Ring {
	if size <= 0 {
		size = DefaultRingSize
	}
	return &Ring{size: size}
}

func (r *Ring) add(e Entry) {
	r.mu.Lock()
	defer r.mu.Unlock()

	r.entries = append(r.entries, e)
	if len(r.entries) > r.size {
		r.entries = slices.Delete(r.entries, 0, len(r.entries)-r.size)
	}
}

// Entries returns the retained entries, oldest first.
func (r *Ring) Entries() []Entry {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return slices.Clone(r.entries)
}

// Len is how many entries are retained.
func (r *Ring) Len() int {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return len(r.entries)
}

// ringHandler tees records into the ring on their way to the file.
type ringHandler struct {
	slog.Handler
	ring  *Ring
	attrs []slog.Attr
}

func (h *ringHandler) Handle(ctx context.Context, r slog.Record) error {
	attrs := slices.Clone(h.attrs)
	r.Attrs(func(a slog.Attr) bool {
		attrs = append(attrs, a)
		return true
	})
	h.ring.add(Entry{Time: r.Time, Level: r.Level, Message: r.Message, Attrs: attrs})
	return h.Handler.Handle(ctx, r)
}

func (h *ringHandler) WithAttrs(attrs []slog.Attr) slog.Handler {
	return &ringHandler{
		Handler: h.Handler.WithAttrs(attrs),
		ring:    h.ring,
		attrs:   append(slices.Clone(h.attrs), attrs...),
	}
}

func (h *ringHandler) WithGroup(name string) slog.Handler {
	return &ringHandler{Handler: h.Handler.WithGroup(name), ring: h.ring, attrs: h.attrs}
}

// logger adapts *slog.Logger to kernel.Logger.
type logger struct {
	inner *slog.Logger
}

func (l logger) Debug(msg string, args ...any) { l.inner.Debug(msg, args...) }
func (l logger) Info(msg string, args ...any)  { l.inner.Info(msg, args...) }
func (l logger) Warn(msg string, args ...any)  { l.inner.Warn(msg, args...) }
func (l logger) Error(msg string, args ...any) { l.inner.Error(msg, args...) }

func (l logger) With(args ...any) kernel.Logger {
	return logger{inner: l.inner.With(args...)}
}

// Options configures a logger.
type Options struct {
	Path     string
	Level    string
	RingSize int
}

// New opens a logger writing to Options.Path and retaining recent entries in
// the returned ring. A path that cannot be opened is not fatal: the ring still
// works, so the in-app logs view survives a read-only home directory.
func New(o Options) (kernel.Logger, *Ring, io.Closer, error) {
	ring := NewRing(o.RingSize)

	sink, closer, err := openSink(o.Path)
	base := slog.NewTextHandler(sink, &slog.HandlerOptions{Level: ParseLevel(o.Level)})
	return logger{inner: slog.New(&ringHandler{Handler: base, ring: ring})}, ring, closer, err
}

func openSink(path string) (io.Writer, io.Closer, error) {
	if path == "" {
		return io.Discard, io.NopCloser(nil), nil
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return io.Discard, io.NopCloser(nil), kernel.Wrap(kernel.KindConfig, "logging.New", err, "creating the log directory")
	}
	f, err := os.OpenFile(path, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o644)
	if err != nil {
		return io.Discard, io.NopCloser(nil), kernel.Wrap(kernel.KindConfig, "logging.New", err, "opening %s", path)
	}
	return f, f, nil
}

// ParseLevel reads a level name, defaulting to info.
func ParseLevel(name string) slog.Level {
	switch strings.ToLower(strings.TrimSpace(name)) {
	case "debug":
		return slog.LevelDebug
	case "warn", "warning":
		return slog.LevelWarn
	case "error":
		return slog.LevelError
	default:
		return slog.LevelInfo
	}
}
