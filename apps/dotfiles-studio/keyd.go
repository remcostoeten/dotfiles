package main

import (
	"bufio"
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"

	wruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

const (
	keydSystemConfig  = "/etc/keyd/default.conf"
	keydVirtualDevice = "keyd virtual keyboard"
	keydMainLayer     = "main"
)

// KeydStatus is the read-only health summary of the keyd daemon and the
// currently applied profile.
type KeydStatus struct {
	Installed     bool   `json:"installed"`
	DaemonActive  bool   `json:"daemonActive"`
	ProfilesDir   string `json:"profilesDir"`
	ActiveProfile string `json:"activeProfile"`
	SystemDirty   bool   `json:"systemDirty"`
	Error         string `json:"error"`
}

// KeydBinding is one physical-key remap inside a layer.
type KeydBinding struct {
	Layer  string `json:"layer"`
	Key    string `json:"key"`
	Action string `json:"action"`
}

// KeydProfile is a named set of bindings stored in the dotfiles repo.
type KeydProfile struct {
	Name     string        `json:"name"`
	Path     string        `json:"path"`
	Bindings []KeydBinding `json:"bindings"`
	Active   bool          `json:"active"`
}

// KeydResult reports the outcome of a validate/save/apply call. Output carries
// the raw `keyd check` diagnostics so the GUI can show why a config was rejected.
type KeydResult struct {
	OK     bool   `json:"ok"`
	Output string `json:"output"`
}

// KeydCapturedKey is a single keypress observed by `keyd monitor`. Key is the
// physical key; Raw is what the monitor actually reported, which differs from
// Key whenever the live config already remaps that key (see resolveCapturedKey).
type KeydCapturedKey struct {
	Device   string `json:"device"`
	Key      string `json:"key"`
	Raw      string `json:"raw"`
	Remapped bool   `json:"remapped"`
}

// pointerKeys are the mouse buttons and wheel directions keyd reports. The
// daemon does not grab pointers, so these arrive during capture and would
// otherwise be recorded as if they were keystrokes.
var pointerKeys = map[string]bool{
	"leftmouse":    true,
	"middlemouse":  true,
	"rightmouse":   true,
	"mouse1":       true,
	"mouse2":       true,
	"mouseback":    true,
	"mouseforward": true,
	"scrollup":     true,
	"scrolldown":   true,
	"scrollleft":   true,
	"scrollright":  true,
}

func (a *App) KeydStatus() KeydStatus {
	status := KeydStatus{
		Installed:   commandExists("keyd"),
		ProfilesDir: a.keydProfilesDir(),
	}
	if !status.Installed {
		status.Error = "keyd is not installed"
		return status
	}

	status.DaemonActive = keydDaemonActive()
	if !status.DaemonActive {
		status.Error = "keyd daemon is not running (systemctl start keyd)"
	}

	applied, err := os.ReadFile(keydSystemConfig)
	if err != nil {
		return status
	}
	for _, profile := range a.keydProfileFiles() {
		stored, err := os.ReadFile(profile)
		if err != nil {
			continue
		}
		if normalizeConfig(string(stored)) == normalizeConfig(string(applied)) {
			status.ActiveProfile = profileNameFromPath(profile)
			return status
		}
	}
	status.SystemDirty = true
	return status
}

func (a *App) KeydListProfiles() []KeydProfile {
	active := a.KeydStatus().ActiveProfile
	profiles := []KeydProfile{}
	for _, path := range a.keydProfileFiles() {
		raw, err := os.ReadFile(path)
		if err != nil {
			continue
		}
		name := profileNameFromPath(path)
		profiles = append(profiles, KeydProfile{
			Name:     name,
			Path:     path,
			Bindings: parseKeydConfig(string(raw)),
			Active:   name == active,
		})
	}
	return profiles
}

// KeydValidate renders bindings to keyd syntax and runs `keyd check` on them
// without touching disk state the daemon reads.
func (a *App) KeydValidate(bindings []KeydBinding) KeydResult {
	return keydCheck(renderKeydConfig(bindings))
}

func (a *App) KeydSaveProfile(name string, bindings []KeydBinding) KeydResult {
	safe, err := sanitizeProfileName(name)
	if err != nil {
		return KeydResult{Output: err.Error()}
	}

	rendered := renderKeydConfig(bindings)
	if result := keydCheck(rendered); !result.OK {
		return result
	}

	dir := a.keydProfilesDir()
	if dir == "" {
		return KeydResult{Output: "could not locate the dotfiles workspace"}
	}
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return KeydResult{Output: err.Error()}
	}
	path := filepath.Join(dir, safe+".conf")
	if err := os.WriteFile(path, []byte(rendered), 0o644); err != nil {
		return KeydResult{Output: err.Error()}
	}
	return KeydResult{OK: true, Output: path}
}

func (a *App) KeydDeleteProfile(name string) KeydResult {
	safe, err := sanitizeProfileName(name)
	if err != nil {
		return KeydResult{Output: err.Error()}
	}
	path := filepath.Join(a.keydProfilesDir(), safe+".conf")
	if err := os.Remove(path); err != nil {
		return KeydResult{Output: err.Error()}
	}
	return KeydResult{OK: true}
}

// KeydApplyProfile copies a stored profile over /etc/keyd/default.conf and
// reloads the daemon. Both steps need root, so they run under a single pkexec
// prompt rather than one prompt each.
func (a *App) KeydApplyProfile(name string) KeydResult {
	safe, err := sanitizeProfileName(name)
	if err != nil {
		return KeydResult{Output: err.Error()}
	}
	path := filepath.Join(a.keydProfilesDir(), safe+".conf")
	if !fileExists(path) {
		return KeydResult{Output: "no such profile: " + safe}
	}

	raw, err := os.ReadFile(path)
	if err != nil {
		return KeydResult{Output: err.Error()}
	}
	if result := keydCheck(string(raw)); !result.OK {
		return result
	}

	script := fmt.Sprintf("install -m 644 %s %s && keyd reload", shellQuote(path), shellQuote(keydSystemConfig))
	out, err := exec.Command(elevator(), "sh", "-c", script).CombinedOutput()
	if err != nil {
		return KeydResult{Output: strings.TrimSpace(string(out)) + "\n" + err.Error()}
	}
	return KeydResult{OK: true, Output: strings.TrimSpace(string(out))}
}

// KeydListKeys returns every key name keyd accepts, for the target dropdown.
func (a *App) KeydListKeys() []string {
	out, err := exec.Command("keyd", "list-keys").Output()
	if err != nil {
		return nil
	}
	keys := []string{}
	for _, line := range strings.Split(string(out), "\n") {
		for _, field := range strings.Fields(line) {
			keys = append(keys, field)
		}
	}
	sort.Strings(keys)
	return keys
}

// KeydStartCapture streams keypresses to the frontend as "keyd:key" events
// until KeydStopCapture is called.
//
// The daemon holds an exclusive grab (EVIOCGRAB) on the physical keyboard, so
// `keyd monitor` never sees pre-remap events from it — keystrokes only surface
// on keyd's own virtual keyboard, already remapped. Pointers are not grabbed,
// so mouse buttons do arrive raw and have to be discarded. To report the key the
// user physically pressed, post-remap keys are run back through the live config.
func (a *App) KeydStartCapture() KeydResult {
	a.keydMu.Lock()
	defer a.keydMu.Unlock()

	if a.keydCancel != nil {
		return KeydResult{OK: true}
	}
	if !commandExists("keyd") {
		return KeydResult{Output: "keyd is not installed"}
	}

	ctx, cancel := context.WithCancel(context.Background())
	cmd := exec.CommandContext(ctx, "keyd", "monitor")
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		cancel()
		return KeydResult{Output: err.Error()}
	}
	if err := cmd.Start(); err != nil {
		cancel()
		return KeydResult{Output: err.Error()}
	}
	a.keydCancel = cancel
	reverse := liveReverseMap()

	go func() {
		scanner := bufio.NewScanner(stdout)
		for scanner.Scan() {
			key, ok := parseMonitorLine(scanner.Text())
			if !ok {
				continue
			}
			wruntime.EventsEmit(a.ctx, "keyd:key", resolveCapturedKey(key, reverse))
		}
		_ = cmd.Wait()
	}()

	return KeydResult{OK: true}
}

// resolveCapturedKey undoes the live remap on a key that came off keyd's virtual
// keyboard, so pressing an already-remapped capslock records as "capslock"
// rather than the "esc" it currently emits.
func resolveCapturedKey(key KeydCapturedKey, reverse map[string]string) KeydCapturedKey {
	key.Raw = key.Key
	if key.Device != keydVirtualDevice {
		return key
	}
	if physical, ok := reverse[key.Key]; ok {
		key.Key = physical
		key.Remapped = true
	}
	return key
}

// liveReverseMap maps each key the applied config emits back to the physical key
// that produces it. Outputs claimed by more than one physical key are dropped:
// there is no single right answer, so the raw key is reported instead.
func liveReverseMap() map[string]string {
	raw, err := os.ReadFile(keydSystemConfig)
	if err != nil {
		return nil
	}

	counts := map[string]int{}
	reverse := map[string]string{}
	for _, b := range parseKeydConfig(string(raw)) {
		if b.Layer != keydMainLayer {
			continue
		}
		emitted := emittedKey(b.Action)
		if emitted == "" || emitted == b.Key {
			continue
		}
		counts[emitted]++
		reverse[emitted] = b.Key
	}

	for emitted, n := range counts {
		if n > 1 {
			delete(reverse, emitted)
		}
	}
	return reverse
}

// emittedKey is the key a keyd action produces on a plain tap. Actions that emit
// nothing on their own (layer switches) return "".
//
// The tapped key sits at a different argument per action: overload(mod, key)
// taps to its second argument, while timeout(key, ms, held) taps to its first.
func emittedKey(action string) string {
	action = strings.TrimSpace(action)
	if !strings.Contains(action, "(") {
		return action
	}

	name, rest, _ := strings.Cut(action, "(")
	args := strings.Split(strings.TrimSuffix(rest, ")"), ",")

	tapArg := -1
	switch strings.TrimSpace(name) {
	case "overload", "overloadt", "overloadt2":
		tapArg = 1
	case "timeout":
		tapArg = 0
	}
	if tapArg < 0 || tapArg >= len(args) {
		return ""
	}
	return strings.TrimSpace(args[tapArg])
}

func (a *App) KeydStopCapture() {
	a.keydMu.Lock()
	defer a.keydMu.Unlock()

	if a.keydCancel != nil {
		a.keydCancel()
		a.keydCancel = nil
	}
}

func (a *App) keydProfilesDir() string {
	root := a.workspaceRootPath()
	if root == "" {
		return ""
	}
	return filepath.Join(root, "configs", "keyd", "profiles")
}

func (a *App) keydProfileFiles() []string {
	dir := a.keydProfilesDir()
	if dir == "" {
		return nil
	}
	matches, err := filepath.Glob(filepath.Join(dir, "*.conf"))
	if err != nil {
		return nil
	}
	sort.Strings(matches)
	return matches
}

// parseMonitorLine reads one `keyd monitor` line, shaped as
// "<device name>\t<vendor:product:id>\t<key> <down|up|repeat>".
func parseMonitorLine(line string) (KeydCapturedKey, bool) {
	fields := strings.Split(line, "\t")
	if len(fields) < 3 {
		return KeydCapturedKey{}, false
	}

	event := strings.Fields(fields[len(fields)-1])
	if len(event) != 2 || event[1] != "down" {
		return KeydCapturedKey{}, false
	}
	if pointerKeys[event[0]] {
		return KeydCapturedKey{}, false
	}
	return KeydCapturedKey{Device: strings.TrimSpace(fields[0]), Key: event[0]}, true
}

func parseKeydConfig(raw string) []KeydBinding {
	bindings := []KeydBinding{}
	layer := keydMainLayer

	for _, line := range strings.Split(raw, "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		if strings.HasPrefix(line, "[") && strings.HasSuffix(line, "]") {
			layer = strings.Trim(line, "[]")
			continue
		}
		key, action, found := strings.Cut(line, "=")
		if !found {
			continue
		}
		key = strings.TrimSpace(key)
		action = strings.TrimSpace(action)
		if key == "" || action == "" {
			continue
		}
		bindings = append(bindings, KeydBinding{Layer: layer, Key: key, Action: action})
	}
	return bindings
}

func renderKeydConfig(bindings []KeydBinding) string {
	byLayer := map[string][]KeydBinding{}
	order := []string{}
	for _, b := range bindings {
		layer := strings.TrimSpace(b.Layer)
		if layer == "" {
			layer = keydMainLayer
		}
		if _, seen := byLayer[layer]; !seen {
			order = append(order, layer)
		}
		byLayer[layer] = append(byLayer[layer], b)
	}

	sort.SliceStable(order, func(i, j int) bool {
		return order[i] == keydMainLayer && order[j] != keydMainLayer
	})

	var sb strings.Builder
	sb.WriteString("# Generated by dotfiles-studio. Edits here are safe; the GUI reparses this file.\n")
	for _, layer := range order {
		sb.WriteString("\n[" + layer + "]\n")
		for _, b := range byLayer[layer] {
			sb.WriteString(strings.TrimSpace(b.Key) + " = " + strings.TrimSpace(b.Action) + "\n")
		}
	}
	return sb.String()
}

// keydCheck validates a rendered config by handing it to `keyd check`, which is
// the only authority on keyd syntax.
func keydCheck(rendered string) KeydResult {
	if !commandExists("keyd") {
		return KeydResult{Output: "keyd is not installed"}
	}

	tmp, err := os.CreateTemp("", "dotfiles-studio-*.conf")
	if err != nil {
		return KeydResult{Output: err.Error()}
	}
	defer os.Remove(tmp.Name())

	if _, err := tmp.WriteString(rendered); err != nil {
		tmp.Close()
		return KeydResult{Output: err.Error()}
	}
	tmp.Close()

	out, err := exec.Command("keyd", "check", tmp.Name()).CombinedOutput()
	text := strings.TrimSpace(stripANSI(string(out)))
	if err != nil {
		if text == "" {
			text = err.Error()
		}
		return KeydResult{Output: text}
	}
	return KeydResult{OK: true, Output: text}
}

func keydDaemonActive() bool {
	out, err := exec.Command("systemctl", "is-active", "keyd").Output()
	return err == nil && strings.TrimSpace(string(out)) == "active"
}

// elevator prefers pkexec so the app raises a polkit dialog instead of needing
// a TTY for a sudo password prompt.
func elevator() string {
	if commandExists("pkexec") {
		return "pkexec"
	}
	return "sudo"
}

func sanitizeProfileName(name string) (string, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return "", fmt.Errorf("profile name is required")
	}
	for _, r := range name {
		valid := r == '-' || r == '_' ||
			(r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9')
		if !valid {
			return "", fmt.Errorf("profile names may only contain letters, digits, dashes and underscores")
		}
	}
	return name, nil
}

func profileNameFromPath(path string) string {
	return strings.TrimSuffix(filepath.Base(path), ".conf")
}

// normalizeConfig strips comments and blank lines so a profile still matches the
// applied system config when only formatting differs.
func normalizeConfig(raw string) string {
	lines := []string{}
	for _, line := range strings.Split(raw, "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		lines = append(lines, strings.Join(strings.Fields(line), ""))
	}
	return strings.Join(lines, "\n")
}

func shellQuote(s string) string {
	return "'" + strings.ReplaceAll(s, "'", `'\''`) + "'"
}
