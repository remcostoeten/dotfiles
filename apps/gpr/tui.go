package main

import (
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/atotto/clipboard"
	"github.com/charmbracelet/bubbles/textarea"
	"github.com/charmbracelet/bubbles/textinput"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

// Active views/states in the application
type appState int

const (
	stateList appState = iota
	stateDetail
	stateFormNewPR
	stateFormNewIssue
	stateFormEditPR
	stateAIResponse
)

type tab int

const (
	tabPRs tab = iota
	tabIssues
)

type filterState string

const (
	filterOpen   filterState = "open"
	filterAll    filterState = "all"
	filterClosed filterState = "closed"
)

// Styling definitions using Lipgloss
var (
	// Palettes
	primaryColor   = lipgloss.Color("39")  // Vibrant light blue
	secondaryColor = lipgloss.Color("99")  // Deep purple
	accentColor    = lipgloss.Color("207") // Magenta/Pink
	textColor      = lipgloss.Color("255") // White
	dimColor       = lipgloss.Color("242") // Gray
	greenColor     = lipgloss.Color("42")  // Mint green
	redColor       = lipgloss.Color("197") // Crimson red

	cDim    = lipgloss.NewStyle().Foreground(dimColor)
	cCyan   = lipgloss.NewStyle().Foreground(primaryColor)
	cBranch = lipgloss.NewStyle().Foreground(secondaryColor)
	cBold   = lipgloss.NewStyle().Bold(true)
	cBlue   = lipgloss.NewStyle().Foreground(primaryColor)

	// Styles
	titleStyle = lipgloss.NewStyle().
			Background(primaryColor).
			Foreground(lipgloss.Color("0")).
			Bold(true).
			Padding(0, 2)

	activeTabStyle = lipgloss.NewStyle().
			Border(lipgloss.NormalBorder(), false, false, true, false).
			BorderForeground(primaryColor).
			Foreground(primaryColor).
			Bold(true).
			Padding(0, 1)

	inactiveTabStyle = lipgloss.NewStyle().
				Foreground(dimColor).
				Padding(0, 1)

	selectedRowStyle = lipgloss.NewStyle().
				Background(lipgloss.Color("236")).
				Foreground(primaryColor).
				Bold(true)

	statusOpenStyle = lipgloss.NewStyle().
			Foreground(greenColor).
			Bold(true)

	statusClosedStyle = lipgloss.NewStyle().
				Foreground(redColor).
				Bold(true)

	statusMergedStyle = lipgloss.NewStyle().
				Foreground(secondaryColor).
				Bold(true)

	borderStyle = lipgloss.NewStyle().
			Border(lipgloss.RoundedBorder()).
			BorderForeground(lipgloss.Color("240"))

	detailTitleStyle = lipgloss.NewStyle().
				Foreground(textColor).
				Bold(true).
				Underline(true)

	commentHeaderStyle = lipgloss.NewStyle().
				Foreground(accentColor).
				Bold(true)

	errorStyle = lipgloss.NewStyle().
			Foreground(redColor).
			Bold(true)

	successStyle = lipgloss.NewStyle().
			Foreground(greenColor).
			Bold(true)

	inputFocusStyle = lipgloss.NewStyle().
			Border(lipgloss.RoundedBorder()).
			BorderForeground(primaryColor)

	inputUnfocusedStyle = lipgloss.NewStyle().
				Border(lipgloss.RoundedBorder()).
				BorderForeground(lipgloss.Color("240"))

	keyStyle = lipgloss.NewStyle().
			Foreground(accentColor).
			Bold(true)

	hintSep = cDim.Render("   ")
)

// Messages
type prsLoadedMsg []GHPR
type prDetailsLoadedMsg struct {
	details  *GHPRDetails
	branches []string
}
type issuesLoadedMsg []GHIssue
type issueDetailsLoadedMsg struct {
	details  *GHIssueDetails
	branches []string
}
type operationCompleteMsg struct {
	success bool
	message string
}
type errorMsg error
type aiResponseMsg string

type model struct {
	state      appState
	currentTab tab

	// Lists
	prs           []GHPR
	issues        []GHIssue
	prCursor      int
	issueCursor   int
	prsLoading    bool
	issuesLoading bool

	// Filter
	filterText string
	filtering  bool

	// Details
	prDetails       *GHPRDetails
	issueDetails    *GHIssueDetails
	detailsLoading  bool
	detailsBranches []string // branches matching the issue/PR

	// Inputs/Forms
	titleInput textinput.Model
	descInput  textarea.Model
	formFocus  int // 0 for Title, 1 for Description, 2 for Save/Submit, 3 for Cancel

	// Vim mode for the description textarea
	vimMode   bool // whether vim-style modal editing is enabled
	vimInsert bool // true = insert mode, false = normal mode (only meaningful when vimMode is on)

	// Status messages
	statusMsg  string
	statusTime time.Time

	stateFilter filterState
	allBranches []string

	// Sorting and multi-select (issues)
	sortNewestFirst bool
	selectedIssues  map[int]bool

	// Send-to-AI
	aiBackend   string // one of aiBackends
	aiLoading   bool
	aiResponse  string
	aiPrevState appState // state to return to on esc from stateAIResponse

	// Viewport dimension
	width  int
	height int
	err    error
}

func initialModel() model {
	ti := textinput.New()
	ti.Placeholder = "Enter title..."
	ti.Focus()

	ta := textarea.New()
	ta.Placeholder = "Enter description/body..."
	ta.ShowLineNumbers = false
	ta.CharLimit = 0

	m := model{
		state:           stateList,
		currentTab:      tabPRs,
		stateFilter:     filterOpen,
		titleInput:      ti,
		descInput:       ta,
		vimInsert:       true,
		sortNewestFirst: true,
		selectedIssues:  make(map[int]bool),
		aiBackend:       aiBackends[0],
	}

	// Try loading cached open PRs
	var cachedPRs []GHPR
	if loadCache("prs_open.json", &cachedPRs) {
		m.prs = cachedPRs
		m.prsLoading = false
	} else {
		m.prsLoading = true
	}

	// Try loading cached open Issues
	var cachedIssues []GHIssue
	if loadCache("issues_open.json", &cachedIssues) {
		m.issues = cachedIssues
		m.issuesLoading = false
	} else {
		m.issuesLoading = true
	}

	// Fetch git branches once at startup
	branches, _ := getLocalAndRemoteBranches()
	m.allBranches = branches

	return m
}

func (m model) Init() tea.Cmd {
	// Start by fetching PRs only (lazy load Issues)
	return m.fetchPRsCmd()
}

// Commands for fetching data
func (m model) fetchPRsCmd() tea.Cmd {
	return func() tea.Msg {
		prs, err := listPRs(string(m.stateFilter))
		if err != nil {
			return errorMsg(err)
		}
		return prsLoadedMsg(prs)
	}
}

func (m model) fetchIssuesCmd() tea.Cmd {
	return func() tea.Msg {
		issues, err := listIssues(string(m.stateFilter))
		if err != nil {
			// Even if issues are disabled, we don't want to crash.
			// Return empty list and we can handle the error.
			return errorMsg(err)
		}
		return issuesLoadedMsg(issues)
	}
}

func (m model) fetchPRDetailsCmd(number int) tea.Cmd {
	return func() tea.Msg {
		details, err := viewPR(number)
		if err != nil {
			return errorMsg(err)
		}
		branches, _ := getLocalAndRemoteBranches()
		return prDetailsLoadedMsg{details: details, branches: branches}
	}
}

func (m model) fetchIssueDetailsCmd(number int) tea.Cmd {
	return func() tea.Msg {
		details, err := viewIssue(number)
		if err != nil {
			return errorMsg(err)
		}
		branches, _ := getLocalAndRemoteBranches()
		return issueDetailsLoadedMsg{details: details, branches: branches}
	}
}

func (m model) createPRCmd(title, body string) tea.Cmd {
	return func() tea.Msg {
		out, err := createPR(title, body)
		if err != nil {
			return errorMsg(err)
		}
		return operationCompleteMsg{success: true, message: fmt.Sprintf("PR created: %s", out)}
	}
}

func (m model) createIssueCmd(title, body string) tea.Cmd {
	return func() tea.Msg {
		out, err := createIssue(title, body)
		if err != nil {
			return errorMsg(err)
		}
		return operationCompleteMsg{success: true, message: fmt.Sprintf("Issue created: %s", out)}
	}
}

func (m model) editPRCmd(number int, title, body string) tea.Cmd {
	return func() tea.Msg {
		err := editPR(number, title, body)
		if err != nil {
			return errorMsg(err)
		}
		return operationCompleteMsg{success: true, message: "PR updated successfully"}
	}
}

func (m model) closePRCmd(number int) tea.Cmd {
	return func() tea.Msg {
		err := closePR(number)
		if err != nil {
			return errorMsg(err)
		}
		return operationCompleteMsg{success: true, message: fmt.Sprintf("PR #%d closed", number)}
	}
}

func (m model) sendToAICmd(prompt string) tea.Cmd {
	backend := m.aiBackend
	return func() tea.Msg {
		out, err := runAI(backend, prompt)
		if err != nil {
			return errorMsg(err)
		}
		return aiResponseMsg(out)
	}
}

func (m model) closeAndRemovePRCmd(number int) tea.Cmd {
	return func() tea.Msg {
		err := closeAndRemovePR(number)
		if err != nil {
			return errorMsg(err)
		}
		return operationCompleteMsg{success: true, message: fmt.Sprintf("PR #%d closed and branch deleted", number)}
	}
}

// Model Update loop
func (m model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmd tea.Cmd
	var cmds []tea.Cmd

	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
		m.descInput.SetWidth(msg.Width - 6)
		m.descInput.SetHeight(12)

	case errorMsg:
		m.err = msg
		m.prsLoading = false
		m.issuesLoading = false
		m.detailsLoading = false
		m.aiLoading = false
		m.statusMsg = fmt.Sprintf("Error: %s", msg.Error())
		m.statusTime = time.Now()

	case aiResponseMsg:
		m.aiLoading = false
		m.aiResponse = string(msg)
		m.state = stateAIResponse

	case prsLoadedMsg:
		m.prs = msg
		m.prsLoading = false
		m.err = nil

	case issuesLoadedMsg:
		m.issues = msg
		m.issuesLoading = false
		m.err = nil

	case prDetailsLoadedMsg:
		m.prDetails = msg.details
		m.detailsBranches = nil
		m.detailsLoading = false
		// Find matching local/remote branches for head branch
		if m.prDetails != nil {
			head := m.prDetails.HeadRefName
			for _, b := range msg.branches {
				if strings.Contains(b, head) {
					m.detailsBranches = append(m.detailsBranches, b)
				}
			}
		}

	case issueDetailsLoadedMsg:
		m.issueDetails = msg.details
		m.detailsBranches = nil
		m.detailsLoading = false
		// Scan branches for issue number (e.g. contains "123")
		if m.issueDetails != nil {
			numStr := fmt.Sprintf("%d", m.issueDetails.Number)
			for _, b := range msg.branches {
				// Avoid matching partial numbers if possible, but standard contains works
				if strings.Contains(b, numStr) || strings.Contains(b, "issue-"+numStr) {
					m.detailsBranches = append(m.detailsBranches, b)
				}
			}
		}

	case operationCompleteMsg:
		m.statusMsg = msg.message
		m.statusTime = time.Now()
		m.state = stateList
		m.prsLoading = true
		m.issuesLoading = true
		cmds = append(cmds, m.fetchPRsCmd(), m.fetchIssuesCmd())

	case tea.KeyMsg:
		// Global quit key
		if msg.String() == "ctrl+c" {
			return m, tea.Quit
		}

		// Handle key inputs based on state
		switch m.state {
		case stateList:
			if m.filtering {
				switch msg.String() {
				case "enter", "esc":
					m.filtering = false
				case "backspace":
					if len(m.filterText) > 0 {
						m.filterText = m.filterText[:len(m.filterText)-1]
					}
				default:
					if len(msg.Runes) > 0 {
						m.filterText += string(msg.Runes)
					}
				}
				return m, nil
			}

			switch msg.String() {
			case "q":
				return m, tea.Quit
			case "tab", "right", "l":
				if m.currentTab == tabPRs {
					m.currentTab = tabIssues
				} else {
					m.currentTab = tabPRs
				}
			case "left", "h":
				if m.currentTab == tabPRs {
					m.currentTab = tabIssues
				} else {
					m.currentTab = tabPRs
				}
			case "up", "k":
				if m.currentTab == tabPRs {
					if m.prCursor > 0 {
						m.prCursor--
					}
				} else {
					if m.issueCursor > 0 {
						m.issueCursor--
					}
				}
			case "down", "j":
				if m.currentTab == tabPRs {
					filteredPRsCount := len(m.getFilteredPRs())
					if m.prCursor < filteredPRsCount-1 {
						m.prCursor++
					}
				} else {
					filteredIssuesCount := len(m.getFilteredIssues())
					if m.issueCursor < filteredIssuesCount-1 {
						m.issueCursor++
					}
				}
			case "/":
				m.filtering = true
				m.filterText = ""
			case "s": // Cycle State Filter
				if m.stateFilter == filterOpen {
					m.stateFilter = filterAll
				} else if m.stateFilter == filterAll {
					m.stateFilter = filterClosed
				} else {
					m.stateFilter = filterOpen
				}
				m.prsLoading = true
				m.issuesLoading = true
				m.prCursor = 0
				m.issueCursor = 0
				cmds = append(cmds, m.fetchPRsCmd(), m.fetchIssuesCmd())
			case "r": // Refresh
				m.prsLoading = true
				m.issuesLoading = true
				cmds = append(cmds, m.fetchPRsCmd(), m.fetchIssuesCmd())
			case "o": // Toggle sort order (newest/oldest first)
				m.sortNewestFirst = !m.sortNewestFirst
			case "b": // Cycle AI backend
				for i, name := range aiBackends {
					if name == m.aiBackend {
						m.aiBackend = aiBackends[(i+1)%len(aiBackends)]
						break
					}
				}
			case "v": // Toggle multi-select (issues only)
				if m.currentTab == tabIssues {
					filtered := m.getFilteredIssues()
					if len(filtered) > 0 && m.issueCursor < len(filtered) {
						num := filtered[m.issueCursor].Number
						if m.selectedIssues[num] {
							delete(m.selectedIssues, num)
						} else {
							m.selectedIssues[num] = true
						}
					}
				}
			case "y": // Copy issue(s) to clipboard
				if m.currentTab == tabIssues {
					var text string
					if len(m.selectedIssues) > 0 {
						var blocks []string
						for _, issue := range m.issues {
							if m.selectedIssues[issue.Number] {
								blocks = append(blocks, formatIssueForCopy(issue))
							}
						}
						text = strings.Join(blocks, "\n"+strings.Repeat("=", 40)+"\n\n")
						if err := clipboard.WriteAll(text); err != nil {
							m.statusMsg = fmt.Sprintf("Error: %s", err.Error())
						} else {
							m.statusMsg = fmt.Sprintf("Copied %d issue(s) to clipboard", len(m.selectedIssues))
							m.selectedIssues = make(map[int]bool)
						}
					} else {
						filtered := m.getFilteredIssues()
						if len(filtered) > 0 && m.issueCursor < len(filtered) {
							text = formatIssueForCopy(filtered[m.issueCursor])
							if err := clipboard.WriteAll(text); err != nil {
								m.statusMsg = fmt.Sprintf("Error: %s", err.Error())
							} else {
								m.statusMsg = fmt.Sprintf("Copied issue #%d to clipboard", filtered[m.issueCursor].Number)
							}
						}
					}
					m.statusTime = time.Now()
				}
			case "g": // Send issue(s) straight to AI
				if m.currentTab == tabIssues && !m.aiLoading {
					var prompt string
					if len(m.selectedIssues) > 0 {
						var blocks []string
						for _, issue := range m.issues {
							if m.selectedIssues[issue.Number] {
								blocks = append(blocks, formatIssueForCopy(issue))
							}
						}
						prompt = "Review the following GitHub issues and help address them:\n\n" +
							strings.Join(blocks, "\n"+strings.Repeat("=", 40)+"\n\n")
						m.selectedIssues = make(map[int]bool)
					} else {
						filtered := m.getFilteredIssues()
						if len(filtered) > 0 && m.issueCursor < len(filtered) {
							prompt = "Review the following GitHub issue and help address it:\n\n" +
								formatIssueForCopy(filtered[m.issueCursor])
						}
					}
					if prompt != "" {
						m.aiLoading = true
						m.aiPrevState = stateList
						m.statusMsg = fmt.Sprintf("Asking %s...", m.aiBackend)
						m.statusTime = time.Now()
						cmds = append(cmds, m.sendToAICmd(prompt))
					}
				}
			case "n": // New
				if m.currentTab == tabPRs {
					m.state = stateFormNewPR
				} else {
					m.state = stateFormNewIssue
				}
				m.titleInput.SetValue("")
				m.descInput.SetValue("")
				m.titleInput.Focus()
				m.formFocus = 0
			case "enter": // View Details
				if m.currentTab == tabPRs {
					filtered := m.getFilteredPRs()
					if len(filtered) > 0 && m.prCursor < len(filtered) {
						pr := filtered[m.prCursor]
						m.state = stateDetail
						m.detailsLoading = true
						m.prDetails = nil
						m.issueDetails = nil
						cmds = append(cmds, m.fetchPRDetailsCmd(pr.Number))
					}
				} else {
					filtered := m.getFilteredIssues()
					if len(filtered) > 0 && m.issueCursor < len(filtered) {
						issue := filtered[m.issueCursor]
						m.state = stateDetail
						m.detailsLoading = true
						m.prDetails = nil
						m.issueDetails = nil
						cmds = append(cmds, m.fetchIssueDetailsCmd(issue.Number))
					}
				}
			}

		case stateDetail:
			switch msg.String() {
			case "esc", "backspace":
				m.state = stateList
			case "c": // Close PR
				if m.currentTab == tabPRs && m.prDetails != nil {
					m.detailsLoading = true
					cmds = append(cmds, m.closePRCmd(m.prDetails.Number))
				}
			case "d": // Delete PR & branch
				if m.currentTab == tabPRs && m.prDetails != nil {
					m.detailsLoading = true
					cmds = append(cmds, m.closeAndRemovePRCmd(m.prDetails.Number))
				}
			case "e": // Edit PR
				if m.currentTab == tabPRs && m.prDetails != nil {
					m.state = stateFormEditPR
					m.titleInput.SetValue(m.prDetails.Title)
					m.descInput.SetValue(m.prDetails.Body)
					m.titleInput.Focus()
					m.formFocus = 0
				}
			case "r": // Refresh details
				m.detailsLoading = true
				if m.currentTab == tabPRs && m.prDetails != nil {
					cmds = append(cmds, m.fetchPRDetailsCmd(m.prDetails.Number))
				} else if m.currentTab == tabIssues && m.issueDetails != nil {
					cmds = append(cmds, m.fetchIssueDetailsCmd(m.issueDetails.Number))
				}
			case "y": // Copy full issue (with comments) to clipboard
				if m.currentTab == tabIssues && m.issueDetails != nil {
					if err := clipboard.WriteAll(formatIssueDetailsForCopy(m.issueDetails)); err != nil {
						m.statusMsg = fmt.Sprintf("Error: %s", err.Error())
					} else {
						m.statusMsg = fmt.Sprintf("Copied issue #%d to clipboard", m.issueDetails.Number)
					}
					m.statusTime = time.Now()
				}
			case "b": // Cycle AI backend
				if m.currentTab == tabIssues {
					for i, name := range aiBackends {
						if name == m.aiBackend {
							m.aiBackend = aiBackends[(i+1)%len(aiBackends)]
							break
						}
					}
				}
			case "g": // Send full issue (with comments) straight to AI
				if m.currentTab == tabIssues && m.issueDetails != nil && !m.aiLoading {
					prompt := "Review the following GitHub issue and help address it:\n\n" +
						formatIssueDetailsForCopy(m.issueDetails)
					m.aiLoading = true
					m.aiPrevState = stateDetail
					m.statusMsg = fmt.Sprintf("Asking %s...", m.aiBackend)
					m.statusTime = time.Now()
					cmds = append(cmds, m.sendToAICmd(prompt))
				}
			}

		case stateAIResponse:
			switch msg.String() {
			case "esc", "backspace", "q":
				m.state = m.aiPrevState
			}

		case stateFormNewPR, stateFormNewIssue, stateFormEditPR:
			// Toggle vim mode for the description field
			if msg.String() == "ctrl+g" {
				m.vimMode = !m.vimMode
				m.vimInsert = !m.vimMode // vim on -> start in normal mode; vim off -> plain typing
				return m, nil
			}

			// While vim mode is on and the description field is focused and in
			// normal mode, keystrokes are vim navigation commands, not text input.
			if m.vimMode && m.formFocus == 1 && !m.vimInsert {
				handled := true
				switch msg.String() {
				case "i":
					m.vimInsert = true
				case "a":
					m.descInput, cmd = m.descInput.Update(tea.KeyMsg{Type: tea.KeyRight})
					cmds = append(cmds, cmd)
					m.vimInsert = true
				case "I":
					m.descInput.CursorStart()
					m.vimInsert = true
				case "A":
					m.descInput.CursorEnd()
					m.vimInsert = true
				case "o":
					m.descInput.CursorEnd()
					m.descInput, cmd = m.descInput.Update(tea.KeyMsg{Type: tea.KeyEnter})
					cmds = append(cmds, cmd)
					m.vimInsert = true
				case "h":
					m.descInput, cmd = m.descInput.Update(tea.KeyMsg{Type: tea.KeyLeft})
					cmds = append(cmds, cmd)
				case "l":
					m.descInput, cmd = m.descInput.Update(tea.KeyMsg{Type: tea.KeyRight})
					cmds = append(cmds, cmd)
				case "j":
					m.descInput, cmd = m.descInput.Update(tea.KeyMsg{Type: tea.KeyDown})
					cmds = append(cmds, cmd)
				case "k":
					m.descInput, cmd = m.descInput.Update(tea.KeyMsg{Type: tea.KeyUp})
					cmds = append(cmds, cmd)
				case "0":
					m.descInput.CursorStart()
				case "$":
					m.descInput.CursorEnd()
				case "x":
					m.descInput, cmd = m.descInput.Update(tea.KeyMsg{Type: tea.KeyDelete})
					cmds = append(cmds, cmd)
				case "tab", "down":
					m.formFocus = (m.formFocus + 1) % 4
					m.updateFormFocus()
				case "up":
					m.formFocus = (m.formFocus - 1 + 4) % 4
					m.updateFormFocus()
				case "esc":
					if m.state == stateFormEditPR {
						m.state = stateDetail
					} else {
						m.state = stateList
					}
				default:
					handled = false
				}
				if handled {
					return m, tea.Batch(cmds...)
				}
			}

			// Leaving insert mode via esc returns to vim normal mode instead of
			// forwarding esc to the textarea or closing the form.
			if m.vimMode && m.formFocus == 1 && m.vimInsert && msg.String() == "esc" {
				m.vimInsert = false
				return m, nil
			}

			switch msg.String() {
			case "esc":
				if m.state == stateFormEditPR {
					m.state = stateDetail
				} else {
					m.state = stateList
				}
			case "tab", "down":
				m.formFocus = (m.formFocus + 1) % 4
				m.updateFormFocus()
			case "up":
				m.formFocus = (m.formFocus - 1 + 4) % 4
				m.updateFormFocus()
			case "enter":
				if m.formFocus == 2 { // Submit
					title := m.titleInput.Value()
					body := m.descInput.Value()
					if title != "" {
						m.detailsLoading = true
						if m.state == stateFormNewPR {
							cmds = append(cmds, m.createPRCmd(title, body))
						} else if m.state == stateFormNewIssue {
							cmds = append(cmds, m.createIssueCmd(title, body))
						} else if m.state == stateFormEditPR && m.prDetails != nil {
							cmds = append(cmds, m.editPRCmd(m.prDetails.Number, title, body))
						}
					}
				} else if m.formFocus == 3 { // Cancel
					if m.state == stateFormEditPR {
						m.state = stateDetail
					} else {
						m.state = stateList
					}
				}
			}

			// Forward key inputs to inputs (skipped entirely while in vim normal mode,
			// handled above)
			if m.formFocus == 0 {
				m.titleInput, cmd = m.titleInput.Update(msg)
				cmds = append(cmds, cmd)
			} else if m.formFocus == 1 && (!m.vimMode || m.vimInsert) {
				m.descInput, cmd = m.descInput.Update(msg)
				cmds = append(cmds, cmd)
			}
		}
	}

	return m, tea.Batch(cmds...)
}

func (m *model) updateFormFocus() {
	m.titleInput.Blur()
	m.descInput.Blur()
	switch m.formFocus {
	case 0:
		m.titleInput.Focus()
	case 1:
		m.descInput.Focus()
	}
}

// Helper methods to filter lists
func (m model) getFilteredPRs() []GHPR {
	filtered := m.prs
	if m.filterText != "" {
		filtered = nil
		q := strings.ToLower(m.filterText)
		for _, pr := range m.prs {
			if strings.Contains(strings.ToLower(pr.Title), q) ||
				strings.Contains(strings.ToLower(pr.HeadRefName), q) ||
				strings.Contains(strings.ToLower(fmt.Sprintf("#%d", pr.Number)), q) {
				filtered = append(filtered, pr)
			}
		}
	}
	sorted := make([]GHPR, len(filtered))
	copy(sorted, filtered)
	sort.SliceStable(sorted, func(i, j int) bool {
		if m.sortNewestFirst {
			return sorted[i].UpdatedAt > sorted[j].UpdatedAt
		}
		return sorted[i].UpdatedAt < sorted[j].UpdatedAt
	})
	return sorted
}

func (m model) getFilteredIssues() []GHIssue {
	filtered := m.issues
	if m.filterText != "" {
		filtered = nil
		q := strings.ToLower(m.filterText)
		for _, issue := range m.issues {
			if strings.Contains(strings.ToLower(issue.Title), q) ||
				strings.Contains(strings.ToLower(fmt.Sprintf("#%d", issue.Number)), q) {
				filtered = append(filtered, issue)
			}
		}
	}
	sorted := make([]GHIssue, len(filtered))
	copy(sorted, filtered)
	sort.SliceStable(sorted, func(i, j int) bool {
		if m.sortNewestFirst {
			return sorted[i].CreatedAt > sorted[j].CreatedAt
		}
		return sorted[i].CreatedAt < sorted[j].CreatedAt
	})
	return sorted
}

// formatIssueForCopy renders a list-level issue (no comments available yet).
func formatIssueForCopy(issue GHIssue) string {
	return fmt.Sprintf("#%d %s\nState: %s | Author: %s | Created: %s\n\n%s\n",
		issue.Number, issue.Title, issue.State, issue.Author.Login, issue.CreatedAt, issue.Body)
}

// formatIssueDetailsForCopy renders a fully loaded issue including comments.
func formatIssueDetailsForCopy(d *GHIssueDetails) string {
	var s strings.Builder
	s.WriteString(fmt.Sprintf("#%d %s\nState: %s | Author: %s | Created: %s\n\n%s\n",
		d.Number, d.Title, d.State, d.Author.Login, d.CreatedAt, d.Body))
	if len(d.Comments) > 0 {
		s.WriteString("\n--- Comments ---\n")
		for _, c := range d.Comments {
			s.WriteString(fmt.Sprintf("\n%s (%s):\n%s\n", c.Author.Login, c.CreatedAt, c.Body))
		}
	}
	return s.String()
}

// View function
func (m model) View() string {
	if m.width == 0 || m.height == 0 {
		return "Initializing layout..."
	}

	var s strings.Builder

	// Header
	header := titleStyle.Render("GPR — GitHub Pull Requests & Issues")
	s.WriteString(header + "\n\n")

	// Tabs (only visible in list state)
	if m.state == stateList {
		var prTab, issueTab string
		if m.currentTab == tabPRs {
			prTab = activeTabStyle.Render("Pull Requests")
			issueTab = inactiveTabStyle.Render("Issues")
		} else {
			prTab = inactiveTabStyle.Render("Pull Requests")
			issueTab = activeTabStyle.Render("Issues")
		}
		stateStr := strings.ToUpper(string(m.stateFilter))
		s.WriteString(fmt.Sprintf("%s  %s    %s\n\n", prTab, issueTab, cDim.Render("(State Filter: "+stateStr+" - press 's' to change)")))

		// Filter bar
		if m.filtering {
			s.WriteString(cCyan.Render(fmt.Sprintf(" 🔍 filter: %s▋\n\n", m.filterText)))
		} else if m.filterText != "" {
			s.WriteString(cDim.Render(fmt.Sprintf(" 🔍 filter: %s  (press / to edit, esc to clear)\n\n", m.filterText)))
		}
	}

	// Content area
	switch m.state {
	case stateList:
		s.WriteString(m.listView())
	case stateDetail:
		s.WriteString(m.detailView())
	case stateFormNewPR:
		s.WriteString(m.formView("Create New Pull Request"))
	case stateFormNewIssue:
		s.WriteString(m.formView("Create New Issue"))
	case stateFormEditPR:
		s.WriteString(m.formView(fmt.Sprintf("Edit PR #%d", m.prDetails.Number)))
	case stateAIResponse:
		s.WriteString(m.aiResponseView())
	}

	// Footer status / help bar
	s.WriteString("\n" + m.footerView())

	return s.String()
}

func (m model) listView() string {
	var s strings.Builder

	if m.currentTab == tabPRs {
		if m.prsLoading {
			return "  Loading pull requests from remote..."
		}
		filtered := m.getFilteredPRs()
		if len(filtered) == 0 {
			return "  No pull requests found."
		}

		for i, pr := range filtered {
			// Format status
			var stateStr string
			switch pr.State {
			case "OPEN":
				stateStr = statusOpenStyle.Render("● OPEN")
			case "CLOSED":
				stateStr = statusClosedStyle.Render("✖ CLOSED")
			case "MERGED":
				stateStr = statusMergedStyle.Render("✔ MERGED")
			default:
				stateStr = cDim.Render(pr.State)
			}

			rowContent := fmt.Sprintf("  #%-4d  %-10s  %-40s  [%s -> %s] (%s)",
				pr.Number,
				stateStr,
				pr.Title,
				cBranch.Render(pr.HeadRefName),
				cBranch.Render(pr.BaseRefName),
				cDim.Render(pr.Author.Login),
			)

			if i == m.prCursor {
				s.WriteString(selectedRowStyle.Render(rowContent) + "\n")
			} else {
				s.WriteString(rowContent + "\n")
			}
		}
	} else {
		if m.issuesLoading {
			return "  Loading issues from remote..."
		}
		filtered := m.getFilteredIssues()
		if len(filtered) == 0 {
			return "  No issues found."
		}

		for i, issue := range filtered {
			var stateStr string
			if issue.State == "OPEN" {
				stateStr = statusOpenStyle.Render("● OPEN")
			} else {
				stateStr = statusClosedStyle.Render("✖ CLOSED")
			}

			checkbox := "[ ]"
			if m.selectedIssues[issue.Number] {
				checkbox = "[x]"
			}

			rowContent := fmt.Sprintf("  %s #%-4d  %-10s  %-50s  (%s)",
				checkbox,
				issue.Number,
				stateStr,
				issue.Title,
				cDim.Render(issue.Author.Login),
			)

			if i == m.issueCursor {
				s.WriteString(selectedRowStyle.Render(rowContent) + "\n")
			} else {
				s.WriteString(rowContent + "\n")
			}
		}
	}

	return s.String()
}

func (m model) detailView() string {
	if m.detailsLoading {
		return "  Loading details from remote..."
	}

	var s strings.Builder

	if m.currentTab == tabPRs {
		if m.prDetails == nil {
			return "  No pull request details loaded."
		}
		pr := m.prDetails

		s.WriteString(fmt.Sprintf("  %s %s\n", cBold.Render(cBlue.Render(fmt.Sprintf("PR #%d", pr.Number))), cBold.Render(pr.Title)))
		s.WriteString(fmt.Sprintf("  Author: %s | State: %s\n", pr.Author.Login, pr.State))
		s.WriteString(fmt.Sprintf("  Branch: %s -> %s\n", cBranch.Render(pr.HeadRefName), cBranch.Render(pr.BaseRefName)))
		s.WriteString(cDim.Render(strings.Repeat("─", m.width-4)) + "\n\n")

		// Description
		s.WriteString(detailTitleStyle.Render("Description") + "\n")
		if pr.Body == "" {
			s.WriteString(cDim.Render("  No description provided.") + "\n\n")
		} else {
			s.WriteString(fmt.Sprintf("  %s\n\n", strings.ReplaceAll(pr.Body, "\n", "\n  ")))
		}

		// Comments
		s.WriteString(detailTitleStyle.Render("Comments") + "\n")
		if len(pr.Comments) == 0 {
			s.WriteString(cDim.Render("  No comments.") + "\n\n")
		} else {
			for _, comment := range pr.Comments {
				s.WriteString(fmt.Sprintf("  %s (%s):\n", commentHeaderStyle.Render(comment.Author.Login), cDim.Render(comment.CreatedAt)))
				s.WriteString(fmt.Sprintf("    %s\n\n", strings.ReplaceAll(comment.Body, "\n", "\n    ")))
			}
		}
	} else {
		if m.issueDetails == nil {
			return "  No issue details loaded."
		}
		issue := m.issueDetails

		s.WriteString(fmt.Sprintf("  %s %s\n", cBold.Render(cBlue.Render(fmt.Sprintf("Issue #%d", issue.Number))), cBold.Render(issue.Title)))
		s.WriteString(fmt.Sprintf("  Author: %s | State: %s\n", issue.Author.Login, issue.State))

		// Branch
		if len(m.detailsBranches) > 0 {
			s.WriteString(fmt.Sprintf("  Assigned Branch: %s\n", cBranch.Render(strings.Join(m.detailsBranches, ", "))))
		} else {
			s.WriteString(cDim.Render("  No matching development branch detected in local/remote branches.") + "\n")
		}
		s.WriteString(cDim.Render(strings.Repeat("─", m.width-4)) + "\n\n")

		// Description
		s.WriteString(detailTitleStyle.Render("Description") + "\n")
		if issue.Body == "" {
			s.WriteString(cDim.Render("  No description provided.") + "\n\n")
		} else {
			s.WriteString(fmt.Sprintf("  %s\n\n", strings.ReplaceAll(issue.Body, "\n", "\n  ")))
		}

		// Comments
		s.WriteString(detailTitleStyle.Render("Comments") + "\n")
		if len(issue.Comments) == 0 {
			s.WriteString(cDim.Render("  No comments.") + "\n\n")
		} else {
			for _, comment := range issue.Comments {
				s.WriteString(fmt.Sprintf("  %s:\n", commentHeaderStyle.Render(comment.Author.Login)))
				s.WriteString(fmt.Sprintf("    %s\n\n", strings.ReplaceAll(comment.Body, "\n", "\n    ")))
			}
		}
	}

	return s.String()
}

func (m model) aiResponseView() string {
	var s strings.Builder
	s.WriteString(fmt.Sprintf("  %s\n\n", cBold.Render(cCyan.Render(fmt.Sprintf("AI Response (%s)", m.aiBackend)))))
	s.WriteString(cDim.Render(strings.Repeat("─", m.width-4)) + "\n\n")
	if m.aiResponse == "" {
		s.WriteString(cDim.Render("  No response."))
	} else {
		s.WriteString(fmt.Sprintf("  %s\n", strings.ReplaceAll(m.aiResponse, "\n", "\n  ")))
	}
	return s.String()
}

func (m model) formView(title string) string {
	var s strings.Builder

	s.WriteString(fmt.Sprintf("  %s\n\n", cBold.Render(cCyan.Render(title))))

	// Title Input field
	titleBox := m.titleInput.View()
	if m.formFocus == 0 {
		titleBox = inputFocusStyle.Render("Title:\n" + titleBox)
	} else {
		titleBox = inputUnfocusedStyle.Render("Title:\n" + titleBox)
	}
	s.WriteString("  " + strings.ReplaceAll(titleBox, "\n", "\n  ") + "\n\n")

	// Description Input field
	descBox := m.descInput.View()
	if m.formFocus == 1 {
		descBox = inputFocusStyle.Render("Description:\n" + descBox)
	} else {
		descBox = inputUnfocusedStyle.Render("Description:\n" + descBox)
	}
	s.WriteString("  " + strings.ReplaceAll(descBox, "\n", "\n  ") + "\n\n")

	// Submit and Cancel buttons
	submitBtn := " [ Submit ] "
	cancelBtn := " [ Cancel ] "

	if m.formFocus == 2 {
		submitBtn = selectedRowStyle.Render(submitBtn)
	} else if m.formFocus == 3 {
		cancelBtn = selectedRowStyle.Render(cancelBtn)
	}

	s.WriteString(fmt.Sprintf("  %s  %s\n", submitBtn, cancelBtn))

	return s.String()
}

// renderHints renders a row of "[key] label" pairs, with the key highlighted
// distinctly from its label so it's scannable at a glance.
func renderHints(pairs ...[2]string) string {
	parts := make([]string, len(pairs))
	for i, p := range pairs {
		parts[i] = keyStyle.Render("["+p[0]+"]") + cDim.Render(" "+p[1])
	}
	return "  " + strings.Join(parts, hintSep)
}

func (m model) footerView() string {
	var s strings.Builder

	// Top border
	s.WriteString(cDim.Render(strings.Repeat("━", m.width)) + "\n")

	// Status messages
	if (m.aiLoading || time.Since(m.statusTime) < 5*time.Second) && m.statusMsg != "" {
		if strings.HasPrefix(m.statusMsg, "Error") {
			s.WriteString(errorStyle.Render("  "+m.statusMsg) + "\n")
		} else {
			s.WriteString(successStyle.Render("  "+m.statusMsg) + "\n")
		}
	} else {
		s.WriteString("\n")
	}

	// Help instructions
	switch m.state {
	case stateList:
		sortStr := "Newest first"
		if !m.sortNewestFirst {
			sortStr = "Oldest first"
		}

		s.WriteString(renderHints(
			[2]string{"tab", "Switch tab"},
			[2]string{"↑/↓", "Navigate"},
			[2]string{"enter", "Details"},
			[2]string{"/", "Filter"},
			[2]string{"q", "Quit"},
		) + "\n")

		if m.currentTab == tabIssues {
			s.WriteString(renderHints(
				[2]string{"s", "State: " + strings.ToUpper(string(m.stateFilter))},
				[2]string{"o", "Sort: " + sortStr},
				[2]string{"v", "Select"},
				[2]string{"y", "Copy"},
				[2]string{"g", "Ask AI"},
				[2]string{"b", "Backend: " + m.aiBackend},
				[2]string{"n", "New"},
				[2]string{"r", "Refresh"},
			))
		} else {
			s.WriteString(renderHints(
				[2]string{"s", "State: " + strings.ToUpper(string(m.stateFilter))},
				[2]string{"o", "Sort: " + sortStr},
				[2]string{"n", "New"},
				[2]string{"r", "Refresh"},
			))
		}
	case stateDetail:
		if m.currentTab == tabPRs {
			s.WriteString(renderHints(
				[2]string{"esc", "Back"},
				[2]string{"e", "Edit"},
				[2]string{"c", "Close PR"},
				[2]string{"d", "Close + delete branch"},
				[2]string{"r", "Refresh"},
			))
		} else {
			s.WriteString(renderHints(
				[2]string{"esc", "Back"},
				[2]string{"y", "Copy"},
				[2]string{"g", "Ask AI"},
				[2]string{"b", "Backend: " + m.aiBackend},
				[2]string{"r", "Refresh"},
			))
		}
	case stateAIResponse:
		s.WriteString(renderHints([2]string{"esc/q", "Back"}))
	case stateFormNewPR, stateFormNewIssue, stateFormEditPR:
		vimStatus := "off"
		if m.vimMode {
			if m.vimInsert {
				vimStatus = "on · insert"
			} else {
				vimStatus = "on · normal"
			}
		}
		s.WriteString(renderHints(
			[2]string{"tab/↑/↓", "Focus field"},
			[2]string{"enter", "Select / submit"},
			[2]string{"esc", "Cancel"},
			[2]string{"ctrl+g", "Vim mode: " + vimStatus},
		))
	}

	return s.String()
}
