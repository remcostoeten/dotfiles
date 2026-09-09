// Package jira is a minimal Jira Cloud REST API v3 client for the operations
// gpr needs: listing the current user's issues, viewing an issue, applying
// status transitions and adding comments. It authenticates with the same
// Atlassian email + API token used for Bitbucket.
package jira

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

type Client struct {
	base  string // https://acme.atlassian.net
	email string
	token string
	http  *http.Client
}

func New(site, email, token string) *Client {
	return &Client{
		base:  strings.TrimSuffix(site, "/"),
		email: email,
		token: token,
		http:  &http.Client{Timeout: 30 * time.Second},
	}
}

// --- models ---

type Issue struct {
	Key    string `json:"key"`
	Fields struct {
		Summary string `json:"summary"`
		Status  struct {
			Name     string `json:"name"`
			Category struct {
				Key string `json:"key"` // new / indeterminate / done
			} `json:"statusCategory"`
		} `json:"status"`
		Assignee *struct {
			DisplayName string `json:"displayName"`
		} `json:"assignee"`
		IssueType struct {
			Name string `json:"name"`
		} `json:"issuetype"`
		Priority *struct {
			Name string `json:"name"`
		} `json:"priority"`
		Updated     string          `json:"updated"`
		Description json.RawMessage `json:"description"`
		Project     struct {
			Key string `json:"key"`
		} `json:"project"`
		Parent *struct {
			Key    string `json:"key"`
			Fields struct {
				Summary string `json:"summary"`
			} `json:"fields"`
		} `json:"parent"`
	} `json:"fields"`
}

func (i Issue) Summary() string { return i.Fields.Summary }
func (i Issue) Status() string  { return i.Fields.Status.Name }

// DescriptionText flattens the Atlassian Document Format description to plain text.
func (i Issue) DescriptionText() string {
	if len(i.Fields.Description) == 0 || string(i.Fields.Description) == "null" {
		return ""
	}
	var doc adfNode
	if err := json.Unmarshal(i.Fields.Description, &doc); err != nil {
		return ""
	}
	var b strings.Builder
	adfText(doc, &b)
	return strings.TrimSpace(b.String())
}

type adfNode struct {
	Type    string    `json:"type"`
	Text    string    `json:"text"`
	Content []adfNode `json:"content"`
}

func adfText(n adfNode, b *strings.Builder) {
	if n.Text != "" {
		b.WriteString(n.Text)
	}
	for _, c := range n.Content {
		adfText(c, b)
	}
	switch n.Type {
	case "paragraph", "heading", "listItem", "codeBlock":
		b.WriteString("\n")
	}
}

type Transition struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	To   struct {
		Name string `json:"name"`
	} `json:"to"`
}

// --- plumbing ---

func (c *Client) do(ctx context.Context, method, path string, body any, out any) error {
	var rdr io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return err
		}
		rdr = bytes.NewReader(b)
	}
	req, err := http.NewRequestWithContext(ctx, method, c.base+path, rdr)
	if err != nil {
		return err
	}
	req.SetBasicAuth(c.email, c.token)
	req.Header.Set("Accept", "application/json")
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	data, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return apiError(resp.StatusCode, data)
	}
	if out == nil || len(data) == 0 {
		return nil
	}
	return json.Unmarshal(data, out)
}

func apiError(code int, data []byte) error {
	var e struct {
		ErrorMessages []string `json:"errorMessages"`
	}
	_ = json.Unmarshal(data, &e)
	if len(e.ErrorMessages) > 0 {
		return fmt.Errorf("jira %d: %s", code, strings.Join(e.ErrorMessages, "; "))
	}
	return fmt.Errorf("jira %d", code)
}

// --- reads ---

const issueFields = "summary,status,assignee,issuetype,priority,updated,description,project,parent"

// ProjectKey returns the project key of an issue, falling back to the prefix of
// its key when the project field was not requested.
func (i Issue) ProjectKey() string {
	if i.Fields.Project.Key != "" {
		return i.Fields.Project.Key
	}
	return ProjectOf(i.Key)
}

// ParentKey returns the key of the issue this one hangs under, or "".
func (i Issue) ParentKey() string {
	if i.Fields.Parent == nil {
		return ""
	}
	return i.Fields.Parent.Key
}

// ProjectOf extracts the project key from an issue key ("DCR-42" -> "DCR").
func ProjectOf(key string) string {
	if i := strings.LastIndex(key, "-"); i > 0 {
		return key[:i]
	}
	return key
}

// MyIssues returns the current user's unresolved issues, newest first. When
// project is non-empty the search is scoped to that project key.
func (c *Client) MyIssues(ctx context.Context, project string) ([]Issue, error) {
	jql := "assignee = currentUser() AND resolution = unresolved"
	if project != "" {
		jql = fmt.Sprintf("project = %q AND %s", project, jql)
	}
	return c.Search(ctx, jql+" ORDER BY updated DESC", 50)
}

// Search runs a JQL query and returns the matching issues.
func (c *Client) Search(ctx context.Context, jql string, limit int) ([]Issue, error) {
	body := map[string]any{
		"jql":        jql,
		"fields":     strings.Split(issueFields, ","),
		"maxResults": limit,
	}
	var r struct {
		Issues []Issue `json:"issues"`
	}
	err := c.do(ctx, http.MethodPost, "/rest/api/3/search/jql", body, &r)
	return r.Issues, err
}

// Children returns the issues whose parent is key — subtasks of a standard
// issue, or the child issues of an epic.
func (c *Client) Children(ctx context.Context, key string) ([]Issue, error) {
	return c.Search(ctx, fmt.Sprintf("parent = %q ORDER BY created ASC", key), 100)
}

// IssueType is one issue type available in a project.
type IssueType struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	Subtask bool   `json:"subtask"`
}

// IssueTypes lists the issue types configured for a project.
func (c *Client) IssueTypes(ctx context.Context, project string) ([]IssueType, error) {
	var r struct {
		IssueTypes []IssueType `json:"issueTypes"`
	}
	err := c.do(ctx, http.MethodGet, "/rest/api/3/project/"+project, nil, &r)
	return r.IssueTypes, err
}

// SubtaskType returns the project's subtask issue type.
func (c *Client) SubtaskType(ctx context.Context, project string) (IssueType, error) {
	types, err := c.IssueTypes(ctx, project)
	if err != nil {
		return IssueType{}, err
	}
	for _, t := range types {
		if t.Subtask {
			return t, nil
		}
	}
	return IssueType{}, fmt.Errorf("project %s has no subtask issue type", project)
}

// Myself returns the display name of the authenticated user, or an error if
// the credentials are not valid for this Jira site.
func (c *Client) Myself(ctx context.Context) (string, error) {
	var r struct {
		DisplayName string `json:"displayName"`
	}
	if err := c.do(ctx, http.MethodGet, "/rest/api/3/myself", nil, &r); err != nil {
		return "", err
	}
	return r.DisplayName, nil
}

func (c *Client) Issue(ctx context.Context, key string) (*Issue, error) {
	var i Issue
	err := c.do(ctx, http.MethodGet, "/rest/api/3/issue/"+key+"?fields="+issueFields, nil, &i)
	return &i, err
}

func (c *Client) Transitions(ctx context.Context, key string) ([]Transition, error) {
	var r struct {
		Transitions []Transition `json:"transitions"`
	}
	err := c.do(ctx, http.MethodGet, "/rest/api/3/issue/"+key+"/transitions", nil, &r)
	return r.Transitions, err
}

// --- actions ---

func (c *Client) Transition(ctx context.Context, key, transitionID string) error {
	body := map[string]any{"transition": map[string]string{"id": transitionID}}
	return c.do(ctx, http.MethodPost, "/rest/api/3/issue/"+key+"/transitions", body, nil)
}

func (c *Client) AddComment(ctx context.Context, key, text string) error {
	body := map[string]any{"body": adfDoc(text)}
	return c.do(ctx, http.MethodPost, "/rest/api/3/issue/"+key+"/comment", body, nil)
}

// adfDoc wraps plain text (newline-separated) in an Atlassian Document Format
// document, the only body format the v3 API accepts.
func adfDoc(text string) map[string]any {
	var content []any
	for _, line := range strings.Split(text, "\n") {
		p := map[string]any{"type": "paragraph"}
		if line != "" {
			p["content"] = []any{map[string]string{"type": "text", "text": line}}
		}
		content = append(content, p)
	}
	return map[string]any{"type": "doc", "version": 1, "content": content}
}

// NewIssue describes an issue to create. Parent set makes it a subtask (or an
// epic's child); TypeID and TypeName are alternative ways to pick the type and
// may both be empty, in which case the project's default is used.
type NewIssue struct {
	Project     string
	Summary     string
	Description string
	TypeID      string
	TypeName    string
	Parent      string
}

// Create files a new issue and returns its key. Issues created without a sprint
// land in the project's backlog.
func (c *Client) Create(ctx context.Context, n NewIssue) (string, error) {
	if n.Project == "" {
		return "", fmt.Errorf("no Jira project — set jira_project in the bpr config")
	}
	if n.Summary == "" {
		return "", fmt.Errorf("a summary is required")
	}
	fields := map[string]any{
		"project": map[string]string{"key": n.Project},
		"summary": n.Summary,
	}
	switch {
	case n.TypeID != "":
		fields["issuetype"] = map[string]string{"id": n.TypeID}
	case n.TypeName != "":
		fields["issuetype"] = map[string]string{"name": n.TypeName}
	default:
		t, err := c.defaultType(ctx, n.Project)
		if err != nil {
			return "", err
		}
		fields["issuetype"] = map[string]string{"id": t.ID}
	}
	if n.Description != "" {
		fields["description"] = adfDoc(n.Description)
	}
	if n.Parent != "" {
		fields["parent"] = map[string]string{"key": n.Parent}
	}
	var r struct {
		Key string `json:"key"`
	}
	if err := c.do(ctx, http.MethodPost, "/rest/api/3/issue", map[string]any{"fields": fields}, &r); err != nil {
		return "", err
	}
	return r.Key, nil
}

// CreateSubtask files a subtask under parent, resolving the project and the
// subtask issue type from the parent issue.
func (c *Client) CreateSubtask(ctx context.Context, parent, summary, description string) (string, error) {
	p, err := c.Issue(ctx, parent)
	if err != nil {
		return "", err
	}
	project := p.ProjectKey()
	t, err := c.SubtaskType(ctx, project)
	if err != nil {
		return "", err
	}
	return c.Create(ctx, NewIssue{
		Project:     project,
		Summary:     summary,
		Description: description,
		TypeID:      t.ID,
		Parent:      p.Key,
	})
}

// defaultType picks the first non-subtask type of a project, preferring Task.
func (c *Client) defaultType(ctx context.Context, project string) (IssueType, error) {
	types, err := c.IssueTypes(ctx, project)
	if err != nil {
		return IssueType{}, err
	}
	var first IssueType
	for _, t := range types {
		if t.Subtask {
			continue
		}
		if strings.EqualFold(t.Name, "Task") {
			return t, nil
		}
		if first.ID == "" {
			first = t
		}
	}
	if first.ID == "" {
		return IssueType{}, fmt.Errorf("project %s has no usable issue type", project)
	}
	return first, nil
}

// Delete removes an issue permanently. Subtasks of the issue go with it.
func (c *Client) Delete(ctx context.Context, key string) error {
	return c.do(ctx, http.MethodDelete, "/rest/api/3/issue/"+key+"?deleteSubtasks=true", nil, nil)
}

// BrowseURL returns the human-facing URL for an issue key.
func (c *Client) BrowseURL(key string) string {
	return c.base + "/browse/" + key
}
