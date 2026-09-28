// Package config layers configuration: compiled defaults, then a TOML file,
// then the environment, then flags. Modules do not extend a central struct —
// each decodes its own section, so a module owns its schema the way it owns
// its state.
package config

import (
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/BurntSushi/toml"

	"pc/internal/tui/kernel"
)

// Config is the framework's own configuration plus the undecoded module
// sections.
type Config struct {
	Theme    string                    `toml:"theme"`
	Density  string                    `toml:"density"`
	Mouse    bool                      `toml:"mouse"`
	LogLevel string                    `toml:"log_level"`
	Keys     map[string]string         `toml:"keys"`
	Modules  map[string]toml.Primitive `toml:"modules"`

	meta toml.MetaData
	path string
}

// Defaults is the compiled-in configuration, used when there is no file.
func Defaults() Config {
	return Config{
		Theme:    "dark",
		Density:  "comfortable",
		Mouse:    true,
		LogLevel: "info",
		Keys:     map[string]string{},
		Modules:  map[string]toml.Primitive{},
	}
}

// Path is the file the configuration was read from, empty when none was found.
func (c Config) Path() string {
	return c.path
}

// DecodeModule decodes a module's section into its own type. An absent section
// leaves the target untouched, so a module's own defaults survive.
func (c Config) DecodeModule(name string, target any) error {
	primitive, ok := c.Modules[name]
	if !ok {
		return nil
	}
	if err := c.meta.PrimitiveDecode(primitive, target); err != nil {
		return kernel.Wrap(kernel.KindConfig, "config.DecodeModule", err, "decoding the %q section", name)
	}
	return nil
}

// FilePath is where the configuration lives for an application: the XDG config
// directory, or the OS default when XDG_CONFIG_HOME is unset.
func FilePath(app string) string {
	dir := os.Getenv("XDG_CONFIG_HOME")
	if dir == "" {
		home, err := os.UserConfigDir()
		if err != nil {
			return ""
		}
		dir = home
	}
	return filepath.Join(dir, app, "config.toml")
}

// StatePath is where logs and other state live for an application.
func StatePath(app string) string {
	dir := os.Getenv("XDG_STATE_HOME")
	if dir == "" {
		home, err := os.UserHomeDir()
		if err != nil {
			return ""
		}
		dir = filepath.Join(home, ".local", "state")
	}
	return filepath.Join(dir, app)
}

// Load reads the configuration for an application. A missing file is not an
// error: the defaults are a working configuration.
func Load(app string) (Config, error) {
	return LoadFile(app, FilePath(app))
}

// LoadFile reads a specific configuration file over the defaults.
func LoadFile(app, path string) (Config, error) {
	cfg := Defaults()
	cfg.path = path

	if path != "" {
		meta, err := toml.DecodeFile(path, &cfg)
		switch {
		case os.IsNotExist(err):
			cfg.path = ""
		case err != nil:
			return Defaults(), kernel.Wrap(kernel.KindConfig, "config.Load", err, "reading %s", path)
		default:
			cfg.meta = meta
		}
	}

	cfg.applyEnv(strings.ToUpper(app))
	return cfg.normalized(), nil
}

// applyEnv overlays <APP>_ prefixed variables onto the file values.
func (c *Config) applyEnv(prefix string) {
	if v := os.Getenv(prefix + "_THEME"); v != "" {
		c.Theme = v
	}
	if v := os.Getenv(prefix + "_DENSITY"); v != "" {
		c.Density = v
	}
	if v := os.Getenv(prefix + "_LOG_LEVEL"); v != "" {
		c.LogLevel = v
	}
	if v := os.Getenv(prefix + "_MOUSE"); v != "" {
		if b, err := strconv.ParseBool(v); err == nil {
			c.Mouse = b
		}
	}
}

// normalized fills in anything a partial file left empty, so that every
// consumer can read a field without guarding it.
func (c Config) normalized() Config {
	defaults := Defaults()
	if c.Theme == "" {
		c.Theme = defaults.Theme
	}
	if c.Density == "" {
		c.Density = defaults.Density
	}
	if c.LogLevel == "" {
		c.LogLevel = defaults.LogLevel
	}
	if c.Keys == nil {
		c.Keys = map[string]string{}
	}
	if c.Modules == nil {
		c.Modules = map[string]toml.Primitive{}
	}
	return c
}

// Override applies command-line flags, which sit above everything else. An
// empty value leaves the layer beneath it in place.
func (c Config) Override(theme, logLevel string) Config {
	if theme != "" {
		c.Theme = theme
	}
	if logLevel != "" {
		c.LogLevel = logLevel
	}
	return c
}
