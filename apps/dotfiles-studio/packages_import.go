package main

import (
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
)

// ImportResult is the manifest after merging in a setup script, not yet saved.
type ImportResult struct {
	Manifest   PackageManifest `json:"manifest"`
	Source     string          `json:"source"`
	Added      []string        `json:"added"`
	Skipped    []string        `json:"skipped"`
	Categories []string        `json:"categories"`
	Notes      []string        `json:"notes"`
	Error      string          `json:"error"`
}

var (
	funcDefRe  = regexp.MustCompile(`(?m)^([A-Za-z_][A-Za-z0-9_]*)\(\)\s*\{`)
	caseArmRe  = regexp.MustCompile(`^\s*([A-Za-z0-9_|.-]+)\)\s*$`)
	identRe    = regexp.MustCompile(`[A-Za-z_][A-Za-z0-9_]*`)
	libSources = []string{"logger", "executor", "packages", "installers"}
)

// PackagesImport parses a setup.sh-style script (the workspace one when path is
// empty) and merges what it installs into the current manifest. Nothing is
// written; the caller saves the returned manifest if it accepts the result.
func (a *App) PackagesImport(path string) ImportResult {
	if path == "" {
		path = setupScriptPath(a.workspaceRootPath())
	}
	src, err := os.ReadFile(path)
	if err != nil {
		return ImportResult{Source: path, Error: err.Error()}
	}
	current, _, err := readManifest(a.manifestPath())
	if err != nil {
		return ImportResult{Source: path, Error: err.Error()}
	}

	libDir := filepath.Join(filepath.Dir(path), "lib")
	libSrc := ""
	for _, name := range libSources {
		if data, err := os.ReadFile(filepath.Join(libDir, name+".sh")); err == nil {
			libSrc += string(data) + "\n"
		}
	}

	env := detectPackagesEnv(current)
	imp := parseSetupScript(string(src), libSrc, a.relativeSetupDir(path), env)
	result := mergeImport(current, imp)
	result.Source = path
	return result
}

func (a *App) relativeSetupDir(scriptPath string) string {
	dir := filepath.Dir(scriptPath)
	if root := a.workspaceRootPath(); root != "" {
		if rel, err := filepath.Rel(root, dir); err == nil && !strings.HasPrefix(rel, "..") {
			return rel
		}
	}
	return dir
}

type parsedImport struct {
	categories []PackageCategory
	entries    []PackageEntry
	notes      []string
}

type importContext struct {
	setupFuncs map[string]string
	libFuncs   map[string]bool
	setupDir   string
	env        PackagesEnv
	catalog    map[string]CatalogItem
	pacmanHas  func(string) bool
}

func parseSetupScript(src, libSrc, setupDir string, env PackagesEnv) parsedImport {
	ctx := importContext{
		setupFuncs: functionBodies(src),
		libFuncs:   map[string]bool{},
		setupDir:   setupDir,
		env:        env,
		catalog:    map[string]CatalogItem{},
		pacmanHas: func(pkg string) bool {
			if env.PackageManager != "pacman" {
				return false
			}
			return exec.Command("pacman", "-Si", pkg).Run() == nil
		},
	}
	for name := range functionBodies(libSrc) {
		ctx.libFuncs[name] = true
	}
	for _, cat := range baseCatalog() {
		for _, item := range cat.Items {
			ctx.catalog[item.ID] = item
		}
	}
	return ctx.parse()
}

func (ctx importContext) parse() parsedImport {
	out := parsedImport{}
	body, ok := ctx.setupFuncs["install_category"]
	if !ok {
		out.notes = append(out.notes, "no install_category() function found; nothing imported")
		return out
	}

	catalogCats := map[string]CatalogCategory{}
	for _, c := range baseCatalog() {
		catalogCats[c.ID] = c
	}

	seen := map[string]bool{}
	category := ""
	defaults := ctx.defaultCategories()
	for _, raw := range strings.Split(body, "\n") {
		line := strings.TrimSpace(raw)
		if line == "*)" {
			category = ""
			continue
		}
		if m := caseArmRe.FindStringSubmatch(raw); m != nil {
			category = strings.Split(m[1], "|")[0]
			pc := PackageCategory{ID: category, Name: titleCase(category)}
			if cc, ok := catalogCats[category]; ok {
				pc.Name, pc.Description = cc.Name, cc.Description
			}
			out.categories = append(out.categories, pc)
			continue
		}
		if category == "" || line == "" || line == ";;" || strings.HasPrefix(line, "#") {
			continue
		}
		words := shellWords(line)
		if len(words) == 0 || strings.HasPrefix(words[0], "log_") || words[0] == "return" || words[0] == "case" || words[0] == "esac" {
			continue
		}
		entry, note, ok := ctx.entryFor(words, category)
		if note != "" {
			out.notes = append(out.notes, note)
		}
		if !ok {
			continue
		}
		if seen[entry.ID] {
			out.notes = append(out.notes, entry.ID+" appears in more than one category; kept the first ("+entryCategory(out.entries, entry.ID)+")")
			continue
		}
		seen[entry.ID] = true
		if defaults != nil && !defaults[category] {
			entry.Disabled = true
		}
		out.entries = append(out.entries, entry)
	}
	return out
}

// defaultCategories lists the categories install_all runs; entries outside it
// import disabled so "run all" matches what a full setup.sh run did.
func (ctx importContext) defaultCategories() map[string]bool {
	body, ok := ctx.setupFuncs["install_all"]
	if !ok {
		return nil
	}
	out := map[string]bool{}
	for _, line := range strings.Split(body, "\n") {
		words := shellWords(strings.TrimSpace(line))
		if len(words) >= 2 && words[0] == "install_category" {
			out[words[1]] = true
		}
	}
	if len(out) == 0 {
		return nil
	}
	return out
}

func entryCategory(entries []PackageEntry, id string) string {
	for _, e := range entries {
		if e.ID == id {
			return e.Category
		}
	}
	return ""
}

func arg(words []string, i int) string {
	if i < len(words) {
		return words[i]
	}
	return ""
}

func (ctx importContext) checksFor(id, fallback string) []string {
	if item, ok := ctx.catalog[id]; ok {
		if checks := checksForPackage(id, item.Check, SystemInfo{OSFamily: ctx.env.OSFamily}); checks != nil {
			return checks
		}
		return []string{}
	}
	if fallback == "" {
		return []string{}
	}
	return []string{fallback}
}

func (ctx importContext) displayName(id, given string) string {
	if given != "" {
		return given
	}
	if item, ok := ctx.catalog[id]; ok {
		return item.Name
	}
	return id
}

func (ctx importContext) entryFor(words []string, category string) (PackageEntry, string, bool) {
	fn := words[0]
	e := PackageEntry{Category: category, Sources: []PackageSource{}}
	switch fn {
	case "install_apt":
		pkg := arg(words, 1)
		e.ID, e.Name, e.Checks = pkg, ctx.displayName(pkg, arg(words, 2)), ctx.checksFor(pkg, pkg)
		if arch := packageNameForPackage(pkg, SystemInfo{OSFamily: "arch"}); arch != "__skip__" {
			e.Sources = append(e.Sources, PackageSource{Method: "pacman", Package: arch})
		}
		e.Sources = append(e.Sources, PackageSource{Method: "apt", Package: pkg})
		return e, "", pkg != ""
	case "install_curl":
		name := arg(words, 2)
		e.ID, e.Name, e.Checks = name, ctx.displayName(name, ""), ctx.checksFor(name, name)
		e.Sources = append(e.Sources, PackageSource{Method: "curl", Package: arg(words, 1), Shell: arg(words, 3), Args: arg(words, 4)})
		return e, "", name != ""
	case "install_npm":
		pkg := arg(words, 1)
		bin := firstNonEmpty(arg(words, 2), pkg)
		e.ID, e.Name, e.Checks = bin, ctx.displayName(bin, ""), ctx.checksFor(bin, bin)
		e.Sources = append(e.Sources, PackageSource{Method: "npm", Package: pkg})
		return e, "", pkg != ""
	case "install_snap":
		pkg := arg(words, 1)
		e.ID, e.Name, e.Checks = pkg, ctx.displayName(pkg, arg(words, 2)), ctx.checksFor(pkg, pkg)
		e.Sources = append(e.Sources, PackageSource{Method: "snap", Package: pkg, Args: arg(words, 3)})
		return e, "", pkg != ""
	case "install_github":
		repo := arg(words, 1)
		name := firstNonEmpty(arg(words, 2), repo[strings.LastIndex(repo, "/")+1:])
		e.ID, e.Name, e.Checks = name, ctx.displayName(name, ""), ctx.checksFor(name, name)
		note := ""
		if ctx.pacmanHas(name) {
			e.Sources = append(e.Sources, PackageSource{Method: "pacman", Package: name})
			note = name + ": found in pacman repos, added pacman as the preferred source"
		}
		e.Sources = append(e.Sources, PackageSource{Method: "github", Package: repo})
		return e, note, repo != ""
	}

	if !ctx.libFuncs[fn] && ctx.setupFuncs[fn] == "" {
		return e, "skipped unknown call: " + strings.Join(words, " "), false
	}
	e.ID = callID(fn, words[1:])
	e.Name = ctx.displayName(e.ID, titleCase(e.ID))
	e.Checks = ctx.checksFor(e.ID, "")
	e.Sources = append(e.Sources, PackageSource{Method: "shell", Script: ctx.shellFor(fn, words[1:])})
	if isTaskCall(fn) {
		e.Description = "Configuration step imported from " + fn
	}
	return e, "", true
}

func isTaskCall(fn string) bool {
	for _, prefix := range []string{"setup_", "configure_", "set_"} {
		if strings.HasPrefix(fn, prefix) {
			return true
		}
	}
	return false
}

func callID(fn string, args []string) string {
	id := strings.TrimPrefix(fn, "install_")
	if isTaskCall(fn) {
		id = fn
		if len(args) > 0 {
			id += "_" + args[0]
		}
	}
	return strings.ToLower(strings.ReplaceAll(id, "_", "-"))
}

// shellFor builds a self-contained script: it sources the setup lib and inlines
// any setup.sh-only functions the call depends on, since setup.sh itself runs
// its main flow when sourced.
func (ctx importContext) shellFor(fn string, args []string) string {
	var b strings.Builder
	dir := ctx.setupDir
	b.WriteString("export SCRIPT_DIR=\"$PWD/" + dir + "\" DRY_RUN=false VERBOSE=false\n")
	for _, name := range libSources {
		b.WriteString("source \"$SCRIPT_DIR/lib/" + name + ".sh\"\n")
	}
	for _, name := range ctx.setupDeps(fn) {
		b.WriteString(name + "() {" + ctx.setupFuncs[name] + "}\n")
	}
	call := fn
	for _, a := range args {
		call += " " + shellQuote(a)
	}
	b.WriteString(call)
	return b.String()
}

func (ctx importContext) setupDeps(fn string) []string {
	order := []string{}
	seen := map[string]bool{}
	var visit func(string)
	visit = func(name string) {
		body, ok := ctx.setupFuncs[name]
		if !ok || seen[name] {
			return
		}
		seen[name] = true
		for _, ident := range identRe.FindAllString(body, -1) {
			if ident != name {
				visit(ident)
			}
		}
		order = append(order, name)
	}
	visit(fn)
	return order
}

// functionBodies maps each top-level `name() {` to the text up to its closing
// `}` at column zero, excluding the braces.
func functionBodies(src string) map[string]string {
	out := map[string]string{}
	for _, loc := range funcDefRe.FindAllStringSubmatchIndex(src, -1) {
		name := src[loc[2]:loc[3]]
		rest := src[loc[1]:]
		end := strings.Index(rest, "\n}")
		if end < 0 {
			continue
		}
		out[name] = rest[:end+1]
	}
	return out
}

func shellWords(line string) []string {
	words := []string{}
	var cur strings.Builder
	inWord := false
	var quote rune
	for _, r := range line {
		switch {
		case quote != 0:
			if r == quote {
				quote = 0
			} else {
				cur.WriteRune(r)
			}
		case r == '"' || r == '\'':
			quote, inWord = r, true
		case r == '#' && !inWord:
			return words
		case r == ' ' || r == '\t':
			if inWord {
				words = append(words, cur.String())
				cur.Reset()
				inWord = false
			}
		default:
			cur.WriteRune(r)
			inWord = true
		}
	}
	if inWord {
		words = append(words, cur.String())
	}
	return words
}

func mergeImport(current PackageManifest, imp parsedImport) ImportResult {
	result := ImportResult{Manifest: current, Added: []string{}, Skipped: []string{}, Categories: []string{}, Notes: imp.notes}
	cats := map[string]bool{}
	for _, c := range current.Categories {
		cats[c.ID] = true
	}
	ids := map[string]bool{}
	for _, p := range current.Packages {
		ids[p.ID] = true
	}
	for _, c := range imp.categories {
		if !cats[c.ID] {
			cats[c.ID] = true
			result.Manifest.Categories = append(result.Manifest.Categories, c)
			result.Categories = append(result.Categories, c.ID)
		}
	}
	for _, e := range imp.entries {
		if ids[e.ID] {
			result.Skipped = append(result.Skipped, e.ID)
			continue
		}
		ids[e.ID] = true
		result.Manifest.Packages = append(result.Manifest.Packages, e)
		result.Added = append(result.Added, e.ID)
	}
	normalizeManifest(&result.Manifest)
	return result
}
