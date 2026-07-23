package main

import (
	"fmt"
	"path/filepath"
	"sort"
	"strings"
	"time"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

type section int

const (
	sectionThemes section = iota
	sectionFonts
	sectionType
	sectionWindow
)

var sectionNames = []string{"Themes", "Fonts", "Typography", "Window"}

type model struct {
	paths        paths
	cfg          settings
	baseline     []byte
	themes       []theme
	fonts        []string
	favorites    []string
	recents      []string
	section      section
	cursor       int
	width        int
	height       int
	query        string
	searching    bool
	scope        int
	live         bool
	keepPreview  bool
	status       string
	statusIsErr  bool
	statusExpiry time.Time
}

func newModel(p paths, cfg settings, raw []byte) model {
	m := model{
		paths: p, cfg: cfg, baseline: raw,
		themes: discoverThemes(p.customThemes, p.systemThemes),
		fonts:  discoverFonts(), favorites: readLines(statePath("favorites")), recents: readLines(statePath("recents")),
		live: true,
	}
	m.cursor = m.currentIndex()
	return m
}

func (m model) Init() tea.Cmd { return nil }

type clearStatusMsg struct{ at time.Time }

func clearStatus(at time.Time) tea.Cmd {
	return tea.Tick(2200*time.Millisecond, func(time.Time) tea.Msg { return clearStatusMsg{at} })
}

func (m *model) flash(text string, isErr bool) tea.Cmd {
	m.status, m.statusIsErr, m.statusExpiry = text, isErr, time.Now()
	return clearStatus(m.statusExpiry)
}

func (m *model) filteredThemes() []theme {
	query := strings.ToLower(m.query)
	var out []theme
	for _, t := range m.themes {
		if query != "" && !strings.Contains(strings.ToLower(t.Name), query) {
			continue
		}
		switch m.scope {
		case 1:
			if !t.Custom {
				continue
			}
		case 2:
			if !contains(m.favorites, t.Name) {
				continue
			}
		case 3:
			if !contains(m.recents, t.Name) {
				continue
			}
		}
		out = append(out, t)
	}
	if m.scope == 3 {
		order := map[string]int{}
		for i, name := range m.recents {
			order[name] = i
		}
		sort.SliceStable(out, func(i, j int) bool { return order[out[i].Name] < order[out[j].Name] })
	}
	return out
}

func (m *model) filteredFonts() []string {
	if m.query == "" {
		return m.fonts
	}
	query := strings.ToLower(m.query)
	var out []string
	for _, font := range m.fonts {
		if strings.Contains(strings.ToLower(font), query) {
			out = append(out, font)
		}
	}
	return out
}

func (m *model) itemCount() int {
	switch m.section {
	case sectionThemes:
		return len(m.filteredThemes())
	case sectionFonts:
		return len(m.filteredFonts())
	case sectionType:
		return 3
	default:
		return 4
	}
}

func (m *model) currentIndex() int {
	switch m.section {
	case sectionThemes:
		for i, t := range m.filteredThemes() {
			if t.Name == m.cfg.Theme {
				return i
			}
		}
	case sectionFonts:
		for i, font := range m.filteredFonts() {
			if font == m.cfg.Font {
				return i
			}
		}
	}
	return 0
}

func (m *model) clampCursor() {
	n := m.itemCount()
	if n == 0 {
		m.cursor = 0
		return
	}
	if m.cursor < 0 {
		m.cursor = n - 1
	}
	if m.cursor >= n {
		m.cursor = 0
	}
}

func (m *model) selectCurrent() tea.Cmd {
	switch m.section {
	case sectionThemes:
		items := m.filteredThemes()
		if len(items) > 0 {
			m.cfg.Theme = items[m.cursor].Name
		}
	case sectionFonts:
		items := m.filteredFonts()
		if len(items) > 0 {
			m.cfg.Font = items[m.cursor]
		}
	}
	if m.live {
		return m.preview()
	}
	return nil
}

func (m *model) preview() tea.Cmd {
	assets := filepath.Join(filepath.Dir(m.paths.customThemes), "assets")
	if err := writeAtomic(m.paths.config, renderConfigWithAssets(m.baseline, m.cfg, assets)); err != nil {
		return m.flash("Could not update config: "+err.Error(), true)
	}
	return func() tea.Msg { reloadGhostty(); return nil }
}

func (m *model) commit() tea.Cmd {
	assets := filepath.Join(filepath.Dir(m.paths.customThemes), "assets")
	data := renderConfigWithAssets(m.baseline, m.cfg, assets)
	if err := writeAtomic(m.paths.config, data); err != nil {
		return m.flash("Apply failed: "+err.Error(), true)
	}
	m.baseline = data
	if m.section == sectionThemes {
		recordRecent(m.cfg.Theme)
		m.recents = readLines(statePath("recents"))
	}
	return tea.Batch(func() tea.Msg { reloadGhostty(); return nil }, m.flash("Applied — this is now your Ghostty configuration", false))
}

func (m *model) changeSection(delta int) tea.Cmd {
	m.section = section((int(m.section) + delta + len(sectionNames)) % len(sectionNames))
	m.query, m.searching = "", false
	m.cursor = m.currentIndex()
	return nil
}

func (m *model) changeValue(delta int) tea.Cmd {
	switch m.section {
	case sectionThemes, sectionFonts:
		m.cursor += delta
		m.clampCursor()
		return m.selectCurrent()
	case sectionType:
		switch m.cursor {
		case 0:
			m.cfg.FontSize = clamp(m.cfg.FontSize+delta, 6, 48)
		case 1:
			m.cfg.LineHeight = clamp(m.cfg.LineHeight+delta*5, -20, 60)
		case 2:
			m.cfg.LetterSpacing = clamp(m.cfg.LetterSpacing+delta*2, -20, 30)
		}
	case sectionWindow:
		switch m.cursor {
		case 0:
			m.cfg.Opacity = clamp(m.cfg.Opacity+delta*5, 20, 100)
		case 1:
			m.cfg.Blur = clamp(m.cfg.Blur+delta*5, 0, 100)
		case 2:
			m.cfg.Padding = clamp(m.cfg.Padding+delta*2, 0, 40)
		case 3:
			m.cfg.Decorations = !m.cfg.Decorations
		}
	}
	if m.live {
		return m.preview()
	}
	return nil
}

func clamp(n, low, high int) int {
	if n < low {
		return low
	}
	if n > high {
		return high
	}
	return n
}

func (m model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width, m.height = msg.Width, msg.Height
	case clearStatusMsg:
		if msg.at == m.statusExpiry {
			m.status = ""
		}
	case tea.KeyMsg:
		if m.searching {
			switch msg.String() {
			case "esc":
				m.searching, m.query = false, ""
				m.cursor = m.currentIndex()
			case "enter":
				m.searching = false
			case "backspace":
				if len(m.query) > 0 {
					runes := []rune(m.query)
					m.query = string(runes[:len(runes)-1])
				}
				m.cursor = 0
				return m, m.selectCurrent()
			case "ctrl+c":
				return m, tea.Quit
			default:
				if len(msg.Runes) > 0 {
					m.query += string(msg.Runes)
					m.cursor = 0
					return m, m.selectCurrent()
				}
			}
			return m, nil
		}
		switch msg.String() {
		case "q", "esc", "ctrl+c":
			return m, tea.Quit
		case "tab", "]", "l":
			return m, m.changeSection(1)
		case "shift+tab", "[", "h":
			return m, m.changeSection(-1)
		case "up", "k":
			m.cursor--
			m.clampCursor()
			return m, m.selectCurrent()
		case "down", "j":
			m.cursor++
			m.clampCursor()
			return m, m.selectCurrent()
		case "left":
			return m, m.changeValue(-1)
		case "right":
			return m, m.changeValue(1)
		case "pgup":
			for range 6 {
				m.cursor--
			}
			m.clampCursor()
			return m, m.selectCurrent()
		case "pgdown":
			for range 6 {
				m.cursor++
			}
			m.clampCursor()
			return m, m.selectCurrent()
		case "home":
			m.cursor = 0
			return m, m.selectCurrent()
		case "end":
			m.cursor = m.itemCount() - 1
			m.clampCursor()
			return m, m.selectCurrent()
		case "/":
			if m.section == sectionThemes || m.section == sectionFonts {
				m.searching, m.query = true, ""
			}
		case "enter":
			return m, m.commit()
		case "p":
			m.live = !m.live
			if m.live {
				return m, tea.Batch(m.preview(), m.flash("Live preview on", false))
			}
			return m, m.flash("Live preview paused", false)
		case "v":
			if m.section == sectionThemes {
				m.scope = (m.scope + 1) % 4
				m.query = ""
				m.cursor = m.currentIndex()
				return m, m.selectCurrent()
			}
		case "f":
			if m.section == sectionThemes && len(m.filteredThemes()) > 0 {
				name := m.filteredThemes()[m.cursor].Name
				added := toggleLine(statePath("favorites"), name)
				m.favorites = readLines(statePath("favorites"))
				verb := "Removed from"
				if added {
					verb = "Added to"
				}
				return m, m.flash(verb+" favorites", false)
			}
		}
	case tea.MouseMsg:
		switch msg.Button {
		case tea.MouseButtonWheelUp:
			m.cursor--
			m.clampCursor()
			return m, m.selectCurrent()
		case tea.MouseButtonWheelDown:
			m.cursor++
			m.clampCursor()
			return m, m.selectCurrent()
		}
	}
	return m, nil
}

func (m model) selectedTheme() theme {
	for _, t := range m.themes {
		if t.Name == m.cfg.Theme {
			return t
		}
	}
	return theme{Name: m.cfg.Theme, Background: "#111118", Foreground: "#e8e8f0", Cursor: "#a78bfa", Selection: "#303040"}
}

type uiStyles struct {
	accent, muted, text, bg                           string
	title, tab, activeTab, panel, selected, key, help lipgloss.Style
}

func stylesFor(t theme) uiStyles {
	bg, text := validColor(t.Background, "#111118"), validColor(t.Foreground, "#e8e8f0")
	accent, muted := validColor(t.Cursor, "#a78bfa"), "#6f7085"
	return uiStyles{
		accent: accent, muted: muted, text: text, bg: bg,
		title:     lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color(text)),
		tab:       lipgloss.NewStyle().Foreground(lipgloss.Color(muted)).Padding(0, 1),
		activeTab: lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color(bg)).Background(lipgloss.Color(accent)).Padding(0, 1),
		panel:     lipgloss.NewStyle().Border(lipgloss.RoundedBorder()).BorderForeground(lipgloss.Color("#3a3a4c")).Padding(0, 1),
		selected:  lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color(bg)).Background(lipgloss.Color(accent)).Padding(0, 1),
		key:       lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color(accent)),
		help:      lipgloss.NewStyle().Foreground(lipgloss.Color(muted)),
	}
}

func (m model) View() string {
	if m.width == 0 {
		return ""
	}
	t := m.selectedTheme()
	s := stylesFor(t)
	innerW := max(50, m.width-4)
	header := s.title.Render("  ◇ GHOSTTY STUDIO") + s.help.Render("   appearance, without the guesswork")
	var tabs []string
	for i, name := range sectionNames {
		if i == int(m.section) {
			tabs = append(tabs, s.activeTab.Render(name))
		} else {
			tabs = append(tabs, s.tab.Render(name))
		}
	}
	tabRow := lipgloss.JoinHorizontal(lipgloss.Top, tabs...)

	bodyH := max(12, m.height-8)
	leftW := clamp(innerW*38/100, 30, 48)
	rightW := max(28, innerW-leftW-1)
	left := s.panel.Width(leftW - 4).Height(bodyH - 2).Render(m.listView(leftW-6, bodyH-4, s))
	right := s.panel.Width(rightW - 4).Height(bodyH - 2).Render(m.previewView(rightW-6, bodyH-4, s, t))
	body := lipgloss.JoinHorizontal(lipgloss.Top, left, " ", right)
	if m.width < 88 {
		left = s.panel.Width(innerW - 4).Height(max(7, bodyH/2-1)).Render(m.listView(innerW-6, max(5, bodyH/2-3), s))
		right = s.panel.Width(innerW - 4).Height(max(7, bodyH/2-1)).Render(m.previewView(innerW-6, max(5, bodyH/2-3), s, t))
		body = lipgloss.JoinVertical(lipgloss.Left, left, right)
	}
	footer := m.footer(s)
	return lipgloss.NewStyle().Padding(1, 2).Render(lipgloss.JoinVertical(lipgloss.Left, header, tabRow, body, footer))
}

func (m model) listView(width, height int, s uiStyles) string {
	title := sectionNames[m.section]
	if m.section == sectionThemes {
		title += "  " + []string{"all", "custom", "favorites", "recent"}[m.scope]
	}
	if m.searching {
		title = "/ " + m.query + "▌"
	} else if m.query != "" {
		title += "  /" + m.query
	}
	lines := []string{s.title.Render(title), ""}
	var items []string
	switch m.section {
	case sectionThemes:
		for _, t := range m.filteredThemes() {
			star := "  "
			if contains(m.favorites, t.Name) {
				star = "★ "
			}
			suffix := ""
			if t.Custom {
				suffix = "  ·"
			}
			items = append(items, star+t.Name+suffix)
		}
	case sectionFonts:
		items = m.filteredFonts()
	case sectionType:
		items = []string{fmt.Sprintf("Font size          %d pt", m.cfg.FontSize), fmt.Sprintf("Line height        %+d%%", m.cfg.LineHeight), fmt.Sprintf("Letter spacing     %+d%%", m.cfg.LetterSpacing)}
	case sectionWindow:
		deco := "hidden"
		if m.cfg.Decorations {
			deco = "system"
		}
		items = []string{fmt.Sprintf("Background         %d%%", m.cfg.Opacity), fmt.Sprintf("Backdrop blur      %d", m.cfg.Blur), fmt.Sprintf("Window padding     %d px", m.cfg.Padding), fmt.Sprintf("Decorations        %s", deco)}
	}
	available := max(1, height-len(lines))
	start := 0
	if m.cursor >= available {
		start = m.cursor - available + 1
	}
	for i := start; i < len(items) && len(lines) < height; i++ {
		label := truncate(items[i], width-4)
		if i == m.cursor {
			lines = append(lines, s.selected.Width(max(1, width-2)).Render("› "+label))
		} else {
			lines = append(lines, "  "+label)
		}
	}
	if len(items) == 0 {
		lines = append(lines, s.help.Render("  No matches"))
	}
	return strings.Join(lines, "\n")
}

func (m model) previewView(width, height int, s uiStyles, t theme) string {
	meta := fmt.Sprintf("%s  ·  %dpt  ·  line %+d%%  ·  cell %+d%%", m.cfg.Font, m.cfg.FontSize, m.cfg.LineHeight, m.cfg.LetterSpacing)
	lines := []string{s.title.Render("Live terminal preview"), s.help.Render(truncate(meta, width)), ""}
	bg, fg := lipgloss.Color(validColor(t.Background, s.bg)), lipgloss.Color(validColor(t.Foreground, s.text))
	terminal := lipgloss.NewStyle().Background(bg).Foreground(fg).Padding(1, 2).Width(max(10, width-2))
	prompt := lipgloss.NewStyle().Foreground(lipgloss.Color(validColor(t.Palette[2], s.accent))).Background(bg).Bold(true).Render("❯")
	path := lipgloss.NewStyle().Foreground(lipgloss.Color(validColor(t.Palette[4], s.accent))).Background(bg).Bold(true).Render("~/dotfiles")
	keyword := lipgloss.NewStyle().Foreground(lipgloss.Color(validColor(t.Palette[5], s.accent))).Background(bg).Render("func")
	name := lipgloss.NewStyle().Foreground(lipgloss.Color(validColor(t.Palette[6], s.accent))).Background(bg).Render("main")
	str := lipgloss.NewStyle().Foreground(lipgloss.Color(validColor(t.Palette[3], s.accent))).Background(bg).Render(`"hello, ghostty"`)
	code := []string{
		path + "  " + prompt + " go run .",
		"",
		keyword + " " + name + "() {",
		"  fmt.Println(" + str + ")",
		"}",
		"",
		lipgloss.NewStyle().Foreground(lipgloss.Color(validColor(t.Palette[2], s.accent))).Background(bg).Render("✓ built in 183ms") + "   0123456789  Aa Bb Cc",
	}
	if m.cfg.LineHeight >= 20 && height > 15 {
		code = spreadLines(code)
	}
	lines = append(lines, terminal.Render(strings.Join(code, "\n")), "")
	var swatches []string
	for i, color := range t.Palette {
		if color == "" {
			color = []string{"#191922", "#ef6b73", "#58c78d", "#e5c07b", "#61afef", "#c678dd", "#56b6c2", "#abb2bf"}[i%8]
		}
		swatches = append(swatches, lipgloss.NewStyle().Background(lipgloss.Color(color)).Render("   "))
	}
	lines = append(lines, strings.Join(swatches[:8], ""), strings.Join(swatches[8:], ""))
	return strings.Join(lines, "\n")
}

func spreadLines(lines []string) []string {
	out := make([]string, 0, len(lines)*2)
	for i, line := range lines {
		out = append(out, line)
		if i < len(lines)-1 {
			out = append(out, "")
		}
	}
	return out
}

func (m model) footer(s uiStyles) string {
	if m.status != "" {
		style := s.key
		if m.statusIsErr {
			style = lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("#ff6b7a"))
		}
		return style.Render("  " + m.status)
	}
	live := "preview on"
	if !m.live {
		live = "preview paused"
	}
	parts := []string{s.key.Render("↑↓") + s.help.Render(" navigate"), s.key.Render("←→") + s.help.Render(" adjust"), s.key.Render("/") + s.help.Render(" search"), s.key.Render("enter") + s.help.Render(" apply"), s.key.Render("p") + s.help.Render(" "+live), s.key.Render("q") + s.help.Render(" restore & quit")}
	if m.section == sectionThemes {
		parts = append(parts, s.key.Render("f")+s.help.Render(" favorite"), s.key.Render("v")+s.help.Render(" view"))
	}
	return "  " + strings.Join(parts, s.help.Render("   "))
}

func truncate(value string, width int) string {
	if width < 1 {
		return ""
	}
	if lipgloss.Width(value) <= width {
		return value
	}
	runes := []rune(value)
	for len(runes) > 0 && lipgloss.Width(string(runes))+1 > width {
		runes = runes[:len(runes)-1]
	}
	return string(runes) + "…"
}
