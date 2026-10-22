// Command todo-tui runs the application.
package main

import (
	"flag"
	"fmt"
	"os"
	"path/filepath"

	"todo-tui/internal/app"
	"todo-tui/internal/tui/core/config"
	"todo-tui/internal/tui/core/logging"
	"todo-tui/internal/tui/core/runtime"
)

const (
	name    = "todo-tui"
	version = "0.1.0"
)

func main() {
	if err := run(); err != nil {
		runtime.RestoreTerminal()
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func run() error {
	themeName := flag.String("theme", "", "palette to start in")
	logLevel := flag.String("log-level", "", "debug, info, warn or error")
	flag.Parse()

	cfg, err := config.Load(name)
	if err != nil {
		return err
	}
	cfg = cfg.Override(*themeName, *logLevel)

	log, _, closer, err := logging.New(logging.Options{
		Path:  filepath.Join(config.StatePath(name), "app.log"),
		Level: cfg.LogLevel,
	})
	if err != nil {
		// A log file we cannot open is not a reason to refuse to start: the
		// in-memory ring still works and stdout stays the UI.
		fmt.Fprintln(os.Stderr, "logging disabled:", err)
	}
	defer func() { _ = closer.Close() }()
	defer runtime.RestoreTerminal()

	model, err := app.Build(app.Options{Name: name, Version: version, Config: cfg, Log: log})
	if err != nil {
		return err
	}
	return runtime.Run(model)
}
