package main

import (
	"context"
	"fmt"
	"os"
	"strings"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/remcostoeten/bpr/internal/bitbucket"
)

type paletteCmd struct {
	label string
	desc  string
	run   func()
}

type paletteModel struct {
	cmds       []paletteCmd
	filtered   []int
	cursor     int
	width      int
	height     int
	chosen     bool
	quitting   bool
	filtering  bool
	filter     string
}

func (m paletteModel) Init() tea.Cmd { return nil }

func (m paletteModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width, m.height = msg.Width, msg.Height
		return m, nil
	case tea.KeyMsg:
		if m.filtering {
			switch msg.Type {
			case tea.KeyEsc:
				m.filtering = false
				m.filter = ""
				m.filtered = nil
			case tea.KeyEnter:
				m.filtering = false
			case tea.KeyBackspace:
				if len(m.filter) > 0 {
					m.filter = m.filter[:len(m.filter)-1]
					m.applyFilter()
				}
			case tea.KeyRunes, tea.KeySpace:
				m.filter += string(msg.Runes)
				m.applyFilter()
			}
			return m, nil
		}

		switch msg.String() {
		case "q", "ctrl+c":
			m.quitting = true
			return m, tea.Quit
		case "up", "k":
			if m.cursor > 0 {
				m.cursor--
			}
		case "down", "j":
			if m.cursor < len(m.filtered)-1 {
				m.cursor++
			}
		case "enter":
			m.chosen = true
			return m, tea.Quit
		case "/", "f":
			m.filtering = true
			m.filter = ""
			m.filtered = nil
			return m, nil
		case "1":
			if len(m.filtered) > 0 { m.cursor = 0; m.chosen = true; return m, tea.Quit }
		case "2":
			if len(m.filtered) > 1 { m.cursor = 1; m.chosen = true; return m, tea.Quit }
		case "3":
			if len(m.filtered) > 2 { m.cursor = 2; m.chosen = true; return m, tea.Quit }
		case "4":
			if len(m.filtered) > 3 { m.cursor = 3; m.chosen = true; return m, tea.Quit }
		case "5":
			if len(m.filtered) > 4 { m.cursor = 4; m.chosen = true; return m, tea.Quit }
		case "6":
			if len(m.filtered) > 5 { m.cursor = 5; m.chosen = true; return m, tea.Quit }
		case "7":
			if len(m.filtered) > 6 { m.cursor = 6; m.chosen = true; return m, tea.Quit }
		case "8":
			if len(m.filtered) > 7 { m.cursor = 7; m.chosen = true; return m, tea.Quit }
		case "9":
			if len(m.filtered) > 8 { m.cursor = 8; m.chosen = true; return m, tea.Quit }
		}
	}
	return m, nil
}

func (m *paletteModel) applyFilter() {
	m.filtered = nil
	for i := range m.cmds {
		label := strings.ToLower(m.cmds[i].label)
		desc := strings.ToLower(m.cmds[i].desc)
		q := strings.ToLower(m.filter)
		if q == "" || strings.Contains(label, q) || strings.Contains(desc, q) {
			m.filtered = append(m.filtered, i)
		}
	}
	if m.cursor >= len(m.filtered) {
		m.cursor = max(len(m.filtered)-1, 0)
	}
}

func (m paletteModel) View() string {
	if m.quitting && !m.chosen {
		return ""
	}

	style := lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("0")).Background(lipgloss.Color("39")).Padding(0, 1)

	var bm []string
	for vi, fi := range m.filtered {
		cmd := m.cmds[fi]
		num := fmt.Sprintf("%d.", vi+1)
		label := cBold.Render(cmd.label)
		line := num + " " + label
		if vi == m.cursor {
			line = lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("39")).Render("▸") + line[1:]
		} else {
			line = cDim.Render(num[:2]) + line[2:]
		}
		bm = append(bm, "  "+line)
		bm = append(bm, cDim.Render("     "+cmd.desc))
	}

	if len(bm) == 0 {
		bm = append(bm, cYellow.Render("  No commands match \""+m.filter+"\"."))
	}

	title := style.Render(" bpr ") + cDim.Render("  command palette")
	sep := cDim.Render(strings.Repeat("━", max(m.width, 1)))
	filterLine := ""
	if m.filtering {
		filterLine = "\n" + cCyan.Render("  filter: ") + m.filter + cCyan.Render("▏")
	} else if m.filter != "" {
		filterLine = "\n" + cDim.Render(fmt.Sprintf("  filter: %s   clear: esc", m.filter))
	}
	list := strings.Join(bm, "\n")
	footer := cDim.Render("  ↑↓ nav · 1-9 run · / filter · enter run · q quit")
	return title + "\n" + sep + filterLine + "\n\n" + list + "\n\n" + footer
}

func runPalette(a *app) {
	ctx := context.Background()

	cmds := []paletteCmd{
		{label: "Dashboard", desc: "Browse PRs and tickets", run: func() {
			if err := cmdDashboard(ctx, a); err != nil {
				die(err)
			}
		}},
		{label: "Status", desc: "PR status for current branch", run: func() {
			if err := cmdStatus(ctx, a); err != nil {
				die(err)
			}
			pause()
		}},
		{label: "Create", desc: "Create a PR from current branch", run: func() {
			interactiveCreate(ctx, a)
			pause()
		}},
		{label: "List", desc: "List open PRs", run: func() {
			if err := cmdList(ctx, a); err != nil {
				die(err)
			}
			pause()
		}},
		{label: "Web", desc: "Open current branch in browser", run: func() {
			if err := cmdWeb(ctx, a); err != nil {
				die(err)
			}
			pause()
		}},
		{label: "Issues", desc: "My Jira issues", run: func() {
			if err := cmdTodo(ctx, a); err != nil {
				die(err)
			}
			pause()
		}},
		{label: "Auth", desc: "Configure credentials", run: func() {
			if err := cmdAuth(); err != nil {
				die(err)
			}
			pause()
		}},
		{label: "Help", desc: "Show usage", run: func() {
			usage()
			pause()
		}},
	}

	for {
		m := paletteModel{cmds: cmds, filter: "", width: 80, height: 24}
		m.applyFilter()
		p, err := tea.NewProgram(m, tea.WithAltScreen()).Run()
		if err != nil {
			die(err)
		}
		mm := p.(paletteModel)
		if mm.chosen {
			idx := mm.filtered[mm.cursor]
			cmds[idx].run()
		} else {
			break
		}
	}
}

func pause() {
	fmt.Println()
	fmt.Print(cDim.Render("  Press Enter to return to menu..."))
	fmt.Scanln()
}

func interactiveCreate(ctx context.Context, a *app) {
	branch := currentBranch(a.dir)
	if !branchOnOrigin(a.dir, branch) {
		fmt.Fprintln(os.Stderr, cDim.Render("Branch not on origin yet — pushing ..."))
		if out, err := pushBranch(a.dir, branch); err != nil {
			fmt.Fprintln(os.Stderr, cRed.Render("push failed: "+string(out)))
			return
		}
	}

	dest, _ := a.bb.MainBranch(ctx, a.slug)
	if dest == "" {
		dest = "main"
	}
	title := defaultTitle(a.dir, branch)

	fmt.Println()
	fmt.Println(cBold.Render("Create pull request"))
	fmt.Println(cDim.Render(fmt.Sprintf("  %s → %s", branch, dest)))

	t := prompt(fmt.Sprintf("Title [%s]: ", title))
	if t != "" {
		title = t
	}

	d := prompt(fmt.Sprintf("Destination [%s]: ", dest))
	if d != "" {
		dest = d
	}

	body := prompt("Description (optional): ")

	pr, err := a.bb.Create(ctx, a.slug, bitbucket.CreateOptions{
		Title: title, Source: branch, Destination: dest,
		Description: body, CloseSourceBranch: true,
	})
	if err != nil {
		fmt.Fprintln(os.Stderr, cRed.Render("Failed: "+err.Error()))
		return
	}
	fmt.Printf("%s  %s\n", cGreen.Render("✓ Created PR"), pr.Links.HTML.Href)
}
