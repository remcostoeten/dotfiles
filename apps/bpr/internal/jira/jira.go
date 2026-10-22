// Package jira is a minimal Jira Cloud REST API v3 + Agile API client for the
// operations bpr needs: searching, viewing, creating, editing, re-parenting,
// transitioning and deleting issues, plus boards and sprints. Requests go over
// plain HTTPS with an API token, or through `twg api` when built with NewTWG.
package jira

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

type Client struct {
	base    string
	email   string
	token   string
	http    *http.Client
	twgSite string
}

func New(site, email, token string) *Client {
	return &Client{
		base:  strings.TrimSuffix(site, "/"),
		email: email,
		token: token,
		http:  &http.Client{Timeout: 30 * time.Second},
	}
}

const (
	fieldDevelopment = "customfield_10000"
	fieldSprint      = "customfield_10020"
)

// --- models ---

type User struct {
	AccountID   string `json:"accountId"`
	DisplayName string `json:"displayName"`
}

type Issue struct {
	Key    string `json:"key"`
	Fields struct {
		Summary string `json:"summary"`
		Status  struct {
			ID       string `json:"id"`
			Name     string `json:"name"`
			Category struct {
				Key string `json:"key"`
			} `json:"statusCategory"`
		} `json:"status"`
		Assignee  *User `json:"assignee"`
		IssueType struct {
			ID      string `json:"id"`
			Name    string `json:"name"`
			Subtask bool   `json:"subtask"`
		} `json:"issuetype"`
		Priority *struct {
			Name string `json:"name"`
		} `json:"priority"`
		Labels      []string        `json:"labels"`
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
		Subtasks []struct {
			Key string `json:"key"`
		} `json:"subtasks"`
		Development string   `json:"customfield_10000"`
		Sprints     []Sprint `json:"customfield_10020"`
	} `json:"fields"`
}

func (i Issue) Summary() string { return i.Fields.Summary }
func (i Issue) Status() string  { return i.Fields.Status.Name }

// AssigneeName returns the assignee's display name, or "" when unassigned.
func (i Issue) AssigneeName() string {
	if i.Fields.Assignee == nil {
		return ""
	}
	return i.Fields.Assignee.DisplayName
}

// IsEpic reports whether the issue is an epic.
func (i Issue) IsEpic() bool { return strings.EqualFold(i.Fields.IssueType.Name, "Epic") }

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
	switch n.Type {
	case "hardBreak":
		b.WriteString("\n")
	case "listItem":
		b.WriteString("- ")
	}
	for _, c := range n.Content {
		adfText(c, b)
	}
	switch n.Type {
	case "paragraph", "heading", "codeBlock":
		b.WriteString("\n")
	}
}

// DevInfo summarises the Bitbucket / CI activity linked to an issue.
type DevInfo struct {
	PRs         int
	PRState     string
	Deployments int
	Environment string
}

func (d DevInfo) HasPR() bool         { return d.PRs > 0 }
func (d DevInfo) Merged() bool        { return d.PRState == "MERGED" }
func (d DevInfo) HasDeployment() bool { return d.Deployments > 0 }

// Dev parses the Development field, a Java map string whose last entry is
// json={...} holding the cached summary.
func (i Issue) Dev() DevInfo {
	s := i.Fields.Development
	at := strings.Index(s, "json=")
	if at < 0 || !strings.HasSuffix(s, "}") {
		return DevInfo{}
	}
	var r struct {
		CachedValue struct {
			Summary struct {
				PullRequest struct {
					Overall struct {
						Count int    `json:"count"`
						State string `json:"state"`
					} `json:"overall"`
				} `json:"pullrequest"`
				Deployment struct {
					Overall struct {
						Count           int `json:"count"`
						TopEnvironments []struct {
							Title  string `json:"title"`
							Status string `json:"status"`
						} `json:"topEnvironments"`
					} `json:"overall"`
				} `json:"deployment-environment"`
			} `json:"summary"`
		} `json:"cachedValue"`
	}
	if err := json.Unmarshal([]byte(s[at+len("json="):len(s)-1]), &r); err != nil {
		return DevInfo{}
	}
	sum := r.CachedValue.Summary
	d := DevInfo{
		PRs:         sum.PullRequest.Overall.Count,
		PRState:     sum.PullRequest.Overall.State,
		Deployments: sum.Deployment.Overall.Count,
	}
	if envs := sum.Deployment.Overall.TopEnvironments; len(envs) > 0 {
		d.Environment = envs[0].Title
	}
	return d
}

// ActiveSprint returns the issue's open sprint, if any.
func (i Issue) ActiveSprint() *Sprint {
	for k := range i.Fields.Sprints {
		if i.Fields.Sprints[k].State != "closed" {
			return &i.Fields.Sprints[k]
		}
	}
	return nil
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
	if c.twgSite != "" {
		return c.twgDo(ctx, method, path, body, out)
	}
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
		ErrorMessages []string          `json:"errorMessages"`
		Errors        map[string]string `json:"errors"`
		Message       string            `json:"message"`
	}
	_ = json.Unmarshal(data, &e)
	msgs := e.ErrorMessages
	for field, msg := range e.Errors {
		msgs = append(msgs, field+": "+msg)
	}
	if e.Message != "" {
		msgs = append(msgs, e.Message)
	}
	prefix := "jira"
	if code != 0 {
		prefix = fmt.Sprintf("jira %d", code)
	}
	if len(msgs) > 0 {
		return fmt.Errorf("%s: %s", prefix, strings.Join(msgs, "; "))
	}
	return fmt.Errorf("%s: %s", prefix, strings.TrimSpace(string(data)))
}

// --- reads ---

var issueFields = []string{
	"summary", "status", "assignee", "issuetype", "priority", "labels", "updated",
	"description", "project", "parent", "subtasks", fieldDevelopment, fieldSprint,
}

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

// ParentSummary returns the summary of the parent issue, or "".
func (i Issue) ParentSummary() string {
	if i.Fields.Parent == nil {
		return ""
	}
	return i.Fields.Parent.Fields.Summary
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

// Search runs a JQL query and returns up to limit matching issues, following
// the token-based pagination of /search/jql.
func (c *Client) Search(ctx context.Context, jql string, limit int) ([]Issue, error) {
	var all []Issue
	token := ""
	for len(all) < limit {
		body := map[string]any{
			"jql":        jql,
			"fields":     issueFields,
			"maxResults": min(limit-len(all), 100),
		}
		if token != "" {
			body["nextPageToken"] = token
		}
		var r struct {
			Issues        []Issue `json:"issues"`
			NextPageToken string  `json:"nextPageToken"`
			IsLast        bool    `json:"isLast"`
		}
		if err := c.do(ctx, http.MethodPost, "/rest/api/3/search/jql", body, &r); err != nil {
			return all, err
		}
		all = append(all, r.Issues...)
		if r.IsLast || r.NextPageToken == "" || len(r.Issues) == 0 {
			break
		}
		token = r.NextPageToken
	}
	return all, nil
}

// Children returns the issues whose parent is key: subtasks of a standard
// issue, or the child issues of an epic.
func (c *Client) Children(ctx context.Context, key string) ([]Issue, error) {
	return c.Search(ctx, fmt.Sprintf("parent = %q ORDER BY created ASC", key), 100)
}

// IssueType is one issue type available in a project.
type IssueType struct {
	ID             string `json:"id"`
	Name           string `json:"name"`
	Subtask        bool   `json:"subtask"`
	HierarchyLevel int    `json:"hierarchyLevel"`
}

// IssueTypes lists the issue types configured for a project.
func (c *Client) IssueTypes(ctx context.Context, project string) ([]IssueType, error) {
	var r struct {
		IssueTypes []IssueType `json:"issueTypes"`
	}
	err := c.do(ctx, http.MethodGet, "/rest/api/3/project/"+url.PathEscape(project), nil, &r)
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

// EpicType returns the project's epic issue type.
func (c *Client) EpicType(ctx context.Context, project string) (IssueType, error) {
	types, err := c.IssueTypes(ctx, project)
	if err != nil {
		return IssueType{}, err
	}
	for _, t := range types {
		if strings.EqualFold(t.Name, "Epic") || t.HierarchyLevel == 1 {
			return t, nil
		}
	}
	return IssueType{}, fmt.Errorf("project %s has no epic issue type", project)
}

// Myself returns the display name of the authenticated user, or an error if
// the credentials are not valid for this Jira site.
func (c *Client) Myself(ctx context.Context) (string, error) {
	var r User
	if err := c.do(ctx, http.MethodGet, "/rest/api/3/myself", nil, &r); err != nil {
		return "", err
	}
	return r.DisplayName, nil
}

// MyAccountID returns the account id of the authenticated user.
func (c *Client) MyAccountID(ctx context.Context) (string, error) {
	var r User
	err := c.do(ctx, http.MethodGet, "/rest/api/3/myself", nil, &r)
	return r.AccountID, err
}

func (c *Client) Issue(ctx context.Context, key string) (*Issue, error) {
	var i Issue
	path := "/rest/api/3/issue/" + url.PathEscape(key) + "?fields=" + strings.Join(issueFields, ",")
	err := c.do(ctx, http.MethodGet, path, nil, &i)
	return &i, err
}

func (c *Client) Transitions(ctx context.Context, key string) ([]Transition, error) {
	var r struct {
		Transitions []Transition `json:"transitions"`
	}
	err := c.do(ctx, http.MethodGet, "/rest/api/3/issue/"+url.PathEscape(key)+"/transitions", nil, &r)
	return r.Transitions, err
}

// AssignableUsers lists the users who can be assigned issues in a project.
func (c *Client) AssignableUsers(ctx context.Context, project string) ([]User, error) {
	var r []User
	err := c.do(ctx, http.MethodGet, "/rest/api/3/user/assignable/search?maxResults=200&project="+url.QueryEscape(project), nil, &r)
	return r, err
}

// --- actions ---

func (c *Client) Transition(ctx context.Context, key, transitionID string) error {
	body := map[string]any{"transition": map[string]string{"id": transitionID}}
	return c.do(ctx, http.MethodPost, "/rest/api/3/issue/"+url.PathEscape(key)+"/transitions", body, nil)
}

// TransitionTo moves an issue to the status (or transition) with the given name.
func (c *Client) TransitionTo(ctx context.Context, key, status string) error {
	ts, err := c.Transitions(ctx, key)
	if err != nil {
		return err
	}
	for _, t := range ts {
		if strings.EqualFold(t.To.Name, status) || strings.EqualFold(t.Name, status) {
			return c.Transition(ctx, key, t.ID)
		}
	}
	return fmt.Errorf("no transition to %q on %s", status, key)
}

func (c *Client) AddComment(ctx context.Context, key, text string) error {
	body := map[string]any{"body": adfDoc(text)}
	return c.do(ctx, http.MethodPost, "/rest/api/3/issue/"+url.PathEscape(key)+"/comment", body, nil)
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
	RawDesc     json.RawMessage
	TypeID      string
	TypeName    string
	Parent      string
	Labels      []string
	PriorityID  string
	AssigneeID  string
}

// Create files a new issue and returns its key. Issues created without a sprint
// land in the project's backlog.
func (c *Client) Create(ctx context.Context, n NewIssue) (string, error) {
	if n.Project == "" {
		return "", fmt.Errorf("no Jira project, set jira_project in the bpr config")
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
	switch {
	case len(n.RawDesc) > 0 && string(n.RawDesc) != "null":
		fields["description"] = n.RawDesc
	case n.Description != "":
		fields["description"] = adfDoc(n.Description)
	}
	if len(n.Labels) > 0 {
		fields["labels"] = n.Labels
	}
	if n.PriorityID != "" {
		fields["priority"] = map[string]string{"id": n.PriorityID}
	}
	if n.AssigneeID != "" {
		fields["assignee"] = map[string]string{"id": n.AssigneeID}
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

func (c *Client) defaultType(ctx context.Context, project string) (IssueType, error) {
	types, err := c.IssueTypes(ctx, project)
	if err != nil {
		return IssueType{}, err
	}
	var first IssueType
	for _, t := range types {
		if t.Subtask || t.HierarchyLevel > 0 {
			continue
		}
		if strings.EqualFold(t.Name, "Task") || strings.EqualFold(t.Name, "Taak") {
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

// IssueUpdate lists the fields to change. A nil pointer leaves the field
// alone; AssigneeID set to "" unassigns.
type IssueUpdate struct {
	Summary     *string
	Description *string
	AssigneeID  *string
	Labels      *[]string
	Parent      *string
	TypeID      *string
}

// Update edits the fields of an issue.
func (c *Client) Update(ctx context.Context, key string, u IssueUpdate) error {
	fields := map[string]any{}
	if u.Summary != nil {
		fields["summary"] = *u.Summary
	}
	if u.Description != nil {
		fields["description"] = adfDoc(*u.Description)
	}
	if u.AssigneeID != nil {
		if *u.AssigneeID == "" {
			fields["assignee"] = nil
		} else {
			fields["assignee"] = map[string]string{"id": *u.AssigneeID}
		}
	}
	if u.Labels != nil {
		fields["labels"] = *u.Labels
	}
	if u.Parent != nil {
		if *u.Parent == "" {
			fields["parent"] = map[string]any{"none": true}
		} else {
			fields["parent"] = map[string]string{"key": *u.Parent}
		}
	}
	if u.TypeID != nil {
		fields["issuetype"] = map[string]string{"id": *u.TypeID}
	}
	if len(fields) == 0 {
		return nil
	}
	return c.do(ctx, http.MethodPut, "/rest/api/3/issue/"+url.PathEscape(key), map[string]any{"fields": fields}, nil)
}

// Delete removes an issue permanently. Subtasks of the issue go with it.
func (c *Client) Delete(ctx context.Context, key string) error {
	return c.do(ctx, http.MethodDelete, "/rest/api/3/issue/"+url.PathEscape(key)+"?deleteSubtasks=true", nil, nil)
}

// BrowseURL returns the human-facing URL for an issue key.
func (c *Client) BrowseURL(key string) string {
	return c.base + "/browse/" + key
}

// --- boards, sprints and metadata ---

type Project struct {
	ID   string `json:"id"`
	Key  string `json:"key"`
	Name string `json:"name"`
}

type Board struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
	Type string `json:"type"`
}

type Sprint struct {
	ID    int    `json:"id"`
	Name  string `json:"name"`
	State string `json:"state"`
}

type Priority struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

// Column is one board lane and the status ids that land in it.
type Column struct {
	Name      string
	StatusIDs []string
}

// Projects lists every project the user can see, sorted by name.
func (c *Client) Projects(ctx context.Context) ([]Project, error) {
	var all []Project
	for start := 0; ; {
		var r struct {
			Values []Project `json:"values"`
			IsLast bool      `json:"isLast"`
		}
		path := fmt.Sprintf("/rest/api/3/project/search?orderBy=name&maxResults=100&startAt=%d", start)
		if err := c.do(ctx, http.MethodGet, path, nil, &r); err != nil {
			return all, err
		}
		all = append(all, r.Values...)
		if r.IsLast || len(r.Values) == 0 {
			return all, nil
		}
		start += len(r.Values)
	}
}

// Boards lists the agile boards of a project.
func (c *Client) Boards(ctx context.Context, project string) ([]Board, error) {
	var r struct {
		Values []Board `json:"values"`
	}
	err := c.do(ctx, http.MethodGet, "/rest/agile/1.0/board?maxResults=100&projectKeyOrId="+url.QueryEscape(project), nil, &r)
	return r.Values, err
}

// Columns returns the lanes of a board in display order.
func (c *Client) Columns(ctx context.Context, board int) ([]Column, error) {
	var r struct {
		ColumnConfig struct {
			Columns []struct {
				Name     string `json:"name"`
				Statuses []struct {
					ID string `json:"id"`
				} `json:"statuses"`
			} `json:"columns"`
		} `json:"columnConfig"`
	}
	if err := c.do(ctx, http.MethodGet, fmt.Sprintf("/rest/agile/1.0/board/%d/configuration", board), nil, &r); err != nil {
		return nil, err
	}
	cols := make([]Column, len(r.ColumnConfig.Columns))
	for i, col := range r.ColumnConfig.Columns {
		cols[i].Name = col.Name
		for _, s := range col.Statuses {
			cols[i].StatusIDs = append(cols[i].StatusIDs, s.ID)
		}
	}
	return cols, nil
}

// Sprints lists the active and future sprints of a board.
func (c *Client) Sprints(ctx context.Context, board int) ([]Sprint, error) {
	var r struct {
		Values []Sprint `json:"values"`
	}
	err := c.do(ctx, http.MethodGet, fmt.Sprintf("/rest/agile/1.0/board/%d/sprint?state=active,future&maxResults=50", board), nil, &r)
	return r.Values, err
}

// MoveToSprint puts issues into a sprint.
func (c *Client) MoveToSprint(ctx context.Context, sprint int, keys ...string) error {
	body := map[string]any{"issues": keys}
	return c.do(ctx, http.MethodPost, fmt.Sprintf("/rest/agile/1.0/sprint/%d/issue", sprint), body, nil)
}

// MoveToBacklog takes issues out of their sprint.
func (c *Client) MoveToBacklog(ctx context.Context, keys ...string) error {
	body := map[string]any{"issues": keys}
	return c.do(ctx, http.MethodPost, "/rest/agile/1.0/backlog/issue", body, nil)
}

// Labels lists every label in use on the site.
func (c *Client) Labels(ctx context.Context) ([]string, error) {
	var all []string
	for start := 0; ; {
		var r struct {
			Values []string `json:"values"`
			IsLast bool     `json:"isLast"`
		}
		if err := c.do(ctx, http.MethodGet, fmt.Sprintf("/rest/api/3/label?maxResults=1000&startAt=%d", start), nil, &r); err != nil {
			return all, err
		}
		all = append(all, r.Values...)
		if r.IsLast || len(r.Values) == 0 {
			return all, nil
		}
		start += len(r.Values)
	}
}

// Priorities lists the site's issue priorities, highest first.
func (c *Client) Priorities(ctx context.Context) ([]Priority, error) {
	var r []Priority
	err := c.do(ctx, http.MethodGet, "/rest/api/3/priority", nil, &r)
	return r, err
}

// Statuses lists the workflow statuses an issue type can be in within a project.
func (c *Client) Statuses(ctx context.Context, project, issueType string) ([]string, error) {
	var r []struct {
		Name     string `json:"name"`
		Statuses []struct {
			Name string `json:"name"`
		} `json:"statuses"`
	}
	if err := c.do(ctx, http.MethodGet, "/rest/api/3/project/"+url.PathEscape(project)+"/statuses", nil, &r); err != nil {
		return nil, err
	}
	for _, t := range r {
		if strings.EqualFold(t.Name, issueType) {
			names := make([]string, len(t.Statuses))
			for i, st := range t.Statuses {
				names[i] = st.Name
			}
			return names, nil
		}
	}
	return nil, fmt.Errorf("no statuses for %s in %s", issueType, project)
}
