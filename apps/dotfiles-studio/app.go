package main

import (
	"bufio"
	"context"
	"io"
	"os"
	"os/exec"
	"os/user"
	"path/filepath"
	"regexp"
	"runtime"
	"strconv"
	"strings"
	"sync"

	wruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// App is the Wails-bound backend. The renderer is only a client: every install
// action and system probe runs here, in Go.
type App struct {
	ctx           context.Context
	workspaceRoot string

	installMu     sync.Mutex
	installing    bool
	installCancel context.CancelFunc
}

// SystemInfo is the read-only machine summary shown on first launch.
type SystemInfo struct {
	Hostname         string `json:"hostname"`
	User             string `json:"user"`
	OS               string `json:"os"`
	OSFamily         string `json:"osFamily"`
	Distro           string `json:"distro"`
	Kernel           string `json:"kernel"`
	Arch             string `json:"arch"`
	Desktop          string `json:"desktop"`
	SessionType      string `json:"sessionType"`
	PackageManager   string `json:"packageManager"`
	Shell            string `json:"shell"`
	Uptime           string `json:"uptime"`
	CPU              string `json:"cpu"`
	Memory           string `json:"memory"`
	HasSudo          bool   `json:"hasSudo"`
	WorkspaceRoot    string `json:"workspaceRoot"`
	SetupScriptFound bool   `json:"setupScriptFound"`
}

// CatalogItem is a single installable thing inside a category.
type CatalogItem struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	// Check is the binary used to detect whether the item is already present.
	Check string `json:"check"`
	// Checks includes distro-specific binary aliases, e.g. fd/fdfind and bat/batcat.
	Checks []string `json:"checks"`
	// Installable reports whether `setup.sh --package <id>` understands this id.
	Installable        bool   `json:"installable"`
	Available          bool   `json:"available"`
	AvailabilityReason string `json:"availabilityReason"`
	Method             string `json:"method"`
	PackageName        string `json:"packageName"`
	Command            string `json:"command"`
	RequiresSudo       bool   `json:"requiresSudo"`
}

// CatalogCategory mirrors a `setup.sh --category <id>` group.
type CatalogCategory struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	// Kind drives the button label: "packages" | "drivers" | "fonts" | "desktop".
	Kind               string        `json:"kind"`
	Command            string        `json:"command"`
	Available          bool          `json:"available"`
	AvailabilityReason string        `json:"availabilityReason"`
	Items              []CatalogItem `json:"items"`
}

// NewApp creates a new App application struct.
func NewApp() *App {
	return &App{}
}

// startup is called when the app starts. The context is saved so we can call
// the runtime methods (event emission, etc.).
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

// SystemInfo probes the current machine. Read-only; safe to call repeatedly.
func (a *App) SystemInfo() SystemInfo {
	info := SystemInfo{}
	info.Hostname, _ = os.Hostname()
	if u, err := user.Current(); err == nil {
		info.User = u.Username
	}

	osr := parseOSRelease()
	info.OS = firstNonEmpty(osr["PRETTY_NAME"], osr["NAME"], "Linux")
	info.Distro = firstNonEmpty(osr["ID"], "unknown")
	info.OSFamily = osFamily(osr)

	info.Kernel = readKernel()
	info.Arch = readArch()
	info.Desktop = detectDesktopSession()
	info.SessionType = strings.TrimSpace(os.Getenv("XDG_SESSION_TYPE"))
	info.PackageManager = detectPackageManager()
	info.Shell = shellName()
	info.Uptime = readUptime()
	info.CPU = readCPU()
	info.Memory = readMemory()
	info.HasSudo = hasPasswordlessSudo()

	root := a.workspaceRootPath()
	info.WorkspaceRoot = root
	info.SetupScriptFound = fileExists(setupScriptPath(root))
	return info
}

// Catalog returns the installable categories and items, mirroring setup.sh.
func (a *App) Catalog() []CatalogCategory {
	return catalogForSystem(a.SystemInfo())
}

// CheckPresence reports, per check group, whether any binary in the group resolves on PATH.
func (a *App) CheckPresence(names []string) map[string]bool {
	out := make(map[string]bool, len(names))
	for _, name := range names {
		if name == "" {
			continue
		}
		out[name] = checkAnyCommand(name)
	}
	return out
}

// RunInstall executes `setup.sh` for a category or package, streaming output as
// Wails events. It returns "" on success or an error string. Events emitted:
//
//	install:start {kind, id, command}
//	install:line  string
//	install:exit  {code, ok}
func (a *App) RunInstall(kind, id string, dryRun bool) string {
	a.installMu.Lock()
	if a.installing {
		a.installMu.Unlock()
		return "an install is already running"
	}

	root := a.workspaceRootPath()
	script := setupScriptPath(root)
	if !fileExists(script) {
		a.installMu.Unlock()
		return "setup.sh not found at " + script
	}

	args := []string{script}
	switch kind {
	case "all":
		// no extra args: setup.sh installs every category
	case "category":
		args = append(args, "--category", id)
	case "package":
		args = append(args, "--package", id)
	default:
		a.installMu.Unlock()
		return "unknown install kind: " + kind
	}
	if dryRun {
		args = append(args, "--dry-run")
	}

	ctx, cancel := context.WithCancel(context.Background())
	a.installCancel = cancel
	a.installing = true
	a.installMu.Unlock()

	defer func() {
		a.installMu.Lock()
		a.installing = false
		a.installCancel = nil
		a.installMu.Unlock()
	}()

	cmd := exec.CommandContext(ctx, "bash", args...)
	cmd.Dir = root
	cmd.Env = append(os.Environ(), "TERM=dumb", "NO_COLOR=1")

	pr, pw := io.Pipe()
	cmd.Stdout = pw
	cmd.Stderr = pw

	wruntime.EventsEmit(a.ctx, "install:start", map[string]interface{}{
		"kind":    kind,
		"id":      id,
		"command": "setup.sh " + strings.Join(args[1:], " "),
	})

	if err := cmd.Start(); err != nil {
		_ = pw.Close()
		wruntime.EventsEmit(a.ctx, "install:exit", map[string]interface{}{"code": -1, "ok": false})
		return err.Error()
	}

	done := make(chan struct{})
	go func() {
		scanner := bufio.NewScanner(pr)
		scanner.Buffer(make([]byte, 1024*1024), 1024*1024)
		for scanner.Scan() {
			line := stripANSI(scanner.Text())
			line = strings.TrimRight(line, "\r")
			wruntime.EventsEmit(a.ctx, "install:line", line)
		}
		close(done)
	}()

	waitErr := cmd.Wait()
	_ = pw.Close()
	<-done

	code := 0
	if waitErr != nil {
		code = 1
		if exitErr, ok := waitErr.(*exec.ExitError); ok {
			code = exitErr.ExitCode()
		}
	}
	wruntime.EventsEmit(a.ctx, "install:exit", map[string]interface{}{
		"code": code,
		"ok":   waitErr == nil,
	})

	if waitErr != nil {
		return waitErr.Error()
	}
	return ""
}

// CancelInstall stops a running install, if any.
func (a *App) CancelInstall() {
	a.installMu.Lock()
	defer a.installMu.Unlock()
	if a.installCancel != nil {
		a.installCancel()
	}
}

// ---------------------------------------------------------------------------
// Catalog definition (mirrors setup/setup.sh categories and packages)
// ---------------------------------------------------------------------------

func catalogForSystem(info SystemInfo) []CatalogCategory {
	cats := baseCatalog()
	for ci := range cats {
		cat := &cats[ci]
		cat.Command = "setup.sh --category " + cat.ID
		cat.Available = isCategoryAvailable(*cat, info)
		cat.AvailabilityReason = categoryAvailabilityReason(*cat, info)
		for ii := range cat.Items {
			resolveCatalogItem(&cat.Items[ii], info)
		}
	}
	return cats
}

func baseCatalog() []CatalogCategory {
	return []CatalogCategory{
		{
			ID: "essential", Name: "Essentials", Kind: "packages",
			Description: "Core build tools and the fish shell.",
			Items: []CatalogItem{
				{ID: "git", Name: "git", Check: "git", Installable: true},
				{ID: "curl", Name: "curl", Check: "curl", Installable: true},
				{ID: "wget", Name: "wget", Check: "wget", Installable: true},
				{ID: "build-essential", Name: "build tools", Check: "gcc", Installable: true},
				{ID: "ca-certificates", Name: "CA certificates", Check: "", Installable: true},
				{ID: "gnupg", Name: "GnuPG", Check: "gpg", Installable: true},
				{ID: "software-properties-common", Name: "software-properties", Check: "add-apt-repository", Installable: true},
				{ID: "fish", Name: "fish shell", Check: "fish", Installable: true},
			},
		},
		{
			ID: "langs", Name: "Languages", Kind: "packages",
			Description: "Runtimes and language toolchains.",
			Items: []CatalogItem{
				{ID: "python3", Name: "Python 3", Check: "python3", Installable: true},
				{ID: "python3-pip", Name: "pip", Check: "pip3", Installable: true},
				{ID: "python3-venv", Name: "venv", Check: "", Installable: true},
				{ID: "nodejs", Name: "Node.js", Check: "node", Installable: true},
				{ID: "npm", Name: "npm", Check: "npm", Installable: true},
				{ID: "pnpm", Name: "pnpm", Check: "pnpm", Installable: true},
				{ID: "bun", Name: "Bun", Check: "bun", Installable: true},
				{ID: "rustup", Name: "Rust (rustup)", Check: "rustc", Installable: true},
				{ID: "dotnet", Name: ".NET", Check: "dotnet", Installable: false},
			},
		},
		{
			ID: "tools", Name: "CLI tools", Kind: "packages",
			Description: "Editors and modern command-line utilities.",
			Items: []CatalogItem{
				{ID: "neovim", Name: "Neovim", Check: "nvim", Installable: true},
				{ID: "vim", Name: "Vim", Check: "vim", Installable: true},
				{ID: "ripgrep", Name: "ripgrep", Check: "rg", Installable: true},
				{ID: "fd-find", Name: "fd", Check: "fd", Installable: true},
				{ID: "fzf", Name: "fzf", Check: "fzf", Installable: true},
				{ID: "zoxide", Name: "zoxide", Check: "zoxide", Installable: true},
				{ID: "eza", Name: "eza", Check: "eza", Installable: true},
				{ID: "bat", Name: "bat", Check: "bat", Installable: true},
				{ID: "htop", Name: "htop", Check: "htop", Installable: true},
				{ID: "tree", Name: "tree", Check: "tree", Installable: true},
				{ID: "jq", Name: "jq", Check: "jq", Installable: true},
			},
		},
		{
			ID: "terminals", Name: "Terminal", Kind: "packages",
			Description: "Ghostty terminal, set as default.",
			Items: []CatalogItem{
				{ID: "ghostty", Name: "Ghostty", Check: "ghostty", Installable: true},
			},
		},
		{
			ID: "curl-tools", Name: "Shell tooling", Kind: "packages",
			Description: "Tools installed from upstream install scripts.",
			Items: []CatalogItem{
				{ID: "starship", Name: "Starship prompt", Check: "starship", Installable: true},
				{ID: "fnm", Name: "fnm", Check: "fnm", Installable: true},
				{ID: "uv", Name: "uv", Check: "uv", Installable: true},
			},
		},
		{
			ID: "npm-tools", Name: "npm tools", Kind: "packages",
			Description: "Global CLI tools from npm.",
			Items: []CatalogItem{
				{ID: "vercel", Name: "Vercel CLI", Check: "vercel", Installable: true},
				{ID: "gemini", Name: "Gemini CLI", Check: "gemini", Installable: true},
			},
		},
		{
			ID: "git-tools", Name: "Git tools", Kind: "packages",
			Description: "GitHub CLI and the lazy* TUIs.",
			Items: []CatalogItem{
				{ID: "gh", Name: "GitHub CLI", Check: "gh", Installable: true},
				{ID: "lazygit", Name: "lazygit", Check: "lazygit", Installable: true},
				{ID: "lazydocker", Name: "lazydocker", Check: "lazydocker", Installable: true},
			},
		},
		{
			ID: "editors", Name: "Editors", Kind: "packages",
			Description: "Graphical and AI code editors.",
			Items: []CatalogItem{
				{ID: "zed", Name: "Zed", Check: "zed", Installable: true},
				{ID: "vscode", Name: "VS Code", Check: "code", Installable: true},
				{ID: "opencode", Name: "opencode", Check: "opencode", Installable: true},
			},
		},
		{
			ID: "docker", Name: "Docker", Kind: "packages",
			Description: "Docker engine and compose.",
			Items: []CatalogItem{
				{ID: "docker.io", Name: "Docker", Check: "docker", Installable: true},
				{ID: "docker-compose", Name: "Docker Compose", Check: "docker-compose", Installable: true},
			},
		},
		{
			ID: "system", Name: "System monitors", Kind: "packages",
			Description: "fastfetch and btop.",
			Items: []CatalogItem{
				{ID: "fastfetch", Name: "fastfetch", Check: "fastfetch", Installable: true},
				{ID: "btop", Name: "btop", Check: "btop", Installable: true},
			},
		},
		{
			ID: "hardware", Name: "Hardware & drivers", Kind: "drivers",
			Description: "GPU drivers and peripheral control.",
			Items: []CatalogItem{
				{ID: "nvidia", Name: "NVIDIA driver", Check: "nvidia-smi", Installable: false},
				{ID: "openrgb", Name: "OpenRGB", Check: "openrgb", Installable: false},
			},
		},
		{
			ID: "media", Name: "Media", Kind: "packages",
			Description: "VLC and Spotify.",
			Items: []CatalogItem{
				{ID: "vlc", Name: "VLC", Check: "vlc", Installable: true},
				{ID: "spotify", Name: "Spotify", Check: "spotify", Installable: false},
			},
		},
		{
			ID: "fonts", Name: "Fonts", Kind: "fonts",
			Description: "Geist, Inter, JetBrains Mono, IBM Plex Mono, Nerd Fonts, emoji.",
			Items:       []CatalogItem{},
		},
		{
			ID: "desktop", Name: "Desktop", Kind: "desktop",
			Description: "Detect the desktop environment and apply theme/config.",
			Items:       []CatalogItem{},
		},
	}
}

func resolveCatalogItem(item *CatalogItem, info SystemInfo) {
	if len(item.Checks) == 0 {
		item.Checks = checksForPackage(item.ID, item.Check, info)
	}
	if item.Check == "" && len(item.Checks) > 0 {
		item.Check = item.Checks[0]
	}

	item.Method = methodForPackage(item.ID, info.OSFamily)
	item.PackageName = packageNameForPackage(item.ID, info)
	item.RequiresSudo = methodRequiresSudo(item.Method, item.ID)
	item.Available = isPackageAvailable(item.ID, item.Method, item.PackageName, info)
	item.AvailabilityReason = packageAvailabilityReason(item.ID, item.Method, item.PackageName, info)

	if item.Command == "" {
		item.Command = commandForPackage(*item, info)
	}
}

func methodForPackage(id, osFamily string) string {
	switch id {
	case "git", "curl", "wget", "build-essential", "ca-certificates", "gnupg", "software-properties-common", "fish",
		"python3", "python3-pip", "python3-venv", "nodejs", "npm", "neovim", "vim", "ripgrep", "fd-find", "fzf", "zoxide",
		"eza", "bat", "htop", "tree", "jq", "gh", "docker.io", "docker-compose", "fastfetch", "btop", "vlc":
		if osFamily == "arch" {
			return "pacman"
		}
		return "apt"
	case "starship", "fnm", "rustup", "uv", "pnpm", "bun":
		return "curl"
	case "vercel", "gemini":
		return "npm"
	case "lazygit", "lazydocker":
		return "github"
	case "ghostty", "zed", "vscode", "opencode":
		return "script"
	case "spotify":
		return "snap"
	case "nvidia", "openrgb", "dotnet":
		return "script"
	default:
		return ""
	}
}

func packageNameForPackage(id string, info SystemInfo) string {
	if info.OSFamily != "arch" {
		return id
	}
	switch id {
	case "build-essential":
		return "base-devel"
	case "python3":
		return "python"
	case "python3-pip":
		return "python-pip"
	case "python3-venv", "software-properties-common":
		return "__skip__"
	case "fd-find":
		return "fd"
	case "gh":
		return "github-cli"
	case "docker.io":
		return "docker"
	default:
		return id
	}
}

func checksForPackage(id, fallback string, info SystemInfo) []string {
	switch id {
	case "fd-find":
		if info.OSFamily == "debian" {
			return []string{"fdfind", "fd"}
		}
		return []string{"fd", "fdfind"}
	case "bat":
		if info.OSFamily == "debian" {
			return []string{"batcat", "bat"}
		}
		return []string{"bat", "batcat"}
	case "build-essential":
		return []string{"gcc", "cc", "make"}
	case "docker-compose":
		return []string{"docker-compose"}
	case "rustup":
		return []string{"rustup", "rustc", "cargo"}
	case "python3-pip":
		return []string{"pip3", "pip"}
	case "nvidia":
		return []string{"nvidia-smi"}
	case "ca-certificates", "python3-venv", "software-properties-common":
		return nil
	default:
		if fallback == "" {
			return nil
		}
		return []string{fallback}
	}
}

func methodRequiresSudo(method, id string) bool {
	switch method {
	case "apt", "pacman", "snap":
		return true
	case "script":
		return id == "ghostty" || id == "vscode" || id == "opencode" || id == "nvidia" || id == "openrgb" || id == "dotnet"
	default:
		return false
	}
}

func isPackageAvailable(id, method, packageName string, info SystemInfo) bool {
	if method == "" {
		return false
	}
	if info.PackageManager != "apt" && info.PackageManager != "pacman" {
		return false
	}
	if packageName == "__skip__" {
		return false
	}
	switch method {
	case "apt":
		return info.PackageManager == "apt"
	case "pacman":
		return info.PackageManager == "pacman"
	case "snap":
		return commandExists("snap")
	default:
		return true
	}
}

func packageAvailabilityReason(id, method, packageName string, info SystemInfo) string {
	if method == "" {
		return "No setup.sh package mapping exists for this item."
	}
	if info.PackageManager != "apt" && info.PackageManager != "pacman" {
		return "No supported package manager found. setup.sh supports apt and pacman."
	}
	if packageName == "__skip__" {
		return "Skipped on pacman systems by setup.sh."
	}
	switch method {
	case "apt":
		if info.PackageManager != "apt" {
			return "Requires apt; this machine reports " + info.PackageManager + "."
		}
	case "pacman":
		if info.PackageManager != "pacman" {
			return "Requires pacman; this machine reports " + info.PackageManager + "."
		}
	case "snap":
		if !commandExists("snap") {
			return "Requires snap; setup.sh will skip it when snap is missing."
		}
	}
	return ""
}

func commandForPackage(item CatalogItem, info SystemInfo) string {
	if item.PackageName == "__skip__" {
		return "skipped on pacman systems"
	}
	switch item.Method {
	case "apt":
		return "sudo apt install -y " + item.PackageName
	case "pacman":
		return "sudo pacman -S --noconfirm --needed " + item.PackageName
	case "snap":
		flags := ""
		if item.ID == "spotify" {
			flags = " --classic"
		}
		return "sudo snap install" + flags + " " + item.ID
	case "curl":
		return curlInstallCommand(item.ID)
	case "npm":
		if item.ID == "gemini" {
			return "npm install -g @google/gemini-cli"
		}
		return "npm install -g " + item.ID
	case "github":
		if item.ID == "lazygit" {
			return "install latest GitHub release: jesseduffield/lazygit"
		}
		if item.ID == "lazydocker" {
			return "install latest GitHub release: jesseduffield/lazydocker"
		}
	case "script":
		switch item.ID {
		case "zed":
			return "curl -f https://zed.dev/install.sh | sh"
		case "vscode":
			if info.PackageManager == "pacman" {
				return "sudo pacman -S --noconfirm --needed code"
			}
			return "add Microsoft apt repo; sudo apt install -y code"
		case "opencode":
			if info.PackageManager == "pacman" {
				return "curl -fsSL https://opencode.ai/install | bash"
			}
			return "curl installer; install OpenCode .deb on apt"
		case "ghostty":
			if info.PackageManager == "pacman" {
				return "pacman ghostty when available; otherwise build Ghostty from source"
			}
			return "build Ghostty from source"
		case "nvidia":
			return "run distro-specific NVIDIA driver installer"
		case "openrgb":
			if info.PackageManager == "apt" {
				return "add OpenRGB PPA; sudo apt install -y openrgb"
			}
			return "sudo pacman -S --noconfirm --needed openrgb"
		case "dotnet":
			return "run https://dot.net/v1/dotnet-install.sh --channel 9.0"
		}
	}
	if item.Installable {
		return "setup.sh --package " + item.ID
	}
	return "setup.sh --category section"
}

func curlInstallCommand(id string) string {
	switch id {
	case "pnpm":
		return "curl -fsSL https://get.pnpm.io/install.sh | sh"
	case "bun":
		return "curl -fsSL https://bun.sh/install | bash"
	case "rustup":
		return "curl -fsSL https://sh.rustup.rs | bash -s -- -y"
	case "fnm":
		return "curl -fsSL https://fnm.vercel.app/install | bash"
	case "uv":
		return "curl -fsSL https://astral.sh/uv/install.sh | sh"
	case "starship":
		return "curl -fsSL https://starship.rs/install.sh | sh"
	default:
		return "setup.sh --package " + id
	}
}

func isCategoryAvailable(cat CatalogCategory, info SystemInfo) bool {
	return info.PackageManager == "apt" || info.PackageManager == "pacman"
}

func categoryAvailabilityReason(cat CatalogCategory, info SystemInfo) string {
	if isCategoryAvailable(cat, info) {
		return ""
	}
	return "No supported package manager found. setup.sh supports apt and pacman."
}

// ---------------------------------------------------------------------------
// System probes
// ---------------------------------------------------------------------------

func parseOSRelease() map[string]string {
	out := map[string]string{}
	data, err := os.ReadFile("/etc/os-release")
	if err != nil {
		return out
	}
	for _, line := range strings.Split(string(data), "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		key, value, ok := strings.Cut(line, "=")
		if !ok {
			continue
		}
		value = strings.Trim(value, `"'`)
		out[strings.TrimSpace(key)] = strings.TrimSpace(value)
	}
	return out
}

func osFamily(osr map[string]string) string {
	switch osr["ID"] {
	case "arch", "manjaro", "endeavouros", "cachyos", "artix":
		return "arch"
	case "ubuntu", "debian", "linuxmint", "pop", "zorin", "elementary":
		return "debian"
	}
	if like := osr["ID_LIKE"]; like != "" {
		if strings.Contains(like, "arch") {
			return "arch"
		}
		if strings.Contains(like, "debian") {
			return "debian"
		}
	}
	return "unknown"
}

func readKernel() string {
	if data, err := os.ReadFile("/proc/sys/kernel/osrelease"); err == nil {
		return strings.TrimSpace(string(data))
	}
	return "unknown"
}

func readArch() string {
	if out, err := exec.Command("uname", "-m").Output(); err == nil {
		if s := strings.TrimSpace(string(out)); s != "" {
			return s
		}
	}
	return runtime.GOARCH
}

func detectDesktopSession() string {
	for _, key := range []string{"XDG_CURRENT_DESKTOP", "XDG_SESSION_DESKTOP", "DESKTOP_SESSION"} {
		if value := strings.TrimSpace(os.Getenv(key)); value != "" {
			return value
		}
	}
	if os.Getenv("HYPRLAND_INSTANCE_SIGNATURE") != "" {
		return "Hyprland"
	}
	return "unknown"
}

func detectPackageManager() string {
	switch {
	case commandExists("pacman"):
		return "pacman"
	case commandExists("apt"):
		return "apt"
	default:
		return "unknown"
	}
}

func shellName() string {
	if s := strings.TrimSpace(os.Getenv("SHELL")); s != "" {
		return filepath.Base(s)
	}
	return "unknown"
}

func readUptime() string {
	data, err := os.ReadFile("/proc/uptime")
	if err != nil {
		return "unknown"
	}
	fields := strings.Fields(string(data))
	if len(fields) == 0 {
		return "unknown"
	}
	secs, err := strconv.ParseFloat(fields[0], 64)
	if err != nil {
		return "unknown"
	}
	total := int(secs)
	days := total / 86400
	hours := (total % 86400) / 3600
	mins := (total % 3600) / 60
	switch {
	case days > 0:
		return strconv.Itoa(days) + "d " + strconv.Itoa(hours) + "h " + strconv.Itoa(mins) + "m"
	case hours > 0:
		return strconv.Itoa(hours) + "h " + strconv.Itoa(mins) + "m"
	default:
		return strconv.Itoa(mins) + "m"
	}
}

func readCPU() string {
	data, err := os.ReadFile("/proc/cpuinfo")
	if err != nil {
		return "unknown"
	}
	cores := 0
	model := ""
	for _, line := range strings.Split(string(data), "\n") {
		key, value, ok := strings.Cut(line, ":")
		if !ok {
			continue
		}
		key = strings.TrimSpace(key)
		if key == "model name" {
			if model == "" {
				model = strings.TrimSpace(value)
			}
			cores++
		}
	}
	if model == "" {
		return "unknown"
	}
	if cores > 1 {
		return model + " (" + strconv.Itoa(cores) + " cores)"
	}
	return model
}

func readMemory() string {
	data, err := os.ReadFile("/proc/meminfo")
	if err != nil {
		return "unknown"
	}
	for _, line := range strings.Split(string(data), "\n") {
		if strings.HasPrefix(line, "MemTotal:") {
			fields := strings.Fields(line)
			if len(fields) >= 2 {
				kb, err := strconv.ParseFloat(fields[1], 64)
				if err == nil {
					gb := kb / 1024 / 1024
					return strconv.FormatFloat(gb, 'f', 1, 64) + " GB"
				}
			}
		}
	}
	return "unknown"
}

func hasPasswordlessSudo() bool {
	if !commandExists("sudo") {
		return false
	}
	return exec.Command("sudo", "-n", "true").Run() == nil
}

// ---------------------------------------------------------------------------
// Workspace + small helpers
// ---------------------------------------------------------------------------

func (a *App) workspaceRootPath() string {
	if a.workspaceRoot != "" {
		return a.workspaceRoot
	}

	if wd, err := os.Getwd(); err == nil {
		if root, ok := findWorkspaceRoot(wd); ok {
			a.workspaceRoot = root
			return root
		}
	}

	candidates := []string{
		os.Getenv("DOTFILES_STUDIO_ROOT"),
		os.Getenv("DOTFILES_ROOT"),
	}
	if home, err := os.UserHomeDir(); err == nil {
		candidates = append(candidates, filepath.Join(home, ".config", "dotfiles"))
	}
	for _, candidate := range candidates {
		if candidate == "" {
			continue
		}
		candidate = filepath.Clean(candidate)
		if isWorkspaceRoot(candidate) {
			a.workspaceRoot = candidate
			return candidate
		}
	}

	if len(candidates) > 0 && candidates[0] != "" {
		a.workspaceRoot = filepath.Clean(candidates[0])
		return a.workspaceRoot
	}
	return ""
}

func setupScriptPath(root string) string {
	if root == "" {
		return ""
	}
	return filepath.Join(root, "setup", "setup.sh")
}

func findWorkspaceRoot(start string) (string, bool) {
	current := filepath.Clean(start)
	for {
		if isWorkspaceRoot(current) {
			return current, true
		}
		parent := filepath.Dir(current)
		if parent == current {
			return "", false
		}
		current = parent
	}
}

func isWorkspaceRoot(path string) bool {
	if path == "" {
		return false
	}
	for _, name := range []string{"configs", "setup", "README.md"} {
		if _, err := os.Stat(filepath.Join(path, name)); err != nil {
			return false
		}
	}
	return true
}

func commandExists(name string) bool {
	_, err := exec.LookPath(name)
	return err == nil
}

func checkAnyCommand(group string) bool {
	for _, name := range strings.Split(group, "|") {
		name = strings.TrimSpace(name)
		if name != "" && commandExists(name) {
			return true
		}
	}
	return false
}

func fileExists(path string) bool {
	if path == "" {
		return false
	}
	info, err := os.Stat(path)
	return err == nil && !info.IsDir()
}

// ansiRe matches CSI escape sequences (colors, cursor moves) emitted by the
// setup logger so the GUI console shows clean text.
var ansiRe = regexp.MustCompile(`\x1b\[[0-9;?]*[ -/]*[@-~]`)

func stripANSI(s string) string {
	return ansiRe.ReplaceAllString(s, "")
}

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if strings.TrimSpace(v) != "" {
			return v
		}
	}
	return ""
}
