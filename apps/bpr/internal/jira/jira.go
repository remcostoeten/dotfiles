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

const issueFields = "summary,status,assignee,issuetype,priority,updated,description"

// MyIssues returns the current user's unresolved issues, newest first. When
// project is non-empty the search is scoped to that project key.
func (c *Client) MyIssues(ctx context.Context, project string) ([]Issue, error) {
	jql := "assignee = currentUser() AND resolution = unresolved"
	if project != "" {
		jql = fmt.Sprintf("project = %q AND %s", project, jql)
	}
	jql += " ORDER BY updated DESC"
	body := map[string]any{
		"jql":        jql,
		"fields":     strings.Split(issueFields, ","),
		"maxResults": 50,
	}
	var r struct {
		Issues []Issue `json:"issues"`
	}
	err := c.do(ctx, http.MethodPost, "/rest/api/3/search/jql", body, &r)
	return r.Issues, err
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
	body := map[string]any{
		"body": map[string]any{
			"type":    "doc",
			"version": 1,
			"content": []any{
				map[string]any{
					"type":    "paragraph",
					"content": []any{map[string]string{"type": "text", "text": text}},
				},
			},
		},
	}
	return c.do(ctx, http.MethodPost, "/rest/api/3/issue/"+key+"/comment", body, nil)
}

// BrowseURL returns the human-facing URL for an issue key.
func (c *Client) BrowseURL(key string) string {
	return c.base + "/browse/" + key
}
