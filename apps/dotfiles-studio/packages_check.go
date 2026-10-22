package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"runtime"
	"strings"
	"time"
)

const checkTimeout = 20 * time.Second

// PackagesVerify reports whether an entry is actually installed: its binaries
// resolve and run, and the resolved source's package manager has it registered.
func (a *App) PackagesVerify(id string) VerifyResult {
	st := a.packagesState()
	p, ok := findEntry(st.Manifest, id)
	if !ok {
		return VerifyResult{ID: id, Lines: []string{"✗ unknown package: " + id}}
	}
	info := SystemInfo{PackageManager: st.Env.PackageManager}
	result := VerifyResult{ID: id, Lines: []string{"$ verify " + id}}

	lines, checked, binariesOK := verifyBinaries(id, p.Checks, info)
	result.Lines = append(result.Lines, lines...)

	registeredOK, queried := true, false
	if idx, reason := resolveSource(p, st.Env); idx >= 0 {
		registered, line, q := sourceRegistered(p.Sources[idx], st.Env)
		if q {
			queried, checked, registeredOK = true, true, registered
			result.Lines = append(result.Lines, line)
		}
	} else {
		result.Lines = append(result.Lines, "  no source applies here: "+reason)
	}

	switch {
	case !checked:
		result.Lines = append(result.Lines, "? nothing to verify: add check binaries to "+id)
	case binariesOK && (!queried || registeredOK):
		result.OK = true
		result.Lines = append(result.Lines, "verified")
	default:
		result.Lines = append(result.Lines, "verification failed")
	}
	return result
}

// PackagesCheckSource tests every source of an entry without installing it:
// the package exists in its repo/registry, the URL answers, or the script parses.
func (a *App) PackagesCheckSource(id string) VerifyResult {
	st := a.packagesState()
	p, ok := findEntry(st.Manifest, id)
	if !ok {
		return VerifyResult{ID: id, Lines: []string{"✗ unknown package: " + id}}
	}
	result := VerifyResult{ID: id, Lines: []string{"$ check sources for " + id}}
	if len(p.Sources) == 0 {
		result.Lines = append(result.Lines, "✗ no sources defined")
		return result
	}

	chosen, _ := resolveSource(p, st.Env)
	for i, s := range p.Sources {
		marker := "  "
		if i == chosen {
			marker = "▸ "
		}
		result.Lines = append(result.Lines, marker+"["+s.Method+"] "+firstNonEmpty(s.Package, "script"))
		ok, lines := checkSource(s, p, st.Env)
		for _, line := range lines {
			result.Lines = append(result.Lines, "    "+line)
		}
		if i == chosen {
			result.OK = ok
		}
	}
	switch {
	case chosen < 0:
		result.Lines = append(result.Lines, "✗ none of the sources apply on this machine")
	case result.OK:
		result.Lines = append(result.Lines, "source used here works")
	default:
		result.Lines = append(result.Lines, "source used here is broken")
	}
	return result
}

func verifyBinaries(id string, checks []string, info SystemInfo) (lines []string, checked, ok bool) {
	if len(checks) == 0 {
		return nil, false, true
	}
	for _, name := range checks {
		path, err := exec.LookPath(name)
		if err != nil {
			lines = append(lines, "✗ "+name+" not on PATH")
			continue
		}
		lines = append(lines, "✓ "+name+" → "+path)
		if owner := systemPackageOwner(path, info); owner != "" {
			lines = append(lines, "  owned by "+info.PackageManager+" package "+owner)
		} else {
			lines = append(lines, "  not owned by a system package (manual install)")
		}
		if skipVersionProbe(id) {
			ok = true
			continue
		}
		version, err := probeVersion(path)
		if err != nil {
			lines = append(lines, "  ! "+name+" --version failed: "+firstNonEmpty(version, err.Error()))
			continue
		}
		ok = true
		lines = append(lines, "  "+firstNonEmpty(version, "(no version output)"))
	}
	return lines, true, ok
}

func runQuiet(name string, args ...string) (string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), checkTimeout)
	defer cancel()
	cmd := exec.CommandContext(ctx, name, args...)
	cmd.Env = append(os.Environ(), "TERM=dumb", "NO_COLOR=1", "LC_ALL=C")
	out, err := cmd.CombinedOutput()
	return strings.TrimSpace(stripANSI(string(out))), err
}

func sourceRegistered(s PackageSource, env PackagesEnv) (bool, string, bool) {
	pkgs := strings.Fields(s.Package)
	if len(pkgs) == 0 {
		return false, "", false
	}
	var query func(pkg string) (bool, string)
	switch s.Method {
	case "pacman", "aur":
		if !commandExists("pacman") {
			return false, "", false
		}
		query = func(pkg string) (bool, string) {
			out, err := runQuiet("pacman", "-Q", pkg)
			return err == nil, out
		}
	case "apt":
		if !commandExists("dpkg-query") {
			return false, "", false
		}
		query = func(pkg string) (bool, string) {
			out, err := runQuiet("dpkg-query", "-W", "-f=${Status} ${Version}", pkg)
			return err == nil && strings.HasPrefix(out, "install ok installed"), pkg + " " + strings.TrimPrefix(out, "install ok installed ")
		}
	case "dnf":
		query = func(pkg string) (bool, string) {
			out, err := runQuiet("rpm", "-q", pkg)
			return err == nil, out
		}
	case "flatpak", "snap":
		if !commandExists(s.Method) {
			return false, "", false
		}
		sub := map[string][]string{"flatpak": {"info"}, "snap": {"list"}}[s.Method]
		query = func(pkg string) (bool, string) {
			_, err := runQuiet(s.Method, append(sub, pkg)...)
			return err == nil, pkg
		}
	case "npm":
		if !commandExists("npm") {
			return false, "", false
		}
		query = func(pkg string) (bool, string) {
			_, err := runQuiet("npm", "ls", "-g", "--depth=0", pkg)
			return err == nil, pkg
		}
	case "cargo":
		if !commandExists("cargo") {
			return false, "", false
		}
		list, _ := runQuiet("cargo", "install", "--list")
		query = func(pkg string) (bool, string) {
			return strings.Contains("\n"+list, "\n"+pkg+" v"), pkg
		}
	case "pipx":
		if !commandExists("pipx") {
			return false, "", false
		}
		list, _ := runQuiet("pipx", "list", "--short")
		query = func(pkg string) (bool, string) {
			return strings.Contains("\n"+list, "\n"+pkg+" "), pkg
		}
	default:
		return false, "", false
	}

	parts := []string{}
	all := true
	for _, pkg := range pkgs {
		ok, detail := query(pkg)
		if ok {
			parts = append(parts, "✓ "+s.Method+" "+detail)
		} else {
			all = false
			parts = append(parts, "✗ "+s.Method+" package "+pkg+" not installed")
		}
	}
	return all, strings.Join(parts, "\n"), true
}

func checkSource(s PackageSource, p PackageEntry, env PackagesEnv) (bool, []string) {
	pkgs := strings.Fields(s.Package)
	switch s.Method {
	case "pacman":
		if !commandExists("pacman") {
			return false, []string{"- pacman not available here"}
		}
		return eachPackage(pkgs, func(pkg string) (bool, string) {
			if out, err := runQuiet("pacman", "-Si", pkg); err == nil {
				return true, "✓ " + pkg + " in repos " + pacmanField(out, "Version")
			}
			if n, err := aurLookup(pkg); err == nil && n > 0 {
				return false, "✗ " + pkg + " not in repos, but it is in the AUR — use the aur method"
			}
			return false, "✗ " + pkg + " not found in the configured repos"
		})
	case "aur":
		return eachPackage(pkgs, func(pkg string) (bool, string) {
			n, err := aurLookup(pkg)
			if err != nil {
				return false, "✗ AUR lookup failed: " + err.Error()
			}
			if n == 0 {
				if commandExists("pacman") {
					if _, err := runQuiet("pacman", "-Si", pkg); err == nil {
						return true, "✓ " + pkg + " not in AUR but in repos; the helper will install it"
					}
				}
				return false, "✗ " + pkg + " not in the AUR"
			}
			return true, "✓ " + pkg + " in the AUR"
		})
	case "apt":
		if !commandExists("apt-cache") {
			return false, []string{"- apt not available here"}
		}
		return eachPackage(pkgs, func(pkg string) (bool, string) {
			out, _ := runQuiet("apt-cache", "policy", pkg)
			candidate := pacmanField(out, "Candidate")
			if candidate == "" || candidate == "(none)" {
				return false, "✗ " + pkg + " has no install candidate"
			}
			return true, "✓ " + pkg + " candidate " + candidate
		})
	case "dnf":
		if !commandExists("dnf") {
			return false, []string{"- dnf not available here"}
		}
		return eachPackage(pkgs, func(pkg string) (bool, string) {
			if _, err := runQuiet("dnf", "-q", "info", pkg); err != nil {
				return false, "✗ " + pkg + " not found"
			}
			return true, "✓ " + pkg + " available"
		})
	case "flatpak":
		if !commandExists("flatpak") {
			return false, []string{"- flatpak not available here"}
		}
		return eachPackage(pkgs, func(pkg string) (bool, string) {
			if _, err := runQuiet("flatpak", "remote-info", "flathub", pkg); err != nil {
				return false, "✗ " + pkg + " not on flathub"
			}
			return true, "✓ " + pkg + " on flathub"
		})
	case "snap":
		if !commandExists("snap") {
			return false, []string{"- snap not available here"}
		}
		return eachPackage(pkgs, func(pkg string) (bool, string) {
			if _, err := runQuiet("snap", "info", pkg); err != nil {
				return false, "✗ " + pkg + " not in the snap store"
			}
			return true, "✓ " + pkg + " in the snap store"
		})
	case "npm":
		return eachPackage(pkgs, func(pkg string) (bool, string) {
			var meta struct {
				DistTags map[string]string `json:"dist-tags"`
			}
			if err := getJSON("https://registry.npmjs.org/"+strings.ReplaceAll(pkg, "/", "%2f"), &meta); err != nil {
				return false, "✗ " + pkg + ": " + err.Error()
			}
			return true, "✓ " + pkg + " " + meta.DistTags["latest"] + " on npm"
		})
	case "cargo":
		return eachPackage(pkgs, func(pkg string) (bool, string) {
			var meta struct {
				Crate struct {
					MaxVersion string `json:"max_version"`
				} `json:"crate"`
			}
			if err := getJSON("https://crates.io/api/v1/crates/"+url.PathEscape(pkg), &meta); err != nil {
				return false, "✗ " + pkg + ": " + err.Error()
			}
			return true, "✓ " + pkg + " " + meta.Crate.MaxVersion + " on crates.io"
		})
	case "pipx":
		return eachPackage(pkgs, func(pkg string) (bool, string) {
			var meta struct {
				Info struct {
					Version string `json:"version"`
				} `json:"info"`
			}
			if err := getJSON("https://pypi.org/pypi/"+url.PathEscape(pkg)+"/json", &meta); err != nil {
				return false, "✗ " + pkg + ": " + err.Error()
			}
			return true, "✓ " + pkg + " " + meta.Info.Version + " on PyPI"
		})
	case "curl":
		status, err := httpStatus(s.Package)
		if err != nil {
			return false, []string{"✗ " + err.Error()}
		}
		if status >= 400 {
			return false, []string{fmt.Sprintf("✗ installer URL answered %d", status)}
		}
		shell := firstNonEmpty(s.Shell, "sh")
		if !commandExists(shell) {
			return false, []string{fmt.Sprintf("✓ installer URL answered %d", status), "✗ " + shell + " not on PATH"}
		}
		return true, []string{fmt.Sprintf("✓ installer URL answered %d", status)}
	case "github":
		asset, err := resolveGithubAsset(s.Package)
		if err != nil {
			return false, []string{"✗ " + err.Error()}
		}
		return true, []string{"✓ " + asset.Tag + " → " + asset.Name, "  binary " + githubBinary(s, p) + " will be installed to ~/.local/bin"}
	case "shell":
		if out, err := runQuiet("bash", "-n", "-c", s.Script); err != nil {
			return false, []string{"✗ script does not parse: " + firstNonEmpty(out, err.Error())}
		}
		lines := []string{"✓ script parses"}
		if strings.Contains(s.Script, "sudo ") {
			lines = append(lines, "! script calls sudo; without passwordless sudo it will fail inside the GUI")
		}
		return true, lines
	}
	return false, []string{"✗ unknown method " + s.Method}
}

func eachPackage(pkgs []string, check func(string) (bool, string)) (bool, []string) {
	if len(pkgs) == 0 {
		return false, []string{"✗ no package name"}
	}
	all := true
	lines := []string{}
	for _, pkg := range pkgs {
		ok, line := check(pkg)
		all = all && ok
		lines = append(lines, line)
	}
	return all, lines
}

func pacmanField(out, field string) string {
	for _, line := range strings.Split(out, "\n") {
		key, value, ok := strings.Cut(line, ":")
		if ok && strings.TrimSpace(key) == field {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

var httpClient = &http.Client{Timeout: 15 * time.Second}

func httpGet(target string) (*http.Response, error) {
	req, err := http.NewRequest(http.MethodGet, target, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "dotfiles-studio")
	if token := os.Getenv("GITHUB_TOKEN"); token != "" && strings.HasPrefix(target, "https://api.github.com/") {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	return httpClient.Do(req)
}

func httpStatus(target string) (int, error) {
	resp, err := httpGet(target)
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()
	_, _ = io.CopyN(io.Discard, resp.Body, 4096)
	return resp.StatusCode, nil
}

func getJSON(target string, into any) error {
	resp, err := httpGet(target)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusNotFound {
		return errors.New("not found")
	}
	if resp.StatusCode >= 400 {
		return fmt.Errorf("HTTP %d", resp.StatusCode)
	}
	return json.NewDecoder(io.LimitReader(resp.Body, 8<<20)).Decode(into)
}

func aurLookup(pkg string) (int, error) {
	var res struct {
		ResultCount int `json:"resultcount"`
	}
	err := getJSON("https://aur.archlinux.org/rpc/v5/info?arg[]="+url.QueryEscape(pkg), &res)
	return res.ResultCount, err
}

type githubAsset struct {
	Name string
	URL  string
	Tag  string
}

func resolveGithubAsset(repo string) (githubAsset, error) {
	repo = strings.Trim(strings.TrimPrefix(strings.TrimSpace(repo), "https://github.com/"), "/")
	if strings.Count(repo, "/") != 1 {
		return githubAsset{}, fmt.Errorf("github source must be owner/repo, got %q", repo)
	}
	var release struct {
		TagName string `json:"tag_name"`
		Assets  []struct {
			Name string `json:"name"`
			URL  string `json:"browser_download_url"`
		} `json:"assets"`
	}
	if err := getJSON("https://api.github.com/repos/"+repo+"/releases/latest", &release); err != nil {
		return githubAsset{}, fmt.Errorf("latest release of %s: %w", repo, err)
	}
	best, bestScore := -1, 0
	for i, a := range release.Assets {
		if score := assetScore(a.Name, runtime.GOARCH); score > bestScore {
			best, bestScore = i, score
		}
	}
	if best < 0 {
		return githubAsset{}, fmt.Errorf("%s %s has no linux/%s archive", repo, release.TagName, runtime.GOARCH)
	}
	a := release.Assets[best]
	return githubAsset{Name: a.Name, URL: a.URL, Tag: release.TagName}, nil
}

var archAliases = map[string][]string{
	"amd64": {"x86_64", "amd64", "x64"},
	"arm64": {"arm64", "aarch64"},
}

// assetScore ranks a release asset for linux on goarch; 0 means unusable.
func assetScore(name, goarch string) int {
	n := strings.ToLower(name)
	for _, bad := range []string{".sha256", ".sha512", "checksums", ".sig", ".asc", ".pem", ".sbom", ".deb", ".rpm", ".apk", ".txt", ".json", ".msi", ".dmg"} {
		if strings.Contains(n, bad) {
			return 0
		}
	}
	if !strings.Contains(n, "linux") {
		return 0
	}
	matched := false
	for _, alias := range archAliases[goarch] {
		if strings.Contains(n, alias) {
			matched = true
			break
		}
	}
	if !matched {
		return 0
	}
	score := 1
	switch {
	case strings.HasSuffix(n, ".tar.gz"), strings.HasSuffix(n, ".tgz"):
		score += 3
	case strings.HasSuffix(n, ".tar.xz"):
		score += 2
	case strings.HasSuffix(n, ".zip"):
		score += 1
	}
	return score
}
