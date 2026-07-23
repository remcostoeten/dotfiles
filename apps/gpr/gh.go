package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"strings"
)

type GHUser struct {
	Login string `json:"login"`
	Name  string `json:"name"`
}

type GHCheckRollupItem struct {
	Typename   string `json:"__typename"`
	Status     string `json:"status"`
	Conclusion string `json:"conclusion"`
	State      string `json:"state"`
}

type GHPR struct {
	Number            int                 `json:"number"`
	Title             string              `json:"title"`
	State             string              `json:"state"`
	UpdatedAt         string              `json:"updatedAt"`
	Author            GHUser              `json:"author"`
	HeadRefName       string              `json:"headRefName"`
	BaseRefName       string              `json:"baseRefName"`
	Body              string              `json:"body"`
	StatusCheckRollup []GHCheckRollupItem `json:"statusCheckRollup"`
}

type GHComment struct {
	Author    GHUser `json:"author"`
	Body      string `json:"body"`
	CreatedAt string `json:"createdAt"`
}

type GHPRDetails struct {
	Number            int                 `json:"number"`
	Title             string              `json:"title"`
	Body              string              `json:"body"`
	State             string              `json:"state"`
	Author            GHUser              `json:"author"`
	HeadRefName       string              `json:"headRefName"`
	BaseRefName       string              `json:"baseRefName"`
	Comments          []GHComment         `json:"comments"`
	StatusCheckRollup []GHCheckRollupItem `json:"statusCheckRollup"`
}

type GHCheck struct {
	Name        string `json:"name"`
	State       string `json:"state"`
	Bucket      string `json:"bucket"`
	Workflow    string `json:"workflow"`
	Link        string `json:"link"`
	StartedAt   string `json:"startedAt"`
	CompletedAt string `json:"completedAt"`
	Description string `json:"description"`
	Event       string `json:"event"`
}

type GHIssue struct {
	Number    int    `json:"number"`
	Title     string `json:"title"`
	State     string `json:"state"`
	CreatedAt string `json:"createdAt"`
	UpdatedAt string `json:"updatedAt"`
	Author    GHUser `json:"author"`
	Body      string `json:"body"`
}

type GHIssueDetails struct {
	Number    int         `json:"number"`
	Title     string      `json:"title"`
	Body      string      `json:"body"`
	State     string      `json:"state"`
	CreatedAt string      `json:"createdAt"`
	Author    GHUser      `json:"author"`
	Comments  []GHComment `json:"comments"`
}

func runGH(args ...string) ([]byte, error) {
	cmd := exec.Command("gh", args...)
	// Strip GITHUB_TOKEN from env to use local user auth
	var env []string
	for _, e := range os.Environ() {
		if !strings.HasPrefix(e, "GITHUB_TOKEN=") {
			env = append(env, e)
		}
	}
	cmd.Env = env

	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	err := cmd.Run()
	if err != nil {
		return nil, fmt.Errorf("%v: %s", err, stderr.String())
	}
	return stdout.Bytes(), nil
}

// runGHAllowFail runs gh but still returns stdout when the command exits
// non-zero, because `gh pr checks` signals failing/pending checks through its
// exit code while emitting valid JSON.
func runGHAllowFail(args ...string) ([]byte, error) {
	cmd := exec.Command("gh", args...)
	var env []string
	for _, e := range os.Environ() {
		if !strings.HasPrefix(e, "GITHUB_TOKEN=") {
			env = append(env, e)
		}
	}
	cmd.Env = env

	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	err := cmd.Run()
	if err != nil && stdout.Len() == 0 {
		return nil, fmt.Errorf("%v: %s", err, stderr.String())
	}
	return stdout.Bytes(), nil
}

// Get the current git repository remote owner/name or let gh handle it.
// gh commands default to the current directory's repository.

func listPRs(state string) ([]GHPR, error) {
	out, err := runGH("pr", "list", "--state", state, "--limit", "50", "--json", "number,title,state,updatedAt,author,headRefName,baseRefName,body,statusCheckRollup")
	if err != nil {
		return nil, err
	}
	var prs []GHPR
	err = json.Unmarshal(out, &prs)
	return prs, err
}

func viewPR(number int) (*GHPRDetails, error) {
	out, err := runGH("pr", "view", fmt.Sprintf("%d", number), "--json", "number,title,body,state,author,headRefName,baseRefName,comments,statusCheckRollup")
	if err != nil {
		return nil, err
	}
	var details GHPRDetails
	err = json.Unmarshal(out, &details)
	return &details, err
}

const (
	ciNone    = "none"
	ciPass    = "pass"
	ciFail    = "fail"
	ciPending = "pending"
)

// ciState reduces a PR's status check rollup to a single overall state.
func ciState(items []GHCheckRollupItem) string {
	if len(items) == 0 {
		return ciNone
	}
	hasPending := false
	for _, it := range items {
		outcome := it.Conclusion
		if it.Typename == "StatusContext" {
			outcome = it.State
		}
		switch outcome {
		case "FAILURE", "ERROR", "TIMED_OUT", "CANCELLED", "ACTION_REQUIRED", "STARTUP_FAILURE":
			return ciFail
		case "SUCCESS", "NEUTRAL", "SKIPPED":
		default:
			hasPending = true
		}
		if it.Typename == "CheckRun" && it.Status != "" && it.Status != "COMPLETED" {
			hasPending = true
		}
	}
	if hasPending {
		return ciPending
	}
	return ciPass
}

func listChecks(number int) ([]GHCheck, error) {
	out, err := runGHAllowFail("pr", "checks", fmt.Sprintf("%d", number), "--json", "name,state,bucket,workflow,link,startedAt,completedAt,description,event")
	if err != nil {
		return nil, err
	}
	var checks []GHCheck
	if err := json.Unmarshal(out, &checks); err != nil {
		return nil, fmt.Errorf("parsing checks: %v", err)
	}
	return checks, nil
}

func openChecksInBrowser(number int) error {
	_, err := runGHAllowFail("pr", "checks", fmt.Sprintf("%d", number), "--web")
	return err
}

func openURL(url string) error {
	return exec.Command("xdg-open", url).Start()
}

func closePR(number int) error {
	_, err := runGH("pr", "close", fmt.Sprintf("%d", number))
	return err
}

func closeAndRemovePR(number int) error {
	_, err := runGH("pr", "close", fmt.Sprintf("%d", number), "--delete-branch")
	return err
}

func openPRInBrowser(number int) error {
	_, err := runGH("pr", "view", fmt.Sprintf("%d", number), "--web")
	return err
}

func openIssueInBrowser(number int) error {
	_, err := runGH("issue", "view", fmt.Sprintf("%d", number), "--web")
	return err
}

func createPR(title, body string) (string, error) {
	// Runs: gh pr create --title title --body body
	// To avoid interactive prompts, we pass title and body
	out, err := runGH("pr", "create", "--title", title, "--body", body)
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(string(out)), nil
}

func editPR(number int, title, body string) error {
	_, err := runGH("pr", "edit", fmt.Sprintf("%d", number), "--title", title, "--body", body)
	return err
}

func listIssues(state string) ([]GHIssue, error) {
	out, err := runGH("issue", "list", "--state", state, "--limit", "50", "--json", "number,title,state,createdAt,updatedAt,author,body")
	if err != nil {
		return nil, err
	}
	var issues []GHIssue
	err = json.Unmarshal(out, &issues)
	return issues, err
}

func viewIssue(number int) (*GHIssueDetails, error) {
	out, err := runGH("issue", "view", fmt.Sprintf("%d", number), "--json", "number,title,body,state,createdAt,author,comments")
	if err != nil {
		return nil, err
	}
	var details GHIssueDetails
	err = json.Unmarshal(out, &details)
	return &details, err
}

func createIssue(title, body string) (string, error) {
	out, err := runGH("issue", "create", "--title", title, "--body", body)
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(string(out)), nil
}

func getLocalAndRemoteBranches() ([]string, error) {
	cmd := exec.Command("git", "branch", "-a")
	var stdout bytes.Buffer
	cmd.Stdout = &stdout
	err := cmd.Run()
	if err != nil {
		return nil, err
	}
	var branches []string
	lines := strings.Split(stdout.String(), "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		line = strings.TrimPrefix(line, "*")
		line = strings.TrimSpace(line)
		branches = append(branches, line)
	}
	return branches, nil
}
