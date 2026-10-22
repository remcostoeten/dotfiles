package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"sort"
	"strings"

	wruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// PackageSource is one way to install an entry. Sources are tried in order and
// the first one that applies to the current machine wins.
type PackageSource struct {
	Method    string `json:"method"`
	Package   string `json:"package,omitempty"`
	Shell     string `json:"shell,omitempty"`
	Args      string `json:"args,omitempty"`
	Script    string `json:"script,omitempty"`
	Uninstall string `json:"uninstall,omitempty"`
}

// PackageEntry is a single managed package in the studio manifest.
type PackageEntry struct {
	ID          string          `json:"id"`
	Name        string          `json:"name"`
	Category    string          `json:"category"`
	Description string          `json:"description,omitempty"`
	Disabled    bool            `json:"disabled,omitempty"`
	Checks      []string        `json:"checks,omitempty"`
	Sources     []PackageSource `json:"sources"`
}

// PackageCategory groups entries in the manifest.
type PackageCategory struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
}

// PackageManifest is the studio's own source of truth for what gets installed.
type PackageManifest struct {
	Version    int               `json:"version"`
	AURHelper  string            `json:"aurHelper"`
	Categories []PackageCategory `json:"categories"`
	Packages   []PackageEntry    `json:"packages"`
}

// PackagesEnv is what the resolver knows about this machine.
type PackagesEnv struct {
	PackageManager string          `json:"packageManager"`
	OSFamily       string          `json:"osFamily"`
	HasSudo        bool            `json:"hasSudo"`
	AURHelpers     []string        `json:"aurHelpers"`
	AURHelper      string          `json:"aurHelper"`
	Methods        map[string]bool `json:"methods"`
}

// ResolvedPackage is how an entry would be installed on this machine.
type ResolvedPackage struct {
	ID               string `json:"id"`
	SourceIndex      int    `json:"sourceIndex"`
	Method           string `json:"method"`
	Command          string `json:"command"`
	UninstallCommand string `json:"uninstallCommand"`
	Reason           string `json:"reason"`
	Installed        bool   `json:"installed"`
}

// PackagesState is everything the Packages tab renders.
type PackagesState struct {
	Path        string                     `json:"path"`
	Exists      bool                       `json:"exists"`
	SetupScript string                     `json:"setupScript"`
	Manifest    PackageManifest            `json:"manifest"`
	Env         PackagesEnv                `json:"env"`
	Resolved    map[string]ResolvedPackage `json:"resolved"`
	Error       string                     `json:"error"`
}

var packageMethods = []string{"pacman", "aur", "apt", "dnf", "flatpak", "snap", "npm", "cargo", "pipx", "curl", "github", "shell"}

var aurHelpers = []string{"paru", "yay"}

var packageIDRe = regexp.MustCompile(`^[a-z0-9][a-z0-9._+-]*$`)

func (a *App) manifestPath() string {
	if root := a.workspaceRootPath(); root != "" && isWorkspaceRoot(root) {
		return filepath.Join(root, "setup", "packages.json")
	}
	dir, err := os.UserConfigDir()
	if err != nil {
		dir = filepath.Join(os.Getenv("HOME"), ".config")
	}
	return filepath.Join(dir, "dotfiles-studio", "packages.json")
}

func emptyManifest() PackageManifest {
	return PackageManifest{Version: 1, AURHelper: "auto", Categories: []PackageCategory{}, Packages: []PackageEntry{}}
}

func readManifest(path string) (PackageManifest, bool, error) {
	data, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) {
		return emptyManifest(), false, nil
	}
	if err != nil {
		return emptyManifest(), false, err
	}
	m := emptyManifest()
	if err := json.Unmarshal(data, &m); err != nil {
		return emptyManifest(), true, fmt.Errorf("%s is not valid JSON: %w", path, err)
	}
	normalizeManifest(&m)
	return m, true, nil
}

func writeManifest(path string, m PackageManifest) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	data, err := json.MarshalIndent(m, "", "  ")
	if err != nil {
		return err
	}
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, append(data, '\n'), 0o644); err != nil {
		return err
	}
	return os.Rename(tmp, path)
}

func normalizeManifest(m *PackageManifest) {
	if m.Version == 0 {
		m.Version = 1
	}
	if m.AURHelper == "" {
		m.AURHelper = "auto"
	}
	if m.Categories == nil {
		m.Categories = []PackageCategory{}
	}
	if m.Packages == nil {
		m.Packages = []PackageEntry{}
	}
	known := map[string]bool{}
	for _, c := range m.Categories {
		known[c.ID] = true
	}
	for i := range m.Packages {
		p := &m.Packages[i]
		p.ID = strings.TrimSpace(p.ID)
		p.Category = strings.TrimSpace(p.Category)
		if p.Category == "" {
			p.Category = "misc"
		}
		if p.Name == "" {
			p.Name = p.ID
		}
		if p.Sources == nil {
			p.Sources = []PackageSource{}
		}
		checks := p.Checks[:0]
		for _, c := range p.Checks {
			if c = strings.TrimSpace(c); c != "" {
				checks = append(checks, c)
			}
		}
		p.Checks = checks
		if !known[p.Category] {
			m.Categories = append(m.Categories, PackageCategory{ID: p.Category, Name: titleCase(p.Category)})
			known[p.Category] = true
		}
	}
}

func validateManifest(m PackageManifest) error {
	seen := map[string]bool{}
	for _, p := range m.Packages {
		if !packageIDRe.MatchString(p.ID) {
			return fmt.Errorf("invalid id %q: use lowercase letters, digits and . _ + -", p.ID)
		}
		if seen[p.ID] {
			return fmt.Errorf("duplicate id %q", p.ID)
		}
		seen[p.ID] = true
		for _, s := range p.Sources {
			if !isPackageMethod(s.Method) {
				return fmt.Errorf("%s: unknown method %q", p.ID, s.Method)
			}
			if s.Method == "shell" && strings.TrimSpace(s.Script) == "" {
				return fmt.Errorf("%s: shell source needs a script", p.ID)
			}
			if s.Method != "shell" && strings.TrimSpace(s.Package) == "" {
				return fmt.Errorf("%s: %s source needs a package/url/repo", p.ID, s.Method)
			}
		}
	}
	return nil
}

func isPackageMethod(method string) bool {
	for _, m := range packageMethods {
		if m == method {
			return true
		}
	}
	return false
}

func titleCase(id string) string {
	words := strings.FieldsFunc(id, func(r rune) bool { return r == '-' || r == '_' })
	for i, w := range words {
		words[i] = strings.ToUpper(w[:1]) + w[1:]
	}
	return strings.Join(words, " ")
}

func detectPackagesEnv(m PackageManifest) PackagesEnv {
	info := SystemInfo{PackageManager: detectPackageManager(), OSFamily: osFamily(parseOSRelease())}
	env := PackagesEnv{
		PackageManager: info.PackageManager,
		OSFamily:       info.OSFamily,
		HasSudo:        hasPasswordlessSudo(),
		AURHelpers:     []string{},
		Methods:        map[string]bool{},
	}
	for _, h := range aurHelpers {
		if commandExists(h) {
			env.AURHelpers = append(env.AURHelpers, h)
		}
	}
	env.AURHelper = effectiveAURHelper(m.AURHelper, env)
	for _, method := range packageMethods {
		ok, _ := methodAvailable(method, env)
		env.Methods[method] = ok
	}
	return env
}

func effectiveAURHelper(pref string, env PackagesEnv) string {
	if env.PackageManager != "pacman" || pref == "none" {
		return ""
	}
	for _, h := range env.AURHelpers {
		if pref == "auto" || pref == "" || pref == h {
			return h
		}
	}
	return ""
}

func methodAvailable(method string, env PackagesEnv) (bool, string) {
	switch method {
	case "pacman", "apt", "dnf":
		if env.PackageManager != method {
			return false, "needs " + method + "; this machine uses " + env.PackageManager
		}
		return true, ""
	case "aur":
		if env.PackageManager != "pacman" {
			return false, "AUR only applies to Arch-based systems"
		}
		if env.AURHelper == "" {
			return false, "no AUR helper installed/selected"
		}
		return true, ""
	case "flatpak", "snap", "npm", "cargo", "pipx", "curl":
		if !commandExists(method) {
			return false, method + " is not on PATH"
		}
		return true, ""
	case "github":
		if !commandExists("curl") || !commandExists("tar") {
			return false, "needs curl and tar"
		}
		return true, ""
	case "shell":
		return true, ""
	}
	return false, "unknown method " + method
}

func resolveSource(p PackageEntry, env PackagesEnv) (int, string) {
	reasons := []string{}
	for i, s := range p.Sources {
		ok, reason := methodAvailable(s.Method, env)
		if ok {
			return i, ""
		}
		reasons = append(reasons, s.Method+": "+reason)
	}
	if len(p.Sources) == 0 {
		return -1, "no install sources defined"
	}
	return -1, strings.Join(reasons, "; ")
}

func packageNames(s PackageSource) string {
	return strings.Join(strings.Fields(s.Package), " ")
}

// sourceInstall returns the shell script for a source and whether it needs root.
// GitHub sources are resolved at run time, so they only get a display line here.
func sourceInstall(s PackageSource, p PackageEntry, env PackagesEnv) (string, bool) {
	pkgs := packageNames(s)
	switch s.Method {
	case "pacman":
		return "pacman -S --needed --noconfirm " + pkgs, true
	case "aur":
		return env.AURHelper + " -S --needed --noconfirm " + aurSudoFlag(env) + pkgs, false
	case "apt":
		return "DEBIAN_FRONTEND=noninteractive apt-get install -y " + pkgs, true
	case "dnf":
		return "dnf install -y " + pkgs, true
	case "flatpak":
		return "flatpak install -y --noninteractive flathub " + pkgs, false
	case "snap":
		return strings.TrimSpace("snap install " + pkgs + " " + s.Args), true
	case "npm":
		return "npm install -g " + pkgs, false
	case "cargo":
		return "cargo install --locked " + pkgs, false
	case "pipx":
		return "pipx install " + pkgs, false
	case "curl":
		shell := firstNonEmpty(s.Shell, "sh")
		script := "curl -fsSL " + shellQuote(s.Package) + " | " + shell
		if args := strings.TrimSpace(s.Args); args != "" {
			script += " -s -- " + args
		}
		return script, false
	case "github":
		return "latest " + s.Package + " release → ~/.local/bin/" + githubBinary(s, p), false
	case "shell":
		return s.Script, false
	}
	return "", false
}

func aurSudoFlag(env PackagesEnv) string {
	if env.HasSudo || !commandExists("pkexec") {
		return ""
	}
	return "--sudo pkexec "
}

func githubBinary(s PackageSource, p PackageEntry) string {
	if len(p.Checks) > 0 {
		return p.Checks[0]
	}
	return p.ID
}

func sourceUninstall(s PackageSource, p PackageEntry, env PackagesEnv) (string, bool) {
	if strings.TrimSpace(s.Uninstall) != "" {
		return s.Uninstall, false
	}
	if protectedPackages[p.ID] {
		return "", false
	}
	pkgs := packageNames(s)
	switch s.Method {
	case "pacman", "aur":
		return "pacman -Rs --noconfirm " + pkgs, true
	case "apt":
		return "apt-get remove -y " + pkgs, true
	case "dnf":
		return "dnf remove -y " + pkgs, true
	case "flatpak":
		return "flatpak uninstall -y --noninteractive " + pkgs, false
	case "snap":
		return "snap remove " + pkgs, true
	case "npm":
		return "npm uninstall -g " + pkgs, false
	case "cargo":
		return "cargo uninstall " + pkgs, false
	case "pipx":
		return "pipx uninstall " + pkgs, false
	case "github":
		return "rm -f " + shellQuote(filepath.Join(homeDir(), ".local", "bin", githubBinary(s, p))), false
	}

	info := SystemInfo{PackageManager: env.PackageManager}
	for _, name := range p.Checks {
		path, err := exec.LookPath(name)
		if err != nil {
			continue
		}
		if owner := systemPackageOwner(path, info); owner != "" {
			plan := packageRemovePlan(owner, info)
			return plan.script, plan.root
		}
		if dirWritable(filepath.Dir(path)) && pathWithin(path, homeDir()) {
			return "rm -f " + shellQuote(path), false
		}
	}
	return "", false
}

func homeDir() string {
	home, err := os.UserHomeDir()
	if err != nil {
		return os.Getenv("HOME")
	}
	return home
}

func displayCommand(script string, root bool) string {
	if root {
		return "sudo " + script
	}
	return script
}

func elevate(script string, env PackagesEnv) string {
	if env.HasSudo {
		return "sudo -n sh -c " + shellQuote(script)
	}
	return elevator() + " sh -c " + shellQuote(script)
}

func entryInstalled(p PackageEntry, env PackagesEnv, idx int) bool {
	if len(p.Checks) > 0 {
		return checkAnyCommand(strings.Join(p.Checks, "|"))
	}
	if idx < 0 {
		return false
	}
	s := p.Sources[idx]
	switch s.Method {
	case "pacman", "aur", "apt":
		registered, _, _ := sourceRegistered(s, env)
		return registered
	}
	return false
}

func resolvePackage(p PackageEntry, env PackagesEnv) ResolvedPackage {
	idx, reason := resolveSource(p, env)
	r := ResolvedPackage{ID: p.ID, SourceIndex: idx, Reason: reason}
	if idx >= 0 {
		s := p.Sources[idx]
		script, root := sourceInstall(s, p, env)
		r.Method = s.Method
		r.Command = displayCommand(script, root)
		if un, unRoot := sourceUninstall(s, p, env); un != "" {
			r.UninstallCommand = displayCommand(un, unRoot)
		}
	}
	r.Installed = entryInstalled(p, env, idx)
	return r
}

func (a *App) packagesState() PackagesState {
	path := a.manifestPath()
	m, exists, err := readManifest(path)
	st := PackagesState{Path: path, Exists: exists, Manifest: m, Resolved: map[string]ResolvedPackage{}}
	if err != nil {
		st.Error = err.Error()
	}
	if script := setupScriptPath(a.workspaceRootPath()); fileExists(script) {
		st.SetupScript = script
	}
	st.Env = detectPackagesEnv(m)
	for _, p := range m.Packages {
		st.Resolved[p.ID] = resolvePackage(p, st.Env)
	}
	return st
}

// PackagesLoad reads the manifest and resolves every entry for this machine.
func (a *App) PackagesLoad() PackagesState {
	return a.packagesState()
}

// PackagesSave validates and writes the manifest, returning the fresh state.
func (a *App) PackagesSave(m PackageManifest) PackagesState {
	normalizeManifest(&m)
	if err := validateManifest(m); err != nil {
		st := a.packagesState()
		st.Error = err.Error()
		return st
	}
	if err := writeManifest(a.manifestPath(), m); err != nil {
		st := a.packagesState()
		st.Error = err.Error()
		return st
	}
	return a.packagesState()
}

// PackagesPickFile opens a native dialog for choosing a setup script to import.
func (a *App) PackagesPickFile() string {
	dir := ""
	if root := a.workspaceRootPath(); root != "" {
		dir = filepath.Join(root, "setup")
	}
	path, err := wruntime.OpenFileDialog(a.ctx, wruntime.OpenDialogOptions{
		Title:            "Import packages from a setup script",
		DefaultDirectory: dir,
		Filters:          []wruntime.FileFilter{{DisplayName: "Shell scripts", Pattern: "*.sh;*.bash"}},
	})
	if err != nil {
		return ""
	}
	return path
}

func findEntry(m PackageManifest, id string) (PackageEntry, bool) {
	for _, p := range m.Packages {
		if p.ID == id {
			return p, true
		}
	}
	return PackageEntry{}, false
}

type runStep struct {
	entry PackageEntry
	force bool
}

// stepScript renders one entry as a bash block that records failures in $failed.
func stepScript(step runStep, env PackagesEnv, dryRun bool) string {
	p := step.entry
	var b strings.Builder
	idx, reason := resolveSource(p, env)
	label := p.Name
	if idx >= 0 {
		label += " (" + p.Sources[idx].Method + ")"
	}
	fmt.Fprintf(&b, "printf '\\n==> %%s\\n' %s\n", shellQuote(label))
	if idx < 0 {
		fmt.Fprintf(&b, "echo %s\n", shellQuote("    skipped: "+reason))
		return b.String()
	}

	s := p.Sources[idx]
	install, root := sourceInstall(s, p, env)
	var run string
	if s.Method == "github" {
		asset, err := resolveGithubAsset(s.Package)
		if err != nil {
			fmt.Fprintf(&b, "echo %s; failed=\"$failed %s\"\n", shellQuote("    ✗ "+err.Error()), p.ID)
			return b.String()
		}
		install = "download " + asset.Name + " (" + asset.Tag + ") → ~/.local/bin/" + githubBinary(s, p)
		run = "bash -c " + shellQuote(githubInstallScript(asset.URL, githubBinary(s, p)))
	} else if root {
		run = elevate(install, env)
	} else {
		run = "bash -c " + shellQuote(install)
	}

	body := ""
	if dryRun {
		body = "echo " + shellQuote("    would run: "+summarizeScript(displayCommand(install, root)))
	} else {
		body = fmt.Sprintf("echo %s\n( %s ) || { echo %s; failed=\"$failed %s\"; }",
			shellQuote("    $ "+displayCommand(install, root)), run, shellQuote("    ✗ "+p.Name+" failed"), p.ID)
	}

	if !step.force && len(p.Checks) > 0 {
		probes := make([]string, len(p.Checks))
		for i, c := range p.Checks {
			probes[i] = "command -v " + shellQuote(c) + " >/dev/null 2>&1"
		}
		fmt.Fprintf(&b, "if %s; then echo '    already installed'; else\n%s\nfi\n", strings.Join(probes, " || "), body)
	} else {
		b.WriteString(body + "\n")
	}
	return b.String()
}

func summarizeScript(script string) string {
	lines := strings.Split(strings.TrimSpace(script), "\n")
	if len(lines) == 1 {
		return lines[0]
	}
	return fmt.Sprintf("%s … (+%d lines, last: %s)", lines[0], len(lines)-1, strings.TrimSpace(lines[len(lines)-1]))
}

func githubInstallScript(url, binary string) string {
	return fmt.Sprintf(`set -e
tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
curl -fsSL %[1]s -o "$tmp/asset"
case %[1]s in
  *.tar.gz|*.tgz) tar -xzf "$tmp/asset" -C "$tmp" ;;
  *.tar.xz) tar -xJf "$tmp/asset" -C "$tmp" ;;
  *.zip) unzip -q "$tmp/asset" -d "$tmp" ;;
  *) mv "$tmp/asset" "$tmp/%[2]s" ;;
esac
bin=$(find "$tmp" -type f -name %[3]s | head -n1)
[ -n "$bin" ] || { echo "    binary %[2]s not found in release asset"; exit 1; }
mkdir -p "$HOME/.local/bin"
install -m 0755 "$bin" "$HOME/.local/bin/%[2]s"
echo "    installed $HOME/.local/bin/%[2]s"`, shellQuote(url), binary, shellQuote(binary))
}

func runScript(steps []runStep, env PackagesEnv, dryRun bool) string {
	var b strings.Builder
	b.WriteString("failed=''\n")
	for _, step := range steps {
		b.WriteString(stepScript(step, env, dryRun))
	}
	b.WriteString(`if [ -n "$failed" ]; then printf '\nfailed:%s\n' "$failed"; exit 1; fi
printf '\ndone\n'
`)
	return b.String()
}

func (a *App) runPackages(kind, id, display string, steps []runStep, env PackagesEnv, dryRun bool) string {
	if len(steps) == 0 {
		return "nothing to run"
	}
	if dryRun {
		display += " (dry run)"
	}
	return a.runStreamed(kind, "pkg:"+id, display, a.workspaceRootPath(), "bash", "-c", runScript(steps, env, dryRun))
}

// PackagesInstall installs a single entry, even when it looks installed already.
func (a *App) PackagesInstall(id string, dryRun bool) string {
	st := a.packagesState()
	p, ok := findEntry(st.Manifest, id)
	if !ok {
		return "unknown package: " + id
	}
	if idx, reason := resolveSource(p, st.Env); idx < 0 {
		return "no install source applies: " + reason
	}
	return a.runPackages("pkg-install", id, "install "+id, []runStep{{entry: p, force: true}}, st.Env, dryRun)
}

// PackagesRun installs every enabled entry, optionally limited to one category,
// skipping anything whose check binaries already resolve.
func (a *App) PackagesRun(category string, dryRun bool) string {
	st := a.packagesState()
	steps := []runStep{}
	order := map[string]int{}
	for i, c := range st.Manifest.Categories {
		order[c.ID] = i
	}
	entries := append([]PackageEntry(nil), st.Manifest.Packages...)
	sort.SliceStable(entries, func(i, j int) bool { return order[entries[i].Category] < order[entries[j].Category] })
	for _, p := range entries {
		if p.Disabled || (category != "" && p.Category != category) {
			continue
		}
		steps = append(steps, runStep{entry: p})
	}
	id, display := "all", "run all enabled packages"
	if category != "" {
		id, display = "cat:"+category, "run category "+category
	}
	return a.runPackages("pkg-run", id, display, steps, st.Env, dryRun)
}

// PackagesUninstall removes an entry using its resolved source.
func (a *App) PackagesUninstall(id string, dryRun bool) string {
	st := a.packagesState()
	p, ok := findEntry(st.Manifest, id)
	if !ok {
		return "unknown package: " + id
	}
	idx, reason := resolveSource(p, st.Env)
	if idx < 0 {
		return "no source applies: " + reason
	}
	script, root := sourceUninstall(p.Sources[idx], p, st.Env)
	if script == "" {
		return "no safe uninstall path for " + id + "; add an uninstall command to its source"
	}
	display := displayCommand(script, root)
	if dryRun {
		return a.runStreamed("pkg-uninstall", "pkg:"+id, display+" (dry run)", "", "sh", "-c", `printf 'would run: %s\n' "$1"`, "sh", display)
	}
	if root {
		script = elevate(script, st.Env)
	}
	defer forgetPackageOwners()
	return a.runStreamed("pkg-uninstall", "pkg:"+id, display, a.workspaceRootPath(), "bash", "-c", script)
}

// PackagesInstallAURHelper installs paru or yay, from the repos when the distro
// ships it, otherwise by building the -bin package from the AUR.
func (a *App) PackagesInstallAURHelper(name string, dryRun bool) string {
	if name != "paru" && name != "yay" {
		return "unsupported AUR helper: " + name
	}
	env := detectPackagesEnv(emptyManifest())
	if env.PackageManager != "pacman" {
		return "AUR helpers only apply to Arch-based systems"
	}
	root := "pkexec"
	if env.HasSudo {
		root = "sudo -n"
	} else if !commandExists("pkexec") {
		root = "sudo"
	}
	script := fmt.Sprintf(`set -e
as_root() { %[2]s "$@"; }
if pacman -Si %[1]s >/dev/null 2>&1; then
  echo "==> %[1]s is in the configured repos, installing with pacman"
  as_root pacman -S --needed --noconfirm %[1]s
  exit 0
fi
echo "==> building %[1]s-bin from the AUR"
as_root pacman -S --needed --noconfirm base-devel git
tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
git clone --depth 1 https://aur.archlinux.org/%[1]s-bin.git "$tmp/src"
cd "$tmp/src"
makepkg --noconfirm -f
pkgs=$(ls ./*.pkg.tar.* | grep -v -- '-debug-')
as_root pacman -U --noconfirm $pkgs
echo "==> %[1]s installed"`, name, root)
	display := "install AUR helper " + name
	if dryRun {
		script = "echo " + shellQuote("would run:") + "\ncat <<'EOF'\n" + script + "\nEOF"
		display += " (dry run)"
	}
	return a.runStreamed("pkg-aur", "pkg:aur:"+name, display, "", "bash", "-c", script)
}

// elevator prefers pkexec so the app raises a polkit dialog instead of needing
// a TTY for a sudo password prompt.
func elevator() string {
	if commandExists("pkexec") {
		return "pkexec"
	}
	return "sudo"
}

func shellQuote(s string) string {
	return "'" + strings.ReplaceAll(s, "'", `'\''`) + "'"
}
