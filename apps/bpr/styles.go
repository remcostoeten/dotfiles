package main

import "github.com/charmbracelet/lipgloss"

var (
	cRed     = lipgloss.NewStyle().Foreground(lipgloss.Color("1"))
	cGreen   = lipgloss.NewStyle().Foreground(lipgloss.Color("2"))
	cYellow  = lipgloss.NewStyle().Foreground(lipgloss.Color("3"))
	cBlue    = lipgloss.NewStyle().Foreground(lipgloss.Color("39"))
	cCyan    = lipgloss.NewStyle().Foreground(lipgloss.Color("6"))
	cDim     = lipgloss.NewStyle().Foreground(lipgloss.Color("240"))
	cBold    = lipgloss.NewStyle().Bold(true)
	cPurple  = lipgloss.NewStyle().Foreground(lipgloss.Color("5"))
	cSuccess = lipgloss.NewStyle().Foreground(lipgloss.Color("2")).Bold(true)
	cFail    = lipgloss.NewStyle().Foreground(lipgloss.Color("1")).Bold(true)
	cWarning = lipgloss.NewStyle().Foreground(lipgloss.Color("3")).Bold(true)
	cBranch  = lipgloss.NewStyle().Foreground(lipgloss.Color("99"))
	cGrayB   = lipgloss.NewStyle().Foreground(lipgloss.Color("245"))
	cKey     = lipgloss.NewStyle().Foreground(lipgloss.Color("6")).Bold(true)
)
