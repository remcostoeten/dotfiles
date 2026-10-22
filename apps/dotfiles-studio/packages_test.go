package main

import (
	"strings"
	"testing"
)

func TestResolveSourcePicksFirstApplicable(t *testing.T) {
	env := PackagesEnv{PackageManager: "apt"}
	p := PackageEntry{ID: "fd", Sources: []PackageSource{{Method: "pacman", Package: "fd"}, {Method: "apt", Package: "fd-find"}}}
	if idx, _ := resolveSource(p, env); idx != 1 {
		t.Fatalf("want apt source, got %d", idx)
	}
	env.PackageManager = "dnf"
	idx, reason := resolveSource(p, env)
	if idx != -1 || !strings.Contains(reason, "pacman:") || !strings.Contains(reason, "apt:") {
		t.Fatalf("want no source with reasons, got %d %q", idx, reason)
	}
}

func TestAURNeedsHelper(t *testing.T) {
	p := PackageEntry{ID: "x", Sources: []PackageSource{{Method: "aur", Package: "x-bin"}}}
	env := PackagesEnv{PackageManager: "pacman"}
	if idx, _ := resolveSource(p, env); idx != -1 {
		t.Fatal("aur must not apply without a helper")
	}
	env.AURHelpers = []string{"yay"}
	env.AURHelper = effectiveAURHelper("auto", env)
	if idx, _ := resolveSource(p, env); idx != 0 {
		t.Fatal("aur should apply with yay installed")
	}
	if effectiveAURHelper("paru", env) != "" || effectiveAURHelper("none", env) != "" {
		t.Fatal("explicit helper preference must be honoured")
	}
	env.HasSudo = true
	script, root := sourceInstall(p.Sources[0], p, env)
	if root || script != "yay -S --needed --noconfirm x-bin" {
		t.Fatalf("aur script = %q root=%v", script, root)
	}
}

func TestSourceInstallCommands(t *testing.T) {
	env := PackagesEnv{PackageManager: "pacman"}
	p := PackageEntry{ID: "rustup"}
	cases := []struct {
		src  PackageSource
		want string
		root bool
	}{
		{PackageSource{Method: "pacman", Package: "ripgrep  fd"}, "pacman -S --needed --noconfirm ripgrep fd", true},
		{PackageSource{Method: "curl", Package: "https://sh.rustup.rs", Shell: "bash", Args: "-y"}, "curl -fsSL 'https://sh.rustup.rs' | bash -s -- -y", false},
		{PackageSource{Method: "snap", Package: "spotify", Args: "--classic"}, "snap install spotify --classic", true},
		{PackageSource{Method: "shell", Script: "echo hi"}, "echo hi", false},
	}
	for _, c := range cases {
		got, root := sourceInstall(c.src, p, env)
		if got != c.want || root != c.root {
			t.Errorf("%s: got %q root=%v, want %q root=%v", c.src.Method, got, root, c.want, c.root)
		}
	}
}

func TestUninstallProtectedAndOverride(t *testing.T) {
	env := PackagesEnv{PackageManager: "pacman"}
	git := PackageEntry{ID: "git", Sources: []PackageSource{{Method: "pacman", Package: "git"}}}
	if s, _ := sourceUninstall(git.Sources[0], git, env); s != "" {
		t.Errorf("git is protected, got %q", s)
	}
	custom := PackageEntry{ID: "tool", Sources: []PackageSource{{Method: "shell", Script: "true", Uninstall: "rm -rf ~/.tool"}}}
	if s, _ := sourceUninstall(custom.Sources[0], custom, env); s != "rm -rf ~/.tool" {
		t.Errorf("override ignored: %q", s)
	}
}

func TestValidateManifest(t *testing.T) {
	m := emptyManifest()
	m.Packages = []PackageEntry{{ID: "a", Sources: []PackageSource{{Method: "npm", Package: "a"}}}, {ID: "a"}}
	if err := validateManifest(m); err == nil || !strings.Contains(err.Error(), "duplicate") {
		t.Errorf("want duplicate error, got %v", err)
	}
	m.Packages = []PackageEntry{{ID: "Bad Id"}}
	if err := validateManifest(m); err == nil {
		t.Error("want invalid id error")
	}
	m.Packages = []PackageEntry{{ID: "b", Sources: []PackageSource{{Method: "shell"}}}}
	if err := validateManifest(m); err == nil {
		t.Error("want empty script error")
	}
}

func TestNormalizeCreatesMissingCategories(t *testing.T) {
	m := PackageManifest{Packages: []PackageEntry{{ID: "x", Category: "dev-tools"}}}
	normalizeManifest(&m)
	if len(m.Categories) != 1 || m.Categories[0].Name != "Dev Tools" || m.AURHelper != "auto" {
		t.Errorf("normalize = %+v", m)
	}
}

func TestStepScriptSkipsInstalledAndDryRuns(t *testing.T) {
	env := PackagesEnv{PackageManager: "pacman", HasSudo: true}
	p := PackageEntry{ID: "rg", Name: "ripgrep", Checks: []string{"rg"}, Sources: []PackageSource{{Method: "pacman", Package: "ripgrep"}}}
	script := stepScript(runStep{entry: p}, env, true)
	if !strings.Contains(script, "command -v 'rg'") || !strings.Contains(script, "would run: sudo pacman -S --needed --noconfirm ripgrep") {
		t.Errorf("dry run step:\n%s", script)
	}
	forced := stepScript(runStep{entry: p, force: true}, env, false)
	if strings.Contains(forced, "command -v") || !strings.Contains(forced, "sudo -n sh -c 'pacman -S") {
		t.Errorf("forced step:\n%s", forced)
	}
	full := runScript([]runStep{{entry: p}}, env, true)
	if out, err := runQuiet("bash", "-n", "-c", full); err != nil {
		t.Errorf("run script does not parse: %s\n%s", out, full)
	}
}

func TestAssetScore(t *testing.T) {
	best := ""
	bestScore := 0
	for _, name := range []string{
		"lazygit_0.44_Darwin_x86_64.tar.gz",
		"lazygit_0.44_Linux_x86_64.tar.gz",
		"lazygit_0.44_Linux_arm64.tar.gz",
		"checksums.txt",
		"lazygit_0.44_Linux_x86_64.tar.gz.sha256",
	} {
		if s := assetScore(name, "amd64"); s > bestScore {
			best, bestScore = name, s
		}
	}
	if best != "lazygit_0.44_Linux_x86_64.tar.gz" {
		t.Errorf("picked %q", best)
	}
}
