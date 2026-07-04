package main

import (
	"fmt"
	"strings"
	"time"

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
)

// Messages
type prsLoadedMsg []GHPR
type prDetailsLoadedMsg *GHPRDetails
type issuesLoadedMsg []GHIssue
type issueDetailsLoadedMsg *GHIssueDetails
type operationCompleteMsg struct {
	success bool
	message string
}
type errorMsg error

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

	// Status messages
	statusMsg  string
	statusTime time.Time

	stateFilter filterState
	allBranches []string

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

	m := model{
		state:       stateList,
		currentTab:  tabPRs,
		stateFilter: filterOpen,
		titleInput:  ti,
		descInput:   ta,
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
		m.statusMsg = fmt.Sprintf("Error: %s", msg.Error())
		m.statusTime = time.Now()

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
			}

		case stateFormNewPR, stateFormNewIssue, stateFormEditPR:
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

			// Forward key inputs to inputs
			if m.formFocus == 0 {
				m.titleInput, cmd = m.titleInput.Update(msg)
				cmds = append(cmds, cmd)
			} else if m.formFocus == 1 {
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
	if m.filterText == "" {
		return m.prs
	}
	var filtered []GHPR
	q := strings.ToLower(m.filterText)
	for _, pr := range m.prs {
		if strings.Contains(strings.ToLower(pr.Title), q) ||
			strings.Contains(strings.ToLower(pr.HeadRefName), q) ||
			strings.Contains(strings.ToLower(fmt.Sprintf("#%d", pr.Number)), q) {
			filtered = append(filtered, pr)
		}
	}
	return filtered
}

func (m model) getFilteredIssues() []GHIssue {
	if m.filterText == "" {
		return m.issues
	}
	var filtered []GHIssue
	q := strings.ToLower(m.filterText)
	for _, issue := range m.issues {
		if strings.Contains(strings.ToLower(issue.Title), q) ||
			strings.Contains(strings.ToLower(fmt.Sprintf("#%d", issue.Number)), q) {
			filtered = append(filtered, issue)
		}
	}
	return filtered
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

			rowContent := fmt.Sprintf("  #%-4d  %-10s  %-50s  (%s)",
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

func (m model) footerView() string {
	var s strings.Builder

	// Top border
	s.WriteString(cDim.Render(strings.Repeat("━", m.width)) + "\n")

	// Status messages
	if time.Since(m.statusTime) < 5*time.Second && m.statusMsg != "" {
		if strings.HasPrefix(m.statusMsg, "Error") {
			s.WriteString(errorStyle.Render("  " + m.statusMsg) + "\n")
		} else {
			s.WriteString(successStyle.Render("  " + m.statusMsg) + "\n")
		}
	} else {
		s.WriteString("\n")
	}

	// Help instructions
	switch m.state {
	case stateList:
		s.WriteString(cDim.Render(fmt.Sprintf("  [tab] Switch Tab | [s] State: %s | [↑/↓] Nav | [enter] View Details | [/] Filter | [n] New | [r] Refresh | [q] Quit", strings.ToUpper(string(m.stateFilter)))))
	case stateDetail:
		if m.currentTab == tabPRs {
			s.WriteString(cDim.Render("  [esc/backspace] Back | [e] Edit | [c] Close PR | [d] Close PR & Delete Branch | [r] Refresh"))
		} else {
			s.WriteString(cDim.Render("  [esc/backspace] Back | [r] Refresh"))
		}
	case stateFormNewPR, stateFormNewIssue, stateFormEditPR:
		s.WriteString(cDim.Render("  [tab/up/down] Focus Field | [enter] Select / Submit | [esc] Cancel"))
	}

	return s.String()
}
