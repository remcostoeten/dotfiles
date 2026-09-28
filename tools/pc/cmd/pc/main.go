// Command pc runs the application.
package main

import (
	"flag"
	"fmt"
	"os"
	"path/filepath"

	"pc/internal/app"
	"pc/internal/pc"
	"pc/internal/tui/core/config"
	"pc/internal/tui/core/logging"
	"pc/internal/tui/core/runtime"
	navigation "pc/internal/tui/navigation"
)

const (
	name    = "pc"
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

	model, err := app.Build(app.Options{
		Name:    name,
		Version: version,
		Config:  cfg,
		Log:     log,
		System:  pc.Host(),
		Start:   startRoute(filepath.Base(os.Args[0]), flag.Arg(0)),
	})
	if err != nil {
		return err
	}
	return runtime.Run(model)
}

// startRoute picks the opening screen from the first argument or, failing
// that, the name the binary was invoked by, so `gpu` and `pc rgb` both work.
func startRoute(invokedAs, arg string) navigation.RouteID {
	if arg == "" {
		arg = invokedAs
	}
	switch arg {
	case "proc", "procs", "ram", "mem":
		return "procs"
	case "rgb":
		return "rgb"
	case "audio", "media", "bt":
		return "audio"
	case "sys", "system":
		return "sys"
	}
	return ""
}
