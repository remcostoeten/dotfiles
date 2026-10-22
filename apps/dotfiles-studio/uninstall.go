package main

import (
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"golang.org/x/sys/unix"
)

// VerifyResult is the outcome of probing one catalog item on this machine.
type VerifyResult struct {
	ID    string   `json:"id"`
	OK    bool     `json:"ok"`
	Lines []string `json:"lines"`
}

// protectedPackages are base-system dependencies the app never offers to remove.
var protectedPackages = map[string]bool{
	"git": true, "curl": true, "wget": true, "build-essential": true, "ca-certificates": true,
	"gnupg": true, "python3": true, "python3-pip": true, "software-properties-common": true,
}

type uninstallPlan struct {
	script  string
	root    bool
	display string
}

func newPlan(script string, root bool) uninstallPlan {
	display := script
	if root {
		display = "sudo " + script
	}
	return uninstallPlan{script: script, root: root, display: display}
}

// RunUninstall removes a single catalog item, streaming output through the same
// install:* events as RunInstall. It returns "" on success or an error string.
func (a *App) RunUninstall(id string, dryRun bool) string {
	info := a.SystemInfo()
	item, ok := findCatalogItem(id, info)
	if !ok {
		return "unknown package: " + id
	}
	plan := uninstallPlanFor(item, info)
	if plan.script == "" {
		return "no uninstall path for " + id
	}
	if item.Method == "npm" {
		if registered, line, _ := packageRegistered(item, info); !registered {
			return strings.TrimPrefix(line, "✗ ")
		}
	}

	if dryRun {
		return a.runStreamed("uninstall", id, plan.display+" (dry run)", "", "sh", "-c", `printf 'would run: %s\n' "$1"`, "sh", plan.display)
	}
	if plan.root {
		return a.runStreamed("uninstall", id, plan.display, "", elevator(), "sh", "-c", plan.script)
	}
	return a.runStreamed("uninstall", id, plan.display, "", "sh", "-c", plan.script)
}

// VerifyInstall checks that an item's binaries resolve and run, and that the
// owning package manager still has it registered.
func (a *App) VerifyInstall(id string) VerifyResult {
	info := a.SystemInfo()
	item, ok := findCatalogItem(id, info)
	if !ok {
		return VerifyResult{ID: id, Lines: []string{"✗ unknown package: " + id}}
	}

	result := VerifyResult{ID: id, Lines: []string{"$ verify " + id}}
	lines, checked, binariesOK := verifyBinaries(item.ID, item.Checks, info)
	result.Lines = append(result.Lines, lines...)

	registered, line, queried := packageRegistered(item, info)
	if queried {
		checked = true
		result.Lines = append(result.Lines, line)
	}

	switch {
	case !checked:
		result.Lines = append(result.Lines, "? nothing to verify for "+id)
	case binariesOK && (!queried || registered):
		result.OK = true
		result.Lines = append(result.Lines, "verified")
	default:
		result.Lines = append(result.Lines, "verification failed")
	}
	return result
}

func findCatalogItem(id string, info SystemInfo) (CatalogItem, bool) {
	for _, cat := range baseCatalog() {
		for _, item := range cat.Items {
			if item.ID == id {
				resolveCatalogItem(&item, info)
				return item, true
			}
		}
	}
	return CatalogItem{}, false
}

func uninstallPlanFor(item CatalogItem, info SystemInfo) uninstallPlan {
	if !item.Available || item.PackageName == "__skip__" || protectedPackages[item.ID] {
		return uninstallPlan{}
	}

	switch item.Method {
	case "apt", "pacman":
		return packageRemovePlan(item.PackageName, info)
	case "snap":
		return newPlan("snap remove "+item.ID, true)
	case "npm":
		return newPlan("npm uninstall -g "+npmPackageName(item.ID), false)
	}

	binary := resolvedBinary(item)
	if binary != "" {
		if owner := systemPackageOwner(binary, info); owner != "" {
			return packageRemovePlan(owner, info)
		}
	}

	switch item.ID {
	case "rustup":
		if binary == "" {
			return uninstallPlan{}
		}
		return newPlan("rustup self uninstall -y", false)
	case "starship", "lazygit", "lazydocker":
		if binary == "" {
			return uninstallPlan{}
		}
		return newPlan("rm -f "+shellQuote(binary), !dirWritable(filepath.Dir(binary)))
	}

	root, ok := userInstallRoot(item.ID)
	if !ok || binary == "" || !pathWithin(binary, root) {
		return uninstallPlan{}
	}
	if item.ID == "uv" {
		return newPlan("rm -f "+shellQuote(filepath.Join(root, "uv"))+" "+shellQuote(filepath.Join(root, "uvx")), false)
	}
	if item.ID == "zed" {
		return newPlan("rm -rf "+shellQuote(root)+" "+shellQuote(binary), false)
	}
	return newPlan("rm -rf "+shellQuote(root), false)
}

func userInstallRoot(id string) (string, bool) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", false
	}
	switch id {
	case "bun":
		return filepath.Join(home, ".bun"), true
	case "pnpm":
		return firstNonEmpty(os.Getenv("PNPM_HOME"), filepath.Join(home, ".local", "share", "pnpm")), true
	case "fnm":
		return filepath.Join(home, ".local", "share", "fnm"), true
	case "uv":
		return filepath.Join(home, ".local", "bin"), true
	case "zed":
		return filepath.Join(home, ".local", "zed.app"), true
	case "opencode":
		return filepath.Join(home, ".opencode"), true
	}
	return "", false
}

func pathWithin(path, root string) bool {
	if real, err := filepath.EvalSymlinks(path); err == nil {
		path = real
	}
	rel, err := filepath.Rel(root, path)
	return err == nil && rel != ".." && !strings.HasPrefix(rel, "../")
}

func packageRemovePlan(pkg string, info SystemInfo) uninstallPlan {
	switch info.PackageManager {
	case "pacman":
		return newPlan("pacman -Rs --noconfirm "+pkg, true)
	case "apt":
		return newPlan("apt-get remove -y "+pkg, true)
	}
	return uninstallPlan{}
}

func warmCatalogOwners(cats []CatalogCategory, info SystemInfo) {
	paths := []string{}
	for _, cat := range cats {
		for _, item := range cat.Items {
			item.Checks = checksForPackage(item.ID, item.Check, info)
			if binary := resolvedBinary(item); binary != "" {
				paths = append(paths, ownerCandidates(binary)...)
			}
		}
	}
	warmPackageOwners(paths, info)
}

func npmPackageName(id string) string {
	if id == "gemini" {
		return "@google/gemini-cli"
	}
	return id
}

func resolvedBinary(item CatalogItem) string {
	for _, name := range item.Checks {
		if path, err := exec.LookPath(name); err == nil {
			return path
		}
	}
	return ""
}

var (
	ownerMu    sync.Mutex
	ownerCache = map[string]string{}
)

func forgetPackageOwners() {
	ownerMu.Lock()
	ownerCache = map[string]string{}
	ownerMu.Unlock()
}

func ownerCandidates(path string) []string {
	if real, err := filepath.EvalSymlinks(path); err == nil && real != path {
		return []string{path, real}
	}
	return []string{path}
}

func systemPackageOwner(path string, info SystemInfo) string {
	candidates := ownerCandidates(path)
	warmPackageOwners(candidates, info)
	ownerMu.Lock()
	defer ownerMu.Unlock()
	for _, candidate := range candidates {
		if owner := ownerCache[candidate]; owner != "" {
			return owner
		}
	}
	return ""
}

// warmPackageOwners resolves every uncached path in one package-manager call,
// since each pacman/dpkg invocation costs ~100ms regardless of path count.
func warmPackageOwners(paths []string, info SystemInfo) {
	ownerMu.Lock()
	missing := []string{}
	for _, path := range paths {
		if _, ok := ownerCache[path]; !ok {
			missing = append(missing, path)
		}
	}
	ownerMu.Unlock()
	if len(missing) == 0 {
		return
	}

	found := map[string]string{}
	switch info.PackageManager {
	case "pacman":
		out, _ := exec.Command("pacman", append([]string{"-Qo"}, missing...)...).Output()
		for _, line := range strings.Split(string(out), "\n") {
			path, rest, ok := strings.Cut(line, " is owned by ")
			if fields := strings.Fields(rest); ok && len(fields) > 0 {
				found[path] = fields[0]
			}
		}
	case "apt":
		out, _ := exec.Command("dpkg-query", append([]string{"-S"}, missing...)...).Output()
		for _, line := range strings.Split(string(out), "\n") {
			owner, path, ok := strings.Cut(line, ": ")
			if ok {
				owner, _, _ = strings.Cut(owner, ",")
				found[strings.TrimSpace(path)] = strings.TrimSpace(owner)
			}
		}
	}

	ownerMu.Lock()
	for _, path := range missing {
		ownerCache[path] = found[path]
	}
	ownerMu.Unlock()
}

func packageRegistered(item CatalogItem, info SystemInfo) (registered bool, line string, queried bool) {
	switch item.Method {
	case "apt":
		out, err := exec.Command("dpkg-query", "-W", "-f=${Status} ${Version}", item.PackageName).Output()
		status := strings.TrimSpace(string(out))
		if err == nil && strings.HasPrefix(status, "install ok installed") {
			return true, "✓ apt package " + item.PackageName + " " + strings.TrimPrefix(status, "install ok installed "), true
		}
		return false, "✗ apt package " + item.PackageName + " not installed", true
	case "pacman":
		out, err := exec.Command("pacman", "-Q", item.PackageName).Output()
		if err == nil {
			return true, "✓ pacman package " + strings.TrimSpace(string(out)), true
		}
		return false, "✗ pacman package " + item.PackageName + " not installed", true
	case "snap":
		if !commandExists("snap") {
			return false, "", false
		}
		if exec.Command("snap", "list", item.ID).Run() == nil {
			return true, "✓ snap " + item.ID + " installed", true
		}
		return false, "✗ snap " + item.ID + " not installed", true
	case "npm":
		if !commandExists("npm") {
			return false, "✗ npm not on PATH", true
		}
		pkg := npmPackageName(item.ID)
		if exec.Command("npm", "ls", "-g", "--depth=0", pkg).Run() == nil {
			return true, "✓ npm global package " + pkg, true
		}
		return false, "✗ npm global package " + pkg + " not installed", true
	}
	return false, "", false
}

// skipVersionProbe lists GUI apps whose --version flag opens a window instead of printing.
func skipVersionProbe(id string) bool {
	return id == "spotify"
}

func probeVersion(path string) (string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, path, "--version")
	cmd.Env = append(os.Environ(), "TERM=dumb", "NO_COLOR=1")
	out, err := cmd.CombinedOutput()
	for _, line := range strings.Split(stripANSI(string(out)), "\n") {
		if line = strings.TrimSpace(line); line != "" {
			return line, err
		}
	}
	return "", err
}

func dirWritable(dir string) bool {
	return unix.Access(dir, unix.W_OK) == nil
}
