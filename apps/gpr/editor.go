package main

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"slices"
	"strings"

	"github.com/charmbracelet/bubbles/textinput"
	tea "github.com/charmbracelet/bubbletea"
)

type settings struct {
	Editor string `json:"editor,omitempty"`
}

type knownEditor struct {
	Name     string
	Exe      string
	GUI      bool
	WaitArgs []string
}

var knownEditors = []knownEditor{
	{Name: "Neovim", Exe: "nvim"},
	{Name: "Vim", Exe: "vim"},
	{Name: "Helix", Exe: "hx"},
	{Name: "Helix", Exe: "helix"},
	{Name: "Kakoune", Exe: "kak"},
	{Name: "Micro", Exe: "micro"},
	{Name: "Nano", Exe: "nano"},
	{Name: "Emacs (terminal)", Exe: "emacs", WaitArgs: []string{"-nw"}},
	{Name: "VS Code", Exe: "code", GUI: true, WaitArgs: []string{"--wait"}},
	{Name: "VSCodium", Exe: "codium", GUI: true, WaitArgs: []string{"--wait"}},
	{Name: "Cursor", Exe: "cursor", GUI: true, WaitArgs: []string{"--wait"}},
	{Name: "Windsurf", Exe: "windsurf", GUI: true, WaitArgs: []string{"--wait"}},
	{Name: "Zed", Exe: "zed", GUI: true, WaitArgs: []string{"--wait"}},
	{Name: "Zed", Exe: "zeditor", GUI: true, WaitArgs: []string{"--wait"}},
	{Name: "Sublime Text", Exe: "subl", GUI: true, WaitArgs: []string{"--wait"}},
	{Name: "GVim", Exe: "gvim", GUI: true, WaitArgs: []string{"-f"}},
	{Name: "Kate", Exe: "kate", GUI: true, WaitArgs: []string{"--block"}},
	{Name: "Gedit", Exe: "gedit", GUI: true, WaitArgs: []string{"--wait"}},
}

func settingsPath() string {
	base, err := os.UserConfigDir()
	if err != nil {
		base = filepath.Join(os.Getenv("HOME"), ".config")
	}
	return filepath.Join(base, "gpr", "settings.json")
}

func loadSettings() settings {
	var s settings
	data, err := os.ReadFile(settingsPath())
	if err != nil {
		return s
	}
	if err := json.Unmarshal(data, &s); err != nil {
		fmt.Fprintf(os.Stderr, "gpr: ignoring invalid %s: %v\n", settingsPath(), err)
	}
	return s
}

func saveSettings(s settings) error {
	path := settingsPath()
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		return err
	}
	data, err := json.MarshalIndent(s, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, append(data, '\n'), 0644)
}

func lookupKnownEditor(exe string) (knownEditor, bool) {
	base := filepath.Base(exe)
	for _, e := range knownEditors {
		if e.Exe == base {
			return e, true
		}
	}
	return knownEditor{}, false
}

func installedEditors() []knownEditor {
	var found []knownEditor
	for _, e := range knownEditors {
		if _, err := exec.LookPath(e.Exe); err == nil {
			found = append(found, e)
		}
	}
	return found
}

func configuredEditor() string {
	if e := loadSettings().Editor; e != "" {
		return e
	}
	for _, env := range []string{"VISUAL", "EDITOR"} {
		if e := os.Getenv(env); e != "" {
			return e
		}
	}
	for _, exe := range []string{"nvim", "vim", "nano", "vi"} {
		if _, err := exec.LookPath(exe); err == nil {
			return exe
		}
	}
	return ""
}

func editorCommand(setting, file string) (*exec.Cmd, bool, error) {
	fields := strings.Fields(setting)
	if len(fields) == 0 {
		return nil, false, fmt.Errorf("no editor configured, run: gpr settings editor")
	}
	args := fields[1:]
	gui := false
	if known, ok := lookupKnownEditor(fields[0]); ok {
		gui = known.GUI
		for _, a := range known.WaitArgs {
			if !slices.Contains(args, a) {
				args = append(args, a)
			}
		}
	}
	return exec.Command(fields[0], append(args, file)...), gui, nil
}

const editorHeader = "<!-- gpr: first line is the title, everything below it is the body. Save and close the file to return to gpr. -->"

func writeDraft(title, body string) (string, error) {
	f, err := os.CreateTemp("", "gpr-draft-*.md")
	if err != nil {
		return "", err
	}
	defer f.Close()
	_, err = fmt.Fprintf(f, "%s\n%s\n\n%s", editorHeader, title, body)
	return f.Name(), err
}

func readDraft(path string) (string, string, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return "", "", err
	}
	text := strings.TrimPrefix(string(data), editorHeader)
	text = strings.TrimLeft(text, "\n")
	title, body, _ := strings.Cut(text, "\n")
	return strings.TrimSpace(title), strings.TrimSpace(body), nil
}

func runSettingsCLI(args []string) error {
	if len(args) == 0 {
		s := loadSettings()
		editor := s.Editor
		if editor == "" {
			editor = fmt.Sprintf("(not set, using %q)", configuredEditor())
		}
		fmt.Printf("editor: %s\nfile:   %s\n", editor, settingsPath())
		return nil
	}

	switch args[0] {
	case "editor", "ide":
	default:
		return fmt.Errorf("unknown setting %q, available: editor (alias: ide)", args[0])
	}

	s := loadSettings()
	value := strings.Join(args[1:], " ")
	if value == "" {
		picked, err := pickEditor(s.Editor)
		if err != nil {
			return err
		}
		if picked == "" {
			fmt.Println("Cancelled")
			return nil
		}
		value = picked
	}

	exe := strings.Fields(value)[0]
	if _, err := exec.LookPath(exe); err != nil {
		fmt.Fprintf(os.Stderr, "warning: %q is not on your PATH\n", exe)
	}
	s.Editor = value
	if err := saveSettings(s); err != nil {
		return err
	}
	fmt.Printf("editor set to %q\n", value)
	return nil
}

type editorPicker struct {
	options []knownEditor
	cursor  int
	typing  bool
	input   textinput.Model
	current string
	result  string
}

func pickEditor(current string) (string, error) {
	input := textinput.New()
	input.Placeholder = "executable, e.g. nvim or code --wait"
	p := editorPicker{options: installedEditors(), input: input, current: current}
	final, err := tea.NewProgram(p).Run()
	if err != nil {
		return "", err
	}
	return final.(editorPicker).result, nil
}

func (p editorPicker) Init() tea.Cmd {
	return nil
}

func (p editorPicker) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	key, ok := msg.(tea.KeyMsg)
	if !ok {
		return p, nil
	}
	if p.typing {
		switch key.String() {
		case "ctrl+c":
			return p, tea.Quit
		case "esc":
			p.typing = false
			p.input.Blur()
			return p, nil
		case "enter":
			p.result = strings.TrimSpace(p.input.Value())
			return p, tea.Quit
		}
		var cmd tea.Cmd
		p.input, cmd = p.input.Update(msg)
		return p, cmd
	}
	switch key.String() {
	case "ctrl+c", "esc", "q":
		return p, tea.Quit
	case "up", "k":
		p.cursor = max(p.cursor-1, 0)
	case "down", "j":
		p.cursor = min(p.cursor+1, len(p.options))
	case "enter":
		if p.cursor == len(p.options) {
			p.typing = true
			return p, p.input.Focus()
		}
		p.result = p.options[p.cursor].Exe
		return p, tea.Quit
	}
	return p, nil
}

func (p editorPicker) View() string {
	if p.result != "" {
		return ""
	}
	var s strings.Builder
	s.WriteString(cBold.Render("Open tickets in which editor?") + "\n\n")
	for i, e := range p.options {
		label := fmt.Sprintf("%-18s %s", e.Name, cDim.Render(e.Exe))
		if e.GUI {
			label += cDim.Render(" (gui)")
		}
		if e.Exe == p.current {
			label += cGreen.Render(" (current)")
		}
		s.WriteString(pickerRow(label, i == p.cursor))
	}
	s.WriteString(pickerRow("Other: type an executable", p.cursor == len(p.options)))
	if p.typing {
		s.WriteString("\n  " + p.input.View() + "\n")
		s.WriteString(cDim.Render("\n  enter save · esc back") + "\n")
	} else {
		s.WriteString(cDim.Render("\n  ↑/↓ move · enter select · esc cancel") + "\n")
	}
	return s.String()
}

func pickerRow(label string, selected bool) string {
	if selected {
		return cCyan.Render("› ") + label + "\n"
	}
	return "  " + label + "\n"
}

func editorLabel() string {
	fields := strings.Fields(configuredEditor())
	if len(fields) == 0 {
		return "editor"
	}
	return filepath.Base(fields[0])
}
