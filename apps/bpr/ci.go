package main

import (
	"fmt"

	"github.com/remcostoeten/bpr/internal/bitbucket"
)

type ciSummary struct {
	OK, Failed, Running, Stopped, Total int
}

func summarizeCI(statuses []bitbucket.Status) ciSummary {
	var s ciSummary
	for _, st := range statuses {
		s.Total++
		switch st.State {
		case "SUCCESSFUL":
			s.OK++
		case "FAILED":
			s.Failed++
		case "INPROGRESS":
			s.Running++
		case "STOPPED":
			s.Stopped++
		}
	}
	return s
}

// short renders a compact, colored CI badge for a status list.
func (s ciSummary) short() string {
	switch {
	case s.Total == 0:
		return cDim.Render("no checks")
	case s.Failed > 0:
		return cRed.Render(fmt.Sprintf("%d failing", s.Failed))
	case s.Running > 0:
		return cYellow.Render(fmt.Sprintf("%d running", s.Running))
	default:
		return cGreen.Render(fmt.Sprintf("%d passing", s.OK))
	}
}
