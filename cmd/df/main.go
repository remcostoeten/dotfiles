package main

import (
	"bufio"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"sort"
	"strings"

	"github.com/charmbracelet/lipgloss"
)

const banner = `
      ████████╗ █████╗  ██████╗██╗  ██╗██╗   ██╗███████╗
      ╚════██║██╔══██╗██╔════╝██║  ██║██║   ██║██╔════╝
        ███║ ███████║██║  ███╗███████║██║   ██║███████╗
       ███║ ██╔══██║██║   ██║██╔══██║██║   ██║╚════██║
      ██████║██║  ██║╚██████╔╝██║  ██║╚██████╔╝███████║
      ╚═════╝╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═╝ ╚═════╝ ╚══════╝`

var (
	cyan    = lipgloss.Color("116")
	pink    = lipgloss.Color("168")
	teal    = lipgloss.Color("84")
	blue    = lipgloss.Color("137")
	mauve   = lipgloss.Color("147")
	surface = lipgloss.Color("8")
	subtext = lipgloss.Color("10")
	text    = lipgloss.Color("15")

	dimStyle  = lipgloss.NewStyle().Foreground(subtext)
	statStyle = lipgloss.NewStyle().Background(surface).Foreground(teal).Padding(0, 2, 0, 1)
	catStyle  = lipgloss.NewStyle().Background(surface).Foreground(blue).Bold(true).Width(78).Padding(0, 1)
	boxStyle  = lipgloss.NewStyle().Background(surface).Foreground(text).Border(lipgloss.NormalBorder()).BorderForeground(surface).Padding(1, 2)
)

type Item struct {
	Name     string
	Command  string
	Desc     string
	Category string
}

var items []Item

func main() {
	args := os.Args[1:]
	if len(args) == 0 {
		mainMenu()
		return
	}

	a := args[0]
	switch a {
	case "-i", "--interactive":
		interactive()
	case "-a", "--aliases":
		showCategory("aliases")
	case "-f", "--functions":
		showCategory("functions")
	case "-s", "--scripts":
		showCategory("scripts")
	case "-b", "--binaries":
		showCategory("binaries")
	case "-m", "--modules":
		showCategory("modules")
	case "--search":
		loadItemsIfNeeded()
		if len(args) > 1 {
			search(args[1])
		}
	case "--run":
		loadItemsIfNeeded()
		if len(args) > 1 {
			runItem(args[1])
		}
	case "-h", "--help":
		help()
	case "-v", "--version":
		version()
	default:
		mainMenu()
	}
}

func loadItemsIfNeeded() {
	if items == nil {
		home, _ := os.UserHomeDir()
		items = loadItems(filepath.Join(home, ".config", "dotfiles"))
	}
}

func loadItems(dir string) []Item {
	var out []Item

	// Aliases
	aliasDirs := []string{filepath.Join(dir, "configs", "fish", "aliases"), filepath.Join(dir, "aliases")}
	for _, path := range aliasDirs {
		if entries, err := os.ReadDir(path); err == nil {
			for _, e := range entries {
				if e.IsDir() {
					continue
				}
				name := e.Name()
				if !strings.HasSuffix(name, ".fish") && !strings.HasSuffix(name, ".sh") {
					continue
				}
				if b, err := os.ReadFile(filepath.Join(path, name)); err == nil {
					for _, line := range strings.Split(string(b), "\n") {
						line = strings.TrimSpace(line)
						if strings.HasPrefix(line, "alias ") {
							rest := strings.TrimPrefix(line, "alias ")
							fields := strings.Fields(rest)
							if len(fields) >= 2 {
								out = append(out, Item{Name: fields[0], Command: strings.Join(fields[1:], " "), Category: "aliases"})
							}
						}
					}
				}
			}
		}
	}

	// Functions
	funcDir := filepath.Join(dir, "configs", "fish", "functions")
	if entries, err := os.ReadDir(funcDir); err == nil {
		for _, e := range entries {
			if e.IsDir() {
				continue
			}
			if !strings.HasSuffix(e.Name(), ".fish") {
				continue
			}
			if b, err := os.ReadFile(filepath.Join(funcDir, e.Name())); err == nil {
				for _, line := range strings.Split(string(b), "\n") {
					line = strings.TrimSpace(line)
					if strings.HasPrefix(line, "function ") {
						fields := strings.Fields(line)
						if len(fields) >= 2 {
							out = append(out, Item{Name: fields[1], Desc: getDesc(filepath.Join(funcDir, e.Name())), Category: "functions"})
						}
					}
				}
			}
		}
	}

	// Scripts
	scriptDir := filepath.Join(dir, "scripts")
	if entries, err := os.ReadDir(scriptDir); err == nil {
		for _, e := range entries {
			if e.IsDir() {
				continue
			}
			if strings.HasPrefix(e.Name(), ".") {
				continue
			}
			p := filepath.Join(scriptDir, e.Name())
			if st, err := os.Stat(p); err == nil && st.Mode()&0111 != 0 {
				out = append(out, Item{Name: e.Name(), Desc: getDesc(p), Category: "scripts"})
			}
		}
	}

	// Binaries
	binDir := filepath.Join(dir, "bin")
	if entries, err := os.ReadDir(binDir); err == nil {
		for _, e := range entries {
			if e.IsDir() {
				continue
			}
			if strings.HasPrefix(e.Name(), ".") {
				continue
			}
			p := filepath.Join(binDir, e.Name())
			if st, err := os.Stat(p); err == nil && st.Mode()&0111 != 0 {
				out = append(out, Item{Name: e.Name(), Desc: getDesc(p), Category: "binaries"})
			}
		}
	}

	// Modules
	modDirs := []string{filepath.Join(dir, "configs", "fish", "conf.d"), filepath.Join(dir, "configs", "fish", "completions")}
	for _, md := range modDirs {
		if entries, err := os.ReadDir(md); err == nil {
			for _, e := range entries {
				if e.IsDir() {
					continue
				}
				if strings.HasSuffix(e.Name(), ".fish") {
					out = append(out, Item{Name: strings.TrimSuffix(e.Name(), ".fish"), Category: "modules"})
				}
			}
		}
	}

	sort.Slice(out, func(i, j int) bool {
		if out[i].Category != out[j].Category {
			return out[i].Category < out[j].Category
		}
		return out[i].Name < out[j].Name
	})
	return out
}

func getDesc(path string) string {
	f, err := os.Open(path)
	if err != nil {
		return ""
	}
	defer f.Close()
	s := bufio.NewScanner(f)
	for i := 0; s.Scan() && i < 10; i++ {
		l := strings.TrimSpace(s.Text())
		if strings.HasPrefix(l, "# DOCSTRING:") {
			return strings.TrimSpace(strings.TrimPrefix(l, "# DOCSTRING:"))
		}
		if strings.HasPrefix(l, "# ") && !strings.HasPrefix(l, "#!") {
			d := strings.TrimPrefix(l, "# ")
			if len(d) > 2 && len(d) < 100 {
				return d
			}
		}
	}
	return ""
}

func count(cat string) int {
	n := 0
	for _, i := range items {
		if i.Category == cat {
			n++
		}
	}
	return n
}

func clear() {
	fmt.Print("\033[H\033[2J")
}

func mainMenu() {
	loadItemsIfNeeded()
	clear()
	fmt.Println(lipgloss.NewStyle().Foreground(cyan).Render(banner))
	fmt.Println(lipgloss.NewStyle().Foreground(subtext).Align(lipgloss.Center).Width(78).Render("The Ultimate Dotfiles Manager"))
	fmt.Println()
	fmt.Printf("⚡ %d  ⚙ %d  ⌘ %d  ⬡ %d  ❖ %d\n\n", count("aliases"), count("functions"), count("scripts"), count("binaries"), count("modules"))
	fmt.Println(catStyle.Render(" QUICK START "))
	fmt.Println()
	fmt.Println("  " + lipgloss.NewStyle().Foreground(cyan).Render("▶") + "  df -i              Interactive")
	fmt.Println()
	fmt.Printf("  df --aliases      %d\n", count("aliases"))
	fmt.Printf("  df --functions  %d\n", count("functions"))
	fmt.Printf("  df --scripts     %d\n", count("scripts"))
	fmt.Printf("  df --binaries    %d\n", count("binaries"))
	fmt.Printf("  df --modules     %d\n", count("modules"))
	fmt.Println()
	fmt.Println("  df --search <term>  Search")
	fmt.Println("  df --run <name>    Run")
	fmt.Println()
	fmt.Println(dimStyle.Align(lipgloss.Center).Width(78).Render("Total: "+fmt.Sprint(len(items))+" | Press ENTER for interactive"))
}

func interactive() {
	loadItemsIfNeeded()
	clear()
	current := "all"
	sel := 0

	for {
		clear()
		fmt.Println(lipgloss.NewStyle().Foreground(cyan).Render(banner))
		fmt.Println()
		fmt.Println(lipgloss.NewStyle().Foreground(subtext).Align(lipgloss.Center).Width(78).Render("INTERACTIVE"))
		fmt.Println()
		fmt.Println("  TAB Category  ENTER Run  UP DOWN Navigate  ESC Quit")
		fmt.Println(strings.Repeat("─", 78))
		fmt.Println()

		for _, c := range []string{"all", "aliases", "functions", "scripts", "binaries", "modules"} {
			if c == current {
				fmt.Print(lipgloss.NewStyle().Background(surface).Foreground(pink).Padding(0, 1).Render(strings.ToUpper(c) + " "))
			} else {
				fmt.Print(dimStyle.Render(c + " "))
			}
		}
		fmt.Println()
		fmt.Println()

		var filt []Item
		for _, i := range items {
			if current == "all" || i.Category == current {
				filt = append(filt, i)
			}
		}

		for idx, it := range filt {
			if idx == sel {
				fmt.Println(" " + lipgloss.NewStyle().Foreground(pink).Bold(true).Render("▸"+it.Name), dimStyle.Render("-- "+it.Desc))
			} else {
				fmt.Println("  "+lipgloss.NewStyle().Foreground(text).Render(it.Name), dimStyle.Render("-- "+it.Desc))
			}
		}
		fmt.Println()
		fmt.Println(dimStyle.Render(fmt.Sprintf(" %d/%d | %s ", sel+1, len(filt), current)))

		var b [1]byte
		os.Stdin.Read(b[:])
		k := b[0]

		switch k {
		case 27:
			return
		case 9:
			cats := []string{"all", "aliases", "functions", "scripts", "binaries", "modules"}
			for i, c := range cats {
				if c == current {
					current = cats[(i+1)%len(cats)]
					break
				}
			}
			sel = 0
		case 13:
			if sel < len(filt) {
				runItem(filt[sel].Name)
			}
		case 65:
			if sel > 0 {
				sel--
			}
		case 66:
			if sel < len(filt)-1 {
				sel++
			}
		case 'q':
			return
		}
	}
}

func showCategory(cat string) {
	loadItemsIfNeeded()
	clear()
	var filt []Item
	for _, i := range items {
		if i.Category == cat {
			filt = append(filt, i)
		}
	}
	fmt.Println()
	fmt.Println(catStyle.Render("━ "+strings.ToUpper(cat)+" ━"))
	fmt.Println()
	for _, it := range filt {
		fmt.Println(" " + lipgloss.NewStyle().Foreground(teal).Render("▶") + " " + lipgloss.NewStyle().Foreground(text).Bold(true).Render(it.Name), dimStyle.Render("-- "+it.Desc))
	}
	fmt.Println()
	fmt.Println(dimStyle.Render("Total: " + fmt.Sprint(len(filt))))
}

func search(term string) {
	loadItemsIfNeeded()
	clear()
	term = strings.ToLower(term)
	var res []Item
	for _, i := range items {
		if strings.Contains(strings.ToLower(i.Name), term) || strings.Contains(strings.ToLower(i.Desc), term) {
			res = append(res, i)
		}
	}
	fmt.Println()
	fmt.Println(catStyle.Render("SEARCH: "+term+" ━"))
	fmt.Println()
	for _, it := range res {
		fmt.Println(" " + lipgloss.NewStyle().Foreground(mauve).Render("["+it.Category+"]") + " " + lipgloss.NewStyle().Foreground(text).Bold(true).Render(it.Name), dimStyle.Render("-- "+it.Desc))
	}
	fmt.Println()
	fmt.Println(dimStyle.Render("Found: " + fmt.Sprint(len(res))))
}

func runItem(name string) {
	home, _ := os.UserHomeDir()
	dotfilesDir := filepath.Join(home, ".config", "dotfiles")
	var it Item
	found := false
	for _, i := range items {
		if i.Name == name {
			it = i
			found = true
			break
		}
	}
	if !found {
		fmt.Println("Not found:", name)
		os.Exit(1)
	}
	var cmd string
	switch it.Category {
	case "scripts":
		cmd = filepath.Join(dotfilesDir, "scripts", it.Name)
	case "binaries":
		cmd = filepath.Join(dotfilesDir, "bin", it.Name)
	default:
		fmt.Println("Cannot run:", it.Category)
		os.Exit(1)
	}
	fmt.Println("Running:", name)
	fmt.Println()
	c := exec.Command(cmd)
	c.Stdout = os.Stdout
	c.Stderr = os.Stderr
	c.Stdin = os.Stdin
	c.Dir = home
	c.Run()
}

func help() {
	clear()
	fmt.Println(lipgloss.NewStyle().Foreground(cyan).Render(banner))
	box := boxStyle.Width(45).Render("USAGE\n df [flags]\n\nFLAGS\n -i interactive\n -a aliases\n -f functions\n -s scripts\n -b binaries\n -m modules\n --search <t>\n --run <n>\n -h help")
	fmt.Println(lipgloss.NewStyle().Align(lipgloss.Center).Width(78).Render(box))
}

func version() {
	fmt.Println("dotfiles CLI v1.0.0")
	fmt.Println("Tokyo Night theme")
}

func init() {
	runtime.GOMAXPROCS(runtime.NumCPU())
}