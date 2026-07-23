package main

import (
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"

	tea "github.com/charmbracelet/bubbletea"
)

type paths struct{ config, customThemes, systemThemes string }

func resolvePaths() paths {
	home, _ := os.UserHomeDir()
	root := filepath.Join(home, ".config", "dotfiles")
	if value := os.Getenv("DOTFILES"); value != "" {
		root = value
	}
	return paths{
		config:       filepath.Join(root, "configs", "ghostty", "config"),
		customThemes: filepath.Join(root, "configs", "ghostty", "themes"),
		systemThemes: "/usr/share/ghostty/themes",
	}
}

func reloadGhostty() { _ = exec.Command("pkill", "-USR2", "-x", "ghostty").Run() }

func runTUI(p paths) error {
	cfg, raw, err := loadSettings(p.config)
	if err != nil {
		return err
	}
	m := newModel(p, cfg, raw)
	result, err := tea.NewProgram(m, tea.WithAltScreen(), tea.WithMouseCellMotion()).Run()
	if err != nil {
		return err
	}
	final := result.(model)
	if !final.keepPreview { // A normal quit is a cancel; restore the last committed snapshot.
		if err := writeAtomic(p.config, final.baseline); err != nil {
			return err
		}
		reloadGhostty()
	}
	return nil
}

func applyOne(p paths, key, value string) error {
	cfg, raw, err := loadSettings(p.config)
	if err != nil {
		return err
	}
	switch key {
	case "theme":
		cfg.Theme = value
	case "font":
		cfg.Font = value
	case "opacity":
		n, e := strconv.ParseFloat(value, 64)
		if e != nil || n < 0 || n > 1 {
			return errors.New("opacity must be between 0 and 1")
		}
		cfg.Opacity = int(n*100 + .5)
	case "letter-spacing":
		cfg.LetterSpacing = parsePercent(value, cfg.LetterSpacing)
	case "line-height":
		cfg.LineHeight = parsePercent(value, cfg.LineHeight)
	case "decorations":
		cfg.Decorations = !cfg.Decorations
	default:
		return fmt.Errorf("unknown setting %q", key)
	}
	assets := filepath.Join(filepath.Dir(p.customThemes), "assets")
	if err := writeAtomic(p.config, renderConfigWithAssets(raw, cfg, assets)); err != nil {
		return err
	}
	if key == "theme" {
		recordRecent(value)
	}
	reloadGhostty()
	return nil
}

func usage() {
	fmt.Print(`ghostty-theme — a live Ghostty appearance studio

  ghostty-theme                 open the interactive studio
  ghostty-theme pick            open the interactive studio
  ghostty-theme list            list installed themes
  ghostty-theme toggle          cycle curated themes
  ghostty-theme <theme>         apply a theme
  ghostty-theme font <name>     set font family
  ghostty-theme opacity <0..1>  set background opacity
  ghostty-theme line-height N%  set cell height adjustment
  ghostty-theme letter-spacing N% set cell width adjustment
  ghostty-theme decorations     toggle window decorations
`)
}

func main() {
	p := resolvePaths()
	args := os.Args[1:]
	if len(args) == 0 || args[0] == "pick" {
		if err := runTUI(p); err != nil {
			fmt.Fprintln(os.Stderr, "ghostty-theme:", err)
			os.Exit(1)
		}
		return
	}
	themes := discoverThemes(p.customThemes, p.systemThemes)
	nameExists := func(name string) bool {
		for _, t := range themes {
			if strings.EqualFold(t.Name, name) {
				return true
			}
		}
		return false
	}
	var err error
	switch args[0] {
	case "help", "-h", "--help":
		usage()
		return
	case "list":
		for _, t := range themes {
			fmt.Println(t.Name)
		}
		return
	case "toggle":
		cfg, _, e := loadSettings(p.config)
		if e != nil {
			err = e
			break
		}
		cycle := []string{"pastel-dark", "warm-sunset", "Catppuccin Mocha"}
		next := cycle[0]
		for i, name := range cycle {
			if name == cfg.Theme {
				next = cycle[(i+1)%len(cycle)]
			}
		}
		err = applyOne(p, "theme", next)
	case "font", "opacity", "line-height", "letter-spacing":
		if len(args) < 2 {
			err = fmt.Errorf("%s needs a value", args[0])
		} else {
			err = applyOne(p, args[0], strings.Join(args[1:], " "))
		}
	case "decorations":
		err = applyOne(p, "decorations", "")
	default:
		if nameExists(args[0]) {
			err = applyOne(p, "theme", args[0])
		} else {
			err = fmt.Errorf("unknown theme or command %q", args[0])
		}
	}
	if err != nil {
		fmt.Fprintln(os.Stderr, "ghostty-theme:", err)
		os.Exit(1)
	}
}
