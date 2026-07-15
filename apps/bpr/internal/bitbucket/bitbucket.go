// Package bitbucket is a thin Bitbucket Cloud REST API v2 client scoped to the
// operations gpr needs: listing pull requests, their approvals and CI status,
// and acting on them (approve, merge, decline, comment, create).
package bitbucket

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"
)

const baseURL = "https://api.bitbucket.org/2.0"

type Client struct {
	email string
	token string
	http  *http.Client
}

func New(email, token string) *Client {
	return &Client{
		email: email,
		token: token,
		http:  &http.Client{Timeout: 30 * time.Second},
	}
}

// --- models ---

type User struct {
	UUID        string `json:"uuid"`
	DisplayName string `json:"display_name"`
	Nickname    string `json:"nickname"`
	Username    string `json:"username"`
}

type Participant struct {
	Approved bool   `json:"approved"`
	State    string `json:"state"` // approved / changes_requested / null
	Role     string `json:"role"`  // REVIEWER / PARTICIPANT
	User     User   `json:"user"`
}

type PR struct {
	ID          int    `json:"id"`
	Title       string `json:"title"`
	Description string `json:"description"`
	State       string `json:"state"`
	Author      User   `json:"author"`
	Source      struct {
		Branch struct {
			Name string `json:"name"`
		} `json:"branch"`
		Commit struct {
			Hash string `json:"hash"`
		} `json:"commit"`
	} `json:"source"`
	Destination struct {
		Branch struct {
			Name string `json:"name"`
		} `json:"branch"`
	} `json:"destination"`
	Links struct {
		HTML struct {
			Href string `json:"href"`
		} `json:"html"`
	} `json:"links"`
	Participants []Participant `json:"participants"`
	CreatedOn    time.Time     `json:"created_on"`
	UpdatedOn    time.Time     `json:"updated_on"`
	CommentCount int           `json:"comment_count"`
}

// Approvals counts participants who have approved.
func (p PR) Approvals() int {
	n := 0
	for _, part := range p.Participants {
		if part.Approved {
			n++
		}
	}
	return n
}

type Comment struct {
	ID      int `json:"id"`
	Content struct {
		Raw string `json:"raw"`
	} `json:"content"`
	User      User      `json:"user"`
	CreatedOn time.Time `json:"created_on"`
	Deleted   bool      `json:"deleted"`
	Inline    *struct {
		Path string `json:"path"`
	} `json:"inline"`
}

type Status struct {
	Key   string `json:"key"`
	Name  string `json:"name"`
	State string `json:"state"` // SUCCESSFUL / FAILED / INPROGRESS / STOPPED
	URL   string `json:"url"`
}

// --- request plumbing ---

func (c *Client) do(ctx context.Context, method, path string, body any, out any) error {
	var rdr io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return err
		}
		rdr = bytes.NewReader(b)
	}
	req, err := http.NewRequestWithContext(ctx, method, baseURL+path, rdr)
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
		Error struct {
			Message string `json:"message"`
		} `json:"error"`
	}
	_ = json.Unmarshal(data, &e)
	if e.Error.Message != "" {
		return fmt.Errorf("bitbucket %d: %s", code, e.Error.Message)
	}
	return fmt.Errorf("bitbucket %d", code)
}

// paged follows Bitbucket's `next` links, collecting every page's values.
func paged[T any](c *Client, ctx context.Context, path string) ([]T, error) {
	type page struct {
		Values []T    `json:"values"`
		Next   string `json:"next"`
	}
	var all []T
	next := baseURL + path
	for next != "" {
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, next, nil)
		if err != nil {
			return nil, err
		}
		req.SetBasicAuth(c.email, c.token)
		req.Header.Set("Accept", "application/json")
		resp, err := c.http.Do(req)
		if err != nil {
			return nil, err
		}
		data, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		if resp.StatusCode >= 400 {
			return nil, apiError(resp.StatusCode, data)
		}
		var pg page
		if err := json.Unmarshal(data, &pg); err != nil {
			return nil, err
		}
		all = append(all, pg.Values...)
		next = pg.Next
	}
	return all, nil
}

// --- reads ---

func (c *Client) CurrentUser(ctx context.Context) (User, error) {
	var u User
	err := c.do(ctx, http.MethodGet, "/user?fields=uuid,display_name,nickname,username", nil, &u)
	return u, err
}

const prFields = "fields=values.id,values.title,values.description,values.state,values.author.display_name,values.author.uuid,values.source.branch.name,values.source.commit.hash,values.destination.branch.name,values.links.html.href,values.participants.approved,values.participants.state,values.participants.role,values.participants.user.display_name,values.participants.user.uuid,values.comment_count,values.created_on,values.updated_on,next"

func (c *Client) ListOpenPRs(ctx context.Context, slug string) ([]PR, error) {
	return paged[PR](c, ctx, fmt.Sprintf("/repositories/%s/pullrequests?state=OPEN&pagelen=50&%s", slug, prFields))
}

// PRForBranch returns the open PR whose source branch matches, or nil.
func (c *Client) PRForBranch(ctx context.Context, slug, branch string) (*PR, error) {
	q := url.QueryEscape(fmt.Sprintf(`source.branch.name="%s" AND state="OPEN"`, branch))
	prs, err := paged[PR](c, ctx, fmt.Sprintf("/repositories/%s/pullrequests?q=%s&%s", slug, q, prFields))
	if err != nil {
		return nil, err
	}
	if len(prs) == 0 {
		return nil, nil
	}
	return &prs[0], nil
}

func (c *Client) PR(ctx context.Context, slug string, id int) (*PR, error) {
	var p PR
	err := c.do(ctx, http.MethodGet, fmt.Sprintf("/repositories/%s/pullrequests/%d", slug, id), nil, &p)
	return &p, err
}

func (c *Client) Comments(ctx context.Context, slug string, id int) ([]Comment, error) {
	cs, err := paged[Comment](c, ctx, fmt.Sprintf("/repositories/%s/pullrequests/%d/comments?pagelen=50", slug, id))
	if err != nil {
		return nil, err
	}
	out := cs[:0]
	for _, cm := range cs {
		if !cm.Deleted {
			out = append(out, cm)
		}
	}
	return out, nil
}

func (c *Client) Statuses(ctx context.Context, slug, sha string) ([]Status, error) {
	if sha == "" {
		return nil, nil
	}
	return paged[Status](c, ctx, fmt.Sprintf("/repositories/%s/commit/%s/statuses?pagelen=50", slug, sha))
}

// MainBranch returns the repository's configured main branch name.
func (c *Client) MainBranch(ctx context.Context, slug string) (string, error) {
	var r struct {
		MainBranch struct {
			Name string `json:"name"`
		} `json:"mainbranch"`
	}
	err := c.do(ctx, http.MethodGet, "/repositories/"+slug, nil, &r)
	return r.MainBranch.Name, err
}

// --- actions ---

func (c *Client) Approve(ctx context.Context, slug string, id int) error {
	return c.do(ctx, http.MethodPost, fmt.Sprintf("/repositories/%s/pullrequests/%d/approve", slug, id), nil, nil)
}

func (c *Client) Unapprove(ctx context.Context, slug string, id int) error {
	return c.do(ctx, http.MethodDelete, fmt.Sprintf("/repositories/%s/pullrequests/%d/approve", slug, id), nil, nil)
}

func (c *Client) RequestChanges(ctx context.Context, slug string, id int) error {
	return c.do(ctx, http.MethodPost, fmt.Sprintf("/repositories/%s/pullrequests/%d/request-changes", slug, id), nil, nil)
}

func (c *Client) Decline(ctx context.Context, slug string, id int) error {
	return c.do(ctx, http.MethodPost, fmt.Sprintf("/repositories/%s/pullrequests/%d/decline", slug, id), nil, nil)
}

type MergeOptions struct {
	Message           string `json:"message,omitempty"`
	MergeStrategy     string `json:"merge_strategy,omitempty"` // merge_commit / squash / fast_forward
	CloseSourceBranch bool   `json:"close_source_branch"`
}

func (c *Client) Merge(ctx context.Context, slug string, id int, opts MergeOptions) error {
	return c.do(ctx, http.MethodPost, fmt.Sprintf("/repositories/%s/pullrequests/%d/merge", slug, id), opts, nil)
}

func (c *Client) AddComment(ctx context.Context, slug string, id int, raw string) error {
	body := map[string]any{"content": map[string]string{"raw": raw}}
	return c.do(ctx, http.MethodPost, fmt.Sprintf("/repositories/%s/pullrequests/%d/comments", slug, id), body, nil)
}

// UpdatePR edits a pull request's title and/or description.
func (c *Client) UpdatePR(ctx context.Context, slug string, id int, title, description string) error {
	body := map[string]any{
		"title":       title,
		"description": description,
	}
	return c.do(ctx, http.MethodPut, fmt.Sprintf("/repositories/%s/pullrequests/%d", slug, id), body, nil)
}

type CreateOptions struct {
	Title             string
	Source            string
	Destination       string
	Description       string
	ReviewerUUIDs     []string
	CloseSourceBranch bool
}

func (c *Client) Create(ctx context.Context, slug string, o CreateOptions) (*PR, error) {
	reviewers := make([]map[string]string, 0, len(o.ReviewerUUIDs))
	for _, u := range o.ReviewerUUIDs {
		reviewers = append(reviewers, map[string]string{"uuid": u})
	}
	body := map[string]any{
		"title":               o.Title,
		"source":              map[string]any{"branch": map[string]string{"name": o.Source}},
		"destination":         map[string]any{"branch": map[string]string{"name": o.Destination}},
		"description":         o.Description,
		"reviewers":           reviewers,
		"close_source_branch": o.CloseSourceBranch,
	}
	var p PR
	err := c.do(ctx, http.MethodPost, "/repositories/"+slug+"/pullrequests", body, &p)
	return &p, err
}

// WorkspaceMembers lists members of a workspace (for reviewer selection).
func (c *Client) WorkspaceMembers(ctx context.Context, workspace string) ([]User, error) {
	type member struct {
		User User `json:"user"`
	}
	ms, err := paged[member](c, ctx, fmt.Sprintf("/workspaces/%s/members?pagelen=100", workspace))
	if err != nil {
		return nil, err
	}
	out := make([]User, 0, len(ms))
	for _, m := range ms {
		out = append(out, m.User)
	}
	return out, nil
}
