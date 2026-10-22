package main

import (
	"context"
	"fmt"
	"strings"
)

func linkBranchTicket(dir, branch, key string) {
	if branch == "" || branch == "HEAD" {
		return
	}
	if _, err := git(dir, "config", "branch."+branch+".jira", key); err != nil {
		fmt.Println(cYellow.Render("  ! could not link " + branch + " to " + key))
	}
}

func linkedTicket(dir, branch string) string {
	out, err := git(dir, "config", "--get", "branch."+branch+".jira")
	if err != nil {
		return ""
	}
	return strings.ToUpper(out)
}

func isDirty(dir string) bool {
	out, err := git(dir, "status", "--porcelain")
	return err == nil && out != ""
}

func localBranchExists(dir, branch string) bool {
	_, err := git(dir, "rev-parse", "--verify", "--quiet", "refs/heads/"+branch)
	return err == nil
}

// ticketBranchName builds "MAR-2112-pdp-card-color-regression".
func ticketBranchName(key, title string) string {
	slug := slugify(title)
	if len(slug) > 50 {
		slug = strings.TrimRight(slug[:50], "-")
	}
	if slug == "" {
		return key
	}
	return key + "-" + slug
}

// stripEpicPrefix turns "RJL | Header alignment" into "Header alignment".
func stripEpicPrefix(summary string) string {
	if i := strings.LastIndex(summary, " | "); i >= 0 {
		return strings.TrimSpace(summary[i+3:])
	}
	return summary
}

// ticketMatch is a ticket found for a branch; sure is false when it was only
// guessed from recently created tickets.
type ticketMatch struct {
	key     string
	summary string
	sure    bool
}

func findBranchTicket(ctx context.Context, a *app, branch string) ticketMatch {
	key := branchTicket(branch)
	if key == "" {
		key = linkedTicket(a.dir, branch)
	}
	if key != "" {
		m := ticketMatch{key: key, sure: true}
		if a.hasJira() {
			if is, err := a.jira.Issue(ctx, key); err == nil {
				m.summary = is.Summary()
			}
		}
		return m
	}
	if !a.hasJira() {
		return ticketMatch{}
	}
	recent, err := a.jira.Search(ctx, "reporter = currentUser() AND created >= -3d ORDER BY created DESC", 20)
	if err != nil || len(recent) == 0 {
		return ticketMatch{}
	}
	best, bestScore := recent[0], 0
	for _, is := range recent {
		if s := wordOverlap(titleFromBranch(branch), stripEpicPrefix(is.Summary())); s > bestScore {
			best, bestScore = is, s
		}
	}
	return ticketMatch{key: best.Key, summary: best.Summary(), sure: bestScore > 0}
}

func wordOverlap(a, b string) int {
	words := map[string]bool{}
	for _, w := range strings.Fields(strings.ToLower(a)) {
		if len(w) > 2 {
			words[w] = true
		}
	}
	n := 0
	for _, w := range strings.Fields(strings.ToLower(b)) {
		if words[w] {
			n++
			delete(words, w)
		}
	}
	return n
}

func prTitleFor(key, summary, fallback string) string {
	name := stripEpicPrefix(summary)
	if name == "" {
		name = capitalize(fallback)
	}
	if strings.HasPrefix(strings.ToUpper(name), key) {
		return name
	}
	return key + ": " + name
}

// smartPRTitle picks a title for a PR from branch: the linked or guessed
// ticket when there is one, otherwise the last commit subject.
func smartPRTitle(ctx context.Context, a *app, branch string, interactive bool) string {
	m := findBranchTicket(ctx, a, branch)
	if m.key == "" {
		return defaultTitle(a.dir, branch)
	}
	if !m.sure {
		if !interactive {
			return defaultTitle(a.dir, branch)
		}
		ans := strings.ToLower(prompt(fmt.Sprintf("Link this PR to your latest ticket %s %s? [Y/n] ",
			cBlue.Render(m.key), cDim.Render(m.summary))))
		if ans == "n" || ans == "no" {
			return defaultTitle(a.dir, branch)
		}
	}
	linkBranchTicket(a.dir, branch, m.key)
	return prTitleFor(m.key, m.summary, lastCommitSubject(a.dir))
}

// offerTicketBranch asks to move work from branch onto a ticket-named branch.
func offerTicketBranch(ctx context.Context, a *app, branch, key, title string) {
	target := ticketBranchName(key, title)
	if branch == target {
		return
	}
	current := currentBranch(a.dir)
	existsLocal := localBranchExists(a.dir, branch)

	fmt.Println()
	var question string
	switch {
	case existsLocal && branch == current:
		question = fmt.Sprintf("Rename %s → %s?", branch, target)
	case existsLocal:
		question = fmt.Sprintf("Check out %s as %s?", branch, target)
	default:
		question = fmt.Sprintf("Create and check out %s?", target)
	}
	i, err := pickOne(question, []pickItem{{label: "Yes"}, {label: "No", hint: "keep the branch as is (ticket is still linked)"}}, 0)
	if err != nil || i == 1 {
		return
	}

	if branch != current && isDirty(a.dir) {
		choice, err := pickOne("You have uncommitted changes on "+current, []pickItem{
			{label: "Bring them along", hint: "carry them to " + target},
			{label: "Stash them", hint: "git stash, restore later with git stash pop"},
			{label: "Cancel"},
		}, 0)
		if err != nil || choice == 2 {
			return
		}
		if choice == 1 {
			if out, err := git(a.dir, "stash", "push", "-u", "-m", "bpr: before "+target); err != nil {
				fmt.Println(cRed.Render("  stash failed: " + out))
				return
			}
			fmt.Println(cGreen.Render("  ✓ stashed changes from " + current))
		}
	}

	var out string
	switch {
	case existsLocal && branch == current:
		out, err = git(a.dir, "branch", "-m", branch, target)
	case existsLocal:
		if out, err = git(a.dir, "branch", "-m", branch, target); err == nil {
			out, err = git(a.dir, "checkout", target)
		}
	case branchOnOrigin(a.dir, branch):
		out, err = git(a.dir, "checkout", "-b", target, "origin/"+branch)
	default:
		out, err = git(a.dir, "checkout", "-b", target)
	}
	if err != nil {
		fmt.Println(cRed.Render("  git failed: " + out))
		return
	}
	linkBranchTicket(a.dir, target, key)
	fmt.Println(cGreen.Render("  ✓ on " + target))
	if existsLocal && branchOnOrigin(a.dir, branch) {
		fmt.Println(cDim.Render("  note: origin/" + branch + " still exists; the PR will push " + target))
	}
}
