package main

import (
	"encoding/json"
	"fmt"
	"regexp"
	"strconv"
	"strings"

	tea "github.com/charmbracelet/bubbletea"
)

// triageFence tags the machine-readable block every AI answer ends with.
const triageFence = "gpr-triage"

const triageContract = "\n\nAlways end your final answer with a fenced code block tagged `" + triageFence + "` containing JSON of this exact shape " +
	"(one entry per issue, no other text inside the block):\n" +
	"```" + triageFence + "\n" +
	`{"tickets":[{"number":123,"summary":"one sentence","plan":["step"],"labels":["bug"],"estimate":"S|M|L","comment":"markdown comment to post on the issue"}]}` +
	"\n```\n" +
	"When a follow-up changes your recommendation, end that answer with an updated block as well.\n\n"

type ticketTriage struct {
	Number   int      `json:"number"`
	Summary  string   `json:"summary"`
	Plan     []string `json:"plan"`
	Labels   []string `json:"labels"`
	Estimate string   `json:"estimate"`
	Comment  string   `json:"comment"`
}

type triageAction string

const (
	triageComment triageAction = "comment"
	triageLabel   triageAction = "label"
	triageAssign  triageAction = "assign"
)

type triageAppliedMsg struct {
	key  string
	turn int
	done []string
	errs []string
}

var triageBlockRe = regexp.MustCompile("(?s)```" + triageFence + "\\s*\\n(.*?)```")

// parseTriage extracts the tickets from the last triage block in answer.
func parseTriage(answer string) []ticketTriage {
	matches := triageBlockRe.FindAllStringSubmatch(answer, -1)
	if len(matches) == 0 {
		return nil
	}
	var block struct {
		Tickets []ticketTriage `json:"tickets"`
	}
	if json.Unmarshal([]byte(matches[len(matches)-1][1]), &block) != nil {
		return nil
	}
	return block.Tickets
}

func stripTriage(answer string) string {
	return strings.TrimSpace(triageBlockRe.ReplaceAllString(answer, ""))
}

var ticketNumberRe = regexp.MustCompile(`\d+`)

// threadTickets returns the issue numbers a thread was started for, parsed
// from keys like "issue:12" or "issues:#3,#7".
func threadTickets(key string) map[int]bool {
	tickets := make(map[int]bool)
	for _, n := range ticketNumberRe.FindAllString(key, -1) {
		if v, err := strconv.Atoi(n); err == nil {
			tickets[v] = true
		}
	}
	return tickets
}

// latestTriage returns the newest turn index carrying a triage block whose
// tickets belong to the thread, or -1.
func latestTriage(thread *aiThread) (int, []ticketTriage) {
	allowed := threadTickets(thread.Key)
	for i := len(thread.Turns) - 1; i >= 0; i-- {
		var tickets []ticketTriage
		for _, t := range parseTriage(thread.Turns[i].Answer) {
			if allowed[t.Number] {
				tickets = append(tickets, t)
			}
		}
		if len(tickets) > 0 {
			return i, tickets
		}
	}
	return -1, nil
}

func triageDoneKey(action triageAction, number int) string {
	return fmt.Sprintf("%s:%d", action, number)
}

// pendingTriage lists the tickets an action would still change.
func pendingTriage(turn aiTurn, tickets []ticketTriage, action triageAction) []ticketTriage {
	var out []ticketTriage
	for _, t := range tickets {
		if turn.Done[triageDoneKey(action, t.Number)] {
			continue
		}
		switch action {
		case triageComment:
			if strings.TrimSpace(t.Comment) == "" {
				continue
			}
		case triageLabel:
			if len(t.Labels) == 0 {
				continue
			}
		}
		out = append(out, t)
	}
	return out
}

func applyTriageCmd(key string, turn int, action triageAction, tickets []ticketTriage) tea.Cmd {
	return func() tea.Msg {
		msg := triageAppliedMsg{key: key, turn: turn}
		var known map[string]bool
		if action == triageLabel {
			labels, err := listRepoLabels()
			if err != nil {
				msg.errs = append(msg.errs, err.Error())
				return msg
			}
			known = labels
		}
		for _, t := range tickets {
			var err error
			switch action {
			case triageComment:
				err = commentOnIssue(t.Number, t.Comment)
			case triageAssign:
				err = assignIssueToSelf(t.Number)
			case triageLabel:
				var valid []string
				for _, l := range t.Labels {
					if known[strings.ToLower(l)] {
						valid = append(valid, l)
					}
				}
				if len(valid) == 0 {
					msg.errs = append(msg.errs, fmt.Sprintf("#%d: none of %s exist in repo", t.Number, strings.Join(t.Labels, ", ")))
					continue
				}
				err = addIssueLabels(t.Number, valid)
			}
			if err != nil {
				msg.errs = append(msg.errs, fmt.Sprintf("#%d: %s", t.Number, oneLine(err.Error(), 80)))
				continue
			}
			msg.done = append(msg.done, triageDoneKey(action, t.Number))
		}
		return msg
	}
}

func renderTriageMarkdown(tickets []ticketTriage, done map[string]bool) string {
	var s strings.Builder
	s.WriteString("## Ticket output\n\n")
	for _, t := range tickets {
		meta := []string{}
		if t.Estimate != "" {
			meta = append(meta, "estimate **"+t.Estimate+"**")
		}
		if len(t.Labels) > 0 {
			meta = append(meta, "labels `"+strings.Join(t.Labels, "`, `")+"`")
		}
		for _, action := range []triageAction{triageComment, triageLabel, triageAssign} {
			if done[triageDoneKey(action, t.Number)] {
				meta = append(meta, "✓ "+string(action))
			}
		}
		fmt.Fprintf(&s, "### #%d — %s\n\n", t.Number, t.Summary)
		if len(meta) > 0 {
			s.WriteString(strings.Join(meta, " · ") + "\n\n")
		}
		for i, step := range t.Plan {
			fmt.Fprintf(&s, "%d. %s\n", i+1, step)
		}
		if strings.TrimSpace(t.Comment) != "" {
			s.WriteString("\n**Comment preview:**\n\n> " + strings.ReplaceAll(strings.TrimSpace(t.Comment), "\n", "\n> ") + "\n")
		}
		s.WriteString("\n")
	}
	return s.String()
}
