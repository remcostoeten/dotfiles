package main

import (
	"context"
	"fmt"
	"sort"
	"strconv"
	"strings"

	"github.com/modelcontextprotocol/go-sdk/mcp"
)

type jiraGetInput struct {
	Keys []string `json:"keys" jsonschema:"Jira issue keys or IDs"`
	Full bool     `json:"full,omitempty" jsonschema:"fetch full fields, comments, and remote links"`
}

type jiraQueryInput struct {
	JQL    string `json:"jql" jsonschema:"explicit Jira JQL query"`
	Limit  int    `json:"limit,omitempty" jsonschema:"maximum number of results, up to 100"`
	Fields string `json:"fields,omitempty" jsonschema:"comma-separated Jira fields"`
}

type jiraFindUsersInput struct {
	Query string `json:"query" jsonschema:"full or partial name or email"`
	Limit int    `json:"limit,omitempty" jsonschema:"maximum number of users"`
}

type jiraIssueSpec struct {
	Summary           string   `json:"summary" jsonschema:"issue summary"`
	Description       string   `json:"description_markdown,omitempty" jsonschema:"issue description in Markdown"`
	IssueType         string   `json:"issue_type,omitempty" jsonschema:"issue type name or ID"`
	Parent            string   `json:"parent,omitempty" jsonschema:"parent issue key"`
	Assignee          string   `json:"assignee,omitempty" jsonschema:"assignee account ID, me, none, or a display name"`
	Labels            []string `json:"labels,omitempty" jsonschema:"labels"`
	Priority          string   `json:"priority,omitempty" jsonschema:"priority name or ID"`
	OriginalEstimate  string   `json:"original_estimate,omitempty" jsonschema:"Jira duration such as 2h or 1d"`
	RemainingEstimate string   `json:"remaining_estimate,omitempty" jsonschema:"Jira duration such as 2h or 1d"`
	StoryPoints       *float64 `json:"story_points,omitempty" jsonschema:"story point estimate"`
	TimeSpent         string   `json:"time_spent,omitempty" jsonschema:"time to log after creation, such as 30m or 2h"`
}

type jiraCreateInput struct {
	Project string        `json:"project,omitempty" jsonschema:"Jira project key"`
	Issue   jiraIssueSpec `json:"issue" jsonschema:"issue to create"`
}

type jiraBulkCreateInput struct {
	Project string          `json:"project,omitempty" jsonschema:"Jira project key"`
	Items   []jiraIssueSpec `json:"items" jsonschema:"independent issues to create"`
	DryRun  bool            `json:"dry_run,omitempty" jsonschema:"return the plan without creating issues"`
}

type jiraTaskTreeInput struct {
	Project              string          `json:"project,omitempty" jsonschema:"Jira project key"`
	Root                 *jiraIssueSpec  `json:"root,omitempty" jsonschema:"root issue"`
	Subtasks             []jiraIssueSpec `json:"subtasks,omitempty" jsonschema:"direct subtasks of the root issue"`
	Markdown             string          `json:"markdown,omitempty" jsonschema:"optional Markdown document used to derive the root and subtasks"`
	ExpectedSubtaskCount *int            `json:"expected_subtask_count,omitempty" jsonschema:"fail before mutation when this count differs"`
	DryRun               bool            `json:"dry_run,omitempty" jsonschema:"return the plan without creating issues"`
}

type jiraUpdateInput struct {
	Key               string   `json:"key" jsonschema:"Jira issue key"`
	Summary           *string  `json:"summary,omitempty" jsonschema:"new summary"`
	Description       *string  `json:"description_markdown,omitempty" jsonschema:"new Markdown description"`
	Assignee          *string  `json:"assignee,omitempty" jsonschema:"assignee account ID, me, or none"`
	Labels            []string `json:"labels,omitempty" jsonschema:"replacement label list, including an empty list to clear labels"`
	AddLabels         []string `json:"add_labels,omitempty" jsonschema:"labels to add"`
	RemoveLabels      []string `json:"remove_labels,omitempty" jsonschema:"labels to remove"`
	Parent            *string  `json:"parent,omitempty" jsonschema:"parent issue key or none"`
	IssueType         *string  `json:"issue_type,omitempty" jsonschema:"new issue type"`
	Priority          *string  `json:"priority,omitempty" jsonschema:"new priority"`
	StoryPoints       *float64 `json:"story_points,omitempty" jsonschema:"new story point estimate"`
	DueDate           *string  `json:"due_date,omitempty" jsonschema:"YYYY-MM-DD or none"`
	OriginalEstimate  *string  `json:"original_estimate,omitempty" jsonschema:"Jira duration or none"`
	RemainingEstimate *string  `json:"remaining_estimate,omitempty" jsonschema:"Jira duration or none"`
	Status            string   `json:"status,omitempty" jsonschema:"target status or transition name"`
	Comment           string   `json:"comment_markdown,omitempty" jsonschema:"optional Markdown comment"`
	TimeSpent         string   `json:"time_spent,omitempty" jsonschema:"time to log after updating, such as 30m or 2h"`
	WorklogComment    string   `json:"worklog_comment_markdown,omitempty" jsonschema:"optional Markdown worklog comment"`
}

type jiraTransitionInput struct {
	Key     string `json:"key" jsonschema:"Jira issue key"`
	Status  string `json:"status" jsonschema:"target status or transition name"`
	Comment string `json:"comment_markdown,omitempty" jsonschema:"optional Markdown transition comment"`
}

type jiraDeleteInput struct {
	Key               string `json:"key" jsonschema:"Jira issue key"`
	DeleteSubtasks    bool   `json:"delete_subtasks,omitempty" jsonschema:"also delete child subtasks"`
	Confirm           bool   `json:"confirm,omitempty" jsonschema:"explicitly approve the destructive action"`
	ConfirmationToken string `json:"confirmation_token,omitempty" jsonschema:"token returned by a dry-run plan"`
	DryRun            bool   `json:"dry_run,omitempty" jsonschema:"return the plan without deleting"`
}

type jiraBulkDeleteInput struct {
	Keys              []string `json:"keys" jsonschema:"Jira issue keys"`
	DeleteSubtasks    bool     `json:"delete_subtasks,omitempty" jsonschema:"also delete child subtasks"`
	Confirm           bool     `json:"confirm,omitempty" jsonschema:"explicitly approve the destructive action"`
	ConfirmationToken string   `json:"confirmation_token,omitempty" jsonschema:"token returned by a dry-run plan"`
	DryRun            bool     `json:"dry_run,omitempty" jsonschema:"return the plan without deleting"`
}

type jiraWorklogAddInput struct {
	Key              string `json:"key" jsonschema:"Jira issue key"`
	TimeSpent        string `json:"time_spent,omitempty" jsonschema:"Jira duration such as 30m or 2h"`
	TimeSpentSeconds int    `json:"time_spent_seconds,omitempty" jsonschema:"time spent in seconds"`
	Started          string `json:"started,omitempty" jsonschema:"work start timestamp"`
	Comment          string `json:"comment_markdown,omitempty" jsonschema:"optional Markdown comment"`
	AdjustEstimate   string `json:"adjust_estimate,omitempty" jsonschema:"Jira estimate adjustment mode"`
	NewEstimate      string `json:"new_estimate,omitempty" jsonschema:"new remaining estimate"`
	ReduceBy         string `json:"reduce_by,omitempty" jsonschema:"remaining estimate reduction"`
}

type jiraWorklogListInput struct {
	Key   string `json:"key" jsonschema:"Jira issue key"`
	Limit int    `json:"limit,omitempty" jsonschema:"maximum number of worklogs"`
}

type jiraMutation struct {
	Summary  string   `json:"summary"`
	Key      string   `json:"key,omitempty"`
	Status   string   `json:"status"`
	Warnings []string `json:"warnings,omitempty"`
	Error    string   `json:"error,omitempty"`
}

func registerJiraTools(server *mcp.Server, service *bprMCP) {
	addMCPTool(server, &mcp.Tool{Name: "jira_get", Description: "Get one or more Jira work items.", Annotations: readOnlyAnnotations()}, func(ctx context.Context, input jiraGetInput) (any, error) {
		return service.jiraGet(ctx, input)
	})
	addMCPTool(server, &mcp.Tool{Name: "jira_query", Description: "Run an explicit JQL query against Jira work items.", Annotations: readOnlyAnnotations()}, func(ctx context.Context, input jiraQueryInput) (any, error) {
		return service.jiraQuery(ctx, input)
	})
	addMCPTool(server, &mcp.Tool{Name: "jira_find_users", Description: "Find Atlassian users and account IDs for unambiguous assignment.", Annotations: readOnlyAnnotations()}, func(ctx context.Context, input jiraFindUsersInput) (any, error) {
		return service.jiraFindUsers(ctx, input)
	})
	addMCPTool(server, &mcp.Tool{Name: "jira_create", Description: "Create one Jira work item with Markdown, assignee, labels, priority, estimates, and optional logged time.", Annotations: mutatingAnnotations()}, func(ctx context.Context, input jiraCreateInput) (any, error) {
		return service.jiraCreate(ctx, input)
	})
	addMCPTool(server, &mcp.Tool{Name: "jira_create_bulk", Description: "Create up to 100 independent Jira work items and return per-item results.", Annotations: mutatingAnnotations()}, func(ctx context.Context, input jiraBulkCreateInput) (any, error) {
		return service.jiraCreateBulk(ctx, input)
	})
	addMCPTool(server, &mcp.Tool{Name: "jira_create_task_tree", Description: "Create a Jira root task and its described subtasks sequentially, or preview the plan.", Annotations: mutatingAnnotations()}, func(ctx context.Context, input jiraTaskTreeInput) (any, error) {
		return service.jiraCreateTaskTree(ctx, input)
	})
	addMCPTool(server, &mcp.Tool{Name: "jira_update", Description: "Update Jira fields, transition status, add a comment, and optionally log time.", Annotations: mutatingAnnotations()}, func(ctx context.Context, input jiraUpdateInput) (any, error) {
		return service.jiraUpdate(ctx, input)
	})
	addMCPTool(server, &mcp.Tool{Name: "jira_transition", Description: "Transition a Jira work item to a target status.", Annotations: mutatingAnnotations()}, func(ctx context.Context, input jiraTransitionInput) (any, error) {
		return service.jiraTransition(ctx, input)
	})
	addMCPTool(server, &mcp.Tool{Name: "jira_delete", Description: "Preview or permanently delete one Jira work item. A confirmation token is required to execute.", Annotations: destructiveAnnotations()}, func(ctx context.Context, input jiraDeleteInput) (any, error) {
		return service.jiraDelete(ctx, input)
	})
	addMCPTool(server, &mcp.Tool{Name: "jira_delete_bulk", Description: "Preview or permanently delete up to 100 Jira work items. A confirmation token is required to execute.", Annotations: destructiveAnnotations()}, func(ctx context.Context, input jiraBulkDeleteInput) (any, error) {
		return service.jiraDeleteBulk(ctx, input)
	})
	addMCPTool(server, &mcp.Tool{Name: "jira_worklog_add", Description: "Log time spent on a Jira work item.", Annotations: mutatingAnnotations()}, func(ctx context.Context, input jiraWorklogAddInput) (any, error) {
		return service.jiraWorklogAdd(ctx, input)
	})
	addMCPTool(server, &mcp.Tool{Name: "jira_worklog_list", Description: "List time tracking worklogs for a Jira work item.", Annotations: readOnlyAnnotations()}, func(ctx context.Context, input jiraWorklogListInput) (any, error) {
		return service.jiraWorklogList(ctx, input)
	})
}

func addMCPTool[Input any](server *mcp.Server, tool *mcp.Tool, handler func(context.Context, Input) (any, error)) {
	mcp.AddTool(server, tool, func(ctx context.Context, _ *mcp.CallToolRequest, input Input) (*mcp.CallToolResult, any, error) {
		value, err := handler(ctx, input)
		if err != nil {
			return nil, nil, err
		}
		return mcpResult(value), nil, nil
	})
}

func readOnlyAnnotations() *mcp.ToolAnnotations {
	return &mcp.ToolAnnotations{ReadOnlyHint: true, IdempotentHint: true, OpenWorldHint: boolPointer(true)}
}

func mutatingAnnotations() *mcp.ToolAnnotations {
	return &mcp.ToolAnnotations{ReadOnlyHint: false, DestructiveHint: boolPointer(false), OpenWorldHint: boolPointer(true)}
}

func destructiveAnnotations() *mcp.ToolAnnotations {
	return &mcp.ToolAnnotations{ReadOnlyHint: false, DestructiveHint: boolPointer(true), OpenWorldHint: boolPointer(true)}
}

func boolPointer(value bool) *bool {
	return &value
}

func (s *bprMCP) jiraGet(ctx context.Context, input jiraGetInput) (any, error) {
	if err := validateIssueKeys(input.Keys); err != nil {
		return nil, err
	}
	args := []string{"workitem", "get"}
	args = append(args, input.Keys...)
	if input.Full {
		args = append(args, "--full")
	} else {
		args = append(args, "--fields", "summary,description,status,assignee,updated,labels,parent,subtasks,priority,issuetype")
	}
	return s.jira(ctx, args...)
}

func (s *bprMCP) jiraQuery(ctx context.Context, input jiraQueryInput) (any, error) {
	if strings.TrimSpace(input.JQL) == "" {
		return nil, fmt.Errorf("jql is required")
	}
	args := []string{"workitem", "query", "--jql", input.JQL}
	if input.Limit > 0 {
		if input.Limit > mcpMaxBatch {
			return nil, fmt.Errorf("limit exceeds the limit of %d", mcpMaxBatch)
		}
		args = append(args, "--limit", strconv.Itoa(input.Limit))
	}
	if input.Fields != "" {
		args = append(args, "--fields", input.Fields)
	}
	return s.jira(ctx, args...)
}

func (s *bprMCP) jiraFindUsers(ctx context.Context, input jiraFindUsersInput) (any, error) {
	if strings.TrimSpace(input.Query) == "" {
		return nil, fmt.Errorf("query is required")
	}
	limit := input.Limit
	if limit == 0 {
		limit = 20
	}
	if limit < 1 || limit > mcpMaxBatch {
		return nil, fmt.Errorf("limit must be between 1 and %d", mcpMaxBatch)
	}
	return s.command(ctx, "user", "search", "--name", input.Query, "--limit", strconv.Itoa(limit))
}

func (s *bprMCP) jiraCreate(ctx context.Context, input jiraCreateInput) (any, error) {
	project, err := s.projectFor(input.Project)
	if err != nil {
		return nil, err
	}
	return s.createJiraIssue(ctx, project, input.Issue)
}

func (s *bprMCP) jiraCreateBulk(ctx context.Context, input jiraBulkCreateInput) (any, error) {
	project, err := s.projectFor(input.Project)
	if err != nil {
		return nil, err
	}
	if err := requireBatchSize(len(input.Items)); err != nil {
		return nil, err
	}
	for i, item := range input.Items {
		if err := validateIssueSpec(item); err != nil {
			return nil, fmt.Errorf("item %d: %w", i+1, err)
		}
	}
	if input.DryRun {
		results := make([]jiraMutation, len(input.Items))
		for i, item := range input.Items {
			results[i] = jiraMutation{Summary: item.Summary, Status: "planned"}
		}
		return map[string]any{"project": project, "dry_run": true, "items": results}, nil
	}
	results := make([]jiraMutation, 0, len(input.Items))
	for _, item := range input.Items {
		result, err := s.createJiraIssue(ctx, project, item)
		if err != nil {
			result.Status = "failed"
			result.Error = err.Error()
		}
		results = append(results, result)
	}
	return map[string]any{"project": project, "dry_run": false, "items": results}, nil
}

func (s *bprMCP) jiraCreateTaskTree(ctx context.Context, input jiraTaskTreeInput) (any, error) {
	project, err := s.projectFor(input.Project)
	if err != nil {
		return nil, err
	}
	root, subtasks, err := taskTreeInputs(input)
	if err != nil {
		return nil, err
	}
	if input.ExpectedSubtaskCount != nil && *input.ExpectedSubtaskCount != len(subtasks) {
		return nil, fmt.Errorf("expected %d subtasks, received %d", *input.ExpectedSubtaskCount, len(subtasks))
	}
	if err := validateIssueSpec(root); err != nil {
		return nil, fmt.Errorf("root: %w", err)
	}
	for i, item := range subtasks {
		if err := validateIssueSpec(item); err != nil {
			return nil, fmt.Errorf("subtask %d: %w", i+1, err)
		}
	}
	if input.DryRun {
		planned := make([]jiraMutation, 0, len(subtasks)+1)
		planned = append(planned, jiraMutation{Summary: root.Summary, Status: "planned"})
		for _, item := range subtasks {
			planned = append(planned, jiraMutation{Summary: item.Summary, Status: "planned"})
		}
		return map[string]any{"project": project, "dry_run": true, "items": planned}, nil
	}
	rootResult, rootErr := s.createJiraIssue(ctx, project, root)
	if rootErr != nil {
		rootResult.Status = "failed"
		rootResult.Error = rootErr.Error()
		return map[string]any{"project": project, "dry_run": false, "root": rootResult, "subtasks": []jiraMutation{}, "partial_failure": false}, nil
	}
	results := make([]jiraMutation, 0, len(subtasks))
	for _, item := range subtasks {
		item.Parent = rootResult.Key
		result, itemErr := s.createJiraIssue(ctx, project, item)
		if itemErr != nil {
			result.Status = "failed"
			result.Error = itemErr.Error()
		}
		results = append(results, result)
	}
	partialFailure := false
	for _, result := range results {
		if result.Status == "failed" {
			partialFailure = true
			break
		}
	}
	return map[string]any{"project": project, "dry_run": false, "root": rootResult, "subtasks": results, "partial_failure": partialFailure}, nil
}

func (s *bprMCP) createJiraIssue(ctx context.Context, project string, input jiraIssueSpec) (jiraMutation, error) {
	result := jiraMutation{Summary: input.Summary, Status: "creating"}
	if err := validateIssueSpec(input); err != nil {
		return result, err
	}
	args := []string{"workitem", "create", "--space", project, "--summary", input.Summary}
	if input.Description != "" {
		args = append(args, "--description", input.Description, "--description-format", "markdown")
	}
	if input.IssueType != "" {
		args = append(args, "--type", input.IssueType)
	}
	if input.Parent != "" {
		args = append(args, "--parent", input.Parent)
	}
	if input.Assignee != "" {
		assignee, err := s.resolveAssignee(ctx, input.Assignee)
		if err != nil {
			return result, err
		}
		if assignee != "" {
			args = append(args, "--assignee", assignee)
		}
	}
	if len(input.Labels) > 0 {
		args = append(args, "--labels", strings.Join(input.Labels, ","))
	}
	if input.Priority != "" {
		args = append(args, "--priority", input.Priority)
	}
	output, err := s.jira(ctx, args...)
	if err != nil {
		return result, err
	}
	result.Key = findIssueKey(output)
	if result.Key == "" {
		return result, fmt.Errorf("twg created an issue but returned no Jira key")
	}
	result.Status = "created"
	if err := s.applyJiraPostCreate(ctx, result.Key, input, &result); err != nil {
		return result, err
	}
	return result, nil
}

func (s *bprMCP) applyJiraPostCreate(ctx context.Context, key string, input jiraIssueSpec, result *jiraMutation) error {
	if input.OriginalEstimate != "" || input.RemainingEstimate != "" || input.StoryPoints != nil {
		args := []string{"workitem", "update", "--id", key}
		if input.OriginalEstimate != "" {
			args = append(args, "--original-estimate", input.OriginalEstimate)
		}
		if input.RemainingEstimate != "" {
			args = append(args, "--remaining-estimate", input.RemainingEstimate)
		}
		if input.StoryPoints != nil {
			args = append(args, "--story-points", strconv.FormatFloat(*input.StoryPoints, 'f', -1, 64))
		}
		if _, err := s.jira(ctx, args...); err != nil {
			result.Warnings = append(result.Warnings, "estimate update failed: "+err.Error())
		}
	}
	if input.TimeSpent != "" {
		args := []string{"workitem", "worklog", "add", "--issue-id", key, "--time-spent", input.TimeSpent}
		if _, err := s.jira(ctx, args...); err != nil {
			result.Warnings = append(result.Warnings, "worklog failed: "+err.Error())
		}
	}
	return nil
}

func (s *bprMCP) jiraUpdate(ctx context.Context, input jiraUpdateInput) (any, error) {
	if err := validateIssueKeys([]string{input.Key}); err != nil {
		return nil, err
	}
	if err := s.validateIssueScope([]string{input.Key}); err != nil {
		return nil, err
	}
	args := []string{"workitem", "update", "--id", input.Key}
	if input.Summary != nil {
		args = append(args, "--summary", *input.Summary)
	}
	if input.Description != nil {
		args = append(args, "--description", *input.Description, "--description-format", "markdown")
	}
	if input.Assignee != nil {
		assignee, err := s.resolveAssignee(ctx, *input.Assignee)
		if err != nil {
			return nil, err
		}
		if assignee == "" {
			assignee = "none"
		}
		args = append(args, "--assignee", assignee)
	}
	if input.Labels != nil {
		args = append(args, "--labels", strings.Join(input.Labels, ","))
	}
	if len(input.AddLabels) > 0 {
		args = append(args, "--add-labels", strings.Join(input.AddLabels, ","))
	}
	if len(input.RemoveLabels) > 0 {
		args = append(args, "--remove-labels", strings.Join(input.RemoveLabels, ","))
	}
	if input.Parent != nil {
		args = append(args, "--parent", *input.Parent)
	}
	if input.IssueType != nil {
		args = append(args, "--type", *input.IssueType)
	}
	if input.Priority != nil {
		args = append(args, "--priority", *input.Priority)
	}
	if input.StoryPoints != nil {
		args = append(args, "--story-points", strconv.FormatFloat(*input.StoryPoints, 'f', -1, 64))
	}
	if input.DueDate != nil {
		args = append(args, "--due-date", *input.DueDate)
	}
	if input.OriginalEstimate != nil {
		args = append(args, "--original-estimate", *input.OriginalEstimate)
	}
	if input.RemainingEstimate != nil {
		args = append(args, "--remaining-estimate", *input.RemainingEstimate)
	}
	if input.Status != "" {
		args = append(args, "--status", input.Status)
	}
	if input.Comment != "" {
		args = append(args, "--comment", input.Comment, "--comment-format", "markdown")
	}
	if len(args) == 4 && input.TimeSpent == "" {
		return nil, fmt.Errorf("at least one Jira field, status, comment, or time_spent is required")
	}
	var output any
	var err error
	if len(args) > 4 {
		output, err = s.jira(ctx, args...)
		if err != nil {
			return nil, err
		}
	}
	result := map[string]any{"key": input.Key, "status": "updated", "output": output}
	if input.TimeSpent != "" {
		worklog := jiraWorklogAddInput{Key: input.Key, TimeSpent: input.TimeSpent, Comment: input.WorklogComment}
		if _, err := s.jiraWorklogAdd(ctx, worklog); err != nil {
			result["worklog_error"] = err.Error()
		}
	}
	return result, nil
}

func (s *bprMCP) jiraTransition(ctx context.Context, input jiraTransitionInput) (any, error) {
	if err := validateIssueKeys([]string{input.Key}); err != nil {
		return nil, err
	}
	if input.Status == "" {
		return nil, fmt.Errorf("key and status are required")
	}
	if err := s.validateIssueScope([]string{input.Key}); err != nil {
		return nil, err
	}
	args := []string{"workitem", "transition", "--id", input.Key, "--transition-id", input.Status}
	if input.Comment != "" {
		args = append(args, "--transition-comment", input.Comment, "--transition-comment-format", "markdown")
	}
	output, err := s.jira(ctx, args...)
	if err != nil {
		return nil, err
	}
	return map[string]any{"key": input.Key, "status": input.Status, "output": output}, nil
}

func (s *bprMCP) jiraDelete(ctx context.Context, input jiraDeleteInput) (any, error) {
	if err := validateIssueKeys([]string{input.Key}); err != nil {
		return nil, err
	}
	return s.deleteJiraIssues(ctx, []string{input.Key}, input.DeleteSubtasks, input.Confirm, input.ConfirmationToken, input.DryRun)
}

func (s *bprMCP) jiraDeleteBulk(ctx context.Context, input jiraBulkDeleteInput) (any, error) {
	if err := validateIssueKeys(input.Keys); err != nil {
		return nil, err
	}
	return s.deleteJiraIssues(ctx, input.Keys, input.DeleteSubtasks, input.Confirm, input.ConfirmationToken, input.DryRun)
}

func (s *bprMCP) deleteJiraIssues(ctx context.Context, keys []string, deleteSubtasks, confirm bool, token string, dryRun bool) (any, error) {
	if err := s.validateIssueScope(keys); err != nil {
		return nil, err
	}
	expected := confirmationToken("jira-delete", keys)
	if dryRun || !confirm || token != expected {
		preview, previewErr := s.jira(ctx, append([]string{"workitem", "get"}, keys...)...)
		plan := map[string]any{
			"action":                "jira_delete",
			"requires_confirmation": true,
			"confirmation_token":    expected,
			"keys":                  keys,
			"delete_subtasks":       deleteSubtasks,
			"preview":               preview,
		}
		if previewErr != nil {
			plan["preview_error"] = previewErr.Error()
		}
		return plan, nil
	}
	results := make([]jiraMutation, 0, len(keys))
	for _, key := range keys {
		_, err := s.jira(ctx, "workitem", "delete", "--id", key, "--delete-subtasks", strconv.FormatBool(deleteSubtasks))
		result := jiraMutation{Key: key, Summary: key, Status: "deleted"}
		if err != nil {
			result.Status = "failed"
			result.Error = err.Error()
		}
		results = append(results, result)
	}
	return map[string]any{"action": "jira_delete", "confirmed": true, "items": results}, nil
}

func (s *bprMCP) jiraWorklogAdd(ctx context.Context, input jiraWorklogAddInput) (any, error) {
	if err := validateIssueKeys([]string{input.Key}); err != nil {
		return nil, err
	}
	if input.TimeSpent == "" && input.TimeSpentSeconds == 0 {
		return nil, fmt.Errorf("key and time_spent or time_spent_seconds are required")
	}
	if err := s.validateIssueScope([]string{input.Key}); err != nil {
		return nil, err
	}
	args := []string{"workitem", "worklog", "add", "--issue-id", input.Key}
	if input.TimeSpent != "" {
		args = append(args, "--time-spent", input.TimeSpent)
	}
	if input.TimeSpentSeconds != 0 {
		args = append(args, "--time-spent-seconds", strconv.Itoa(input.TimeSpentSeconds))
	}
	if input.Started != "" {
		args = append(args, "--started", input.Started)
	}
	if input.Comment != "" {
		args = append(args, "--comment", input.Comment, "--comment-format", "markdown")
	}
	if input.AdjustEstimate != "" {
		args = append(args, "--adjust-estimate", input.AdjustEstimate)
	}
	if input.NewEstimate != "" {
		args = append(args, "--new-estimate", input.NewEstimate)
	}
	if input.ReduceBy != "" {
		args = append(args, "--reduce-by", input.ReduceBy)
	}
	output, err := s.jira(ctx, args...)
	if err != nil {
		return nil, err
	}
	return map[string]any{"key": input.Key, "status": "logged", "output": output}, nil
}

func (s *bprMCP) jiraWorklogList(ctx context.Context, input jiraWorklogListInput) (any, error) {
	if err := validateIssueKeys([]string{input.Key}); err != nil {
		return nil, err
	}
	if input.Limit < 0 || input.Limit > mcpMaxBatch {
		return nil, fmt.Errorf("limit must be between 1 and %d", mcpMaxBatch)
	}
	args := []string{"workitem", "worklog", "query", "--issue-id", input.Key}
	if input.Limit > 0 {
		args = append(args, "--first", strconv.Itoa(input.Limit))
	}
	return s.jira(ctx, args...)
}

func validateIssueSpec(input jiraIssueSpec) error {
	if strings.TrimSpace(input.Summary) == "" {
		return fmt.Errorf("summary is required")
	}
	return nil
}

func (s *bprMCP) resolveAssignee(ctx context.Context, value string) (string, error) {
	value = strings.TrimSpace(value)
	switch strings.ToLower(value) {
	case "":
		return "", nil
	case "none", "unassigned", "-":
		return "", nil
	case "me":
		return "me", nil
	}
	if strings.HasPrefix(value, "ari:") || strings.Count(value, ":") == 1 && !strings.ContainsAny(value, " \t") {
		return value, nil
	}
	output, err := s.command(ctx, "user", "search", "--name", value, "--limit", "20")
	if err != nil {
		return "", err
	}
	users := userCandidates(output)
	if len(users) == 0 {
		return "", fmt.Errorf("no Atlassian user matches %q", value)
	}
	for _, user := range users {
		if strings.EqualFold(user.Name, value) || strings.EqualFold(user.Email, value) {
			return user.AccountID, nil
		}
	}
	if len(users) > 1 {
		names := make([]string, len(users))
		for i, user := range users {
			names[i] = user.Name
		}
		return "", fmt.Errorf("assignee %q is ambiguous: %s", value, strings.Join(names, ", "))
	}
	return users[0].AccountID, nil
}

type userCandidate struct {
	AccountID string
	Name      string
	Email     string
}

func userCandidates(value any) []userCandidate {
	seen := map[string]userCandidate{}
	collectUserCandidates(value, seen)
	users := make([]userCandidate, 0, len(seen))
	for _, user := range seen {
		users = append(users, user)
	}
	sort.Slice(users, func(i, j int) bool { return users[i].AccountID < users[j].AccountID })
	return users
}

func collectUserCandidates(value any, seen map[string]userCandidate) {
	switch current := value.(type) {
	case []any:
		for _, item := range current {
			collectUserCandidates(item, seen)
		}
	case map[string]any:
		accountID, _ := current["accountId"].(string)
		if accountID != "" {
			name, _ := current["name"].(string)
			email, _ := current["email"].(string)
			seen[accountID] = userCandidate{AccountID: accountID, Name: name, Email: email}
		}
		for _, item := range current {
			collectUserCandidates(item, seen)
		}
	}
}

func findIssueKey(value any) string {
	switch current := value.(type) {
	case map[string]any:
		for _, field := range []string{"key", "issueKey", "workItemKey"} {
			if candidate, ok := current[field].(string); ok && looksLikeIssueKey(candidate) {
				return candidate
			}
		}
		for _, item := range current {
			if key := findIssueKey(item); key != "" {
				return key
			}
		}
	case []any:
		for _, item := range current {
			if key := findIssueKey(item); key != "" {
				return key
			}
		}
	}
	return ""
}

func looksLikeIssueKey(value string) bool {
	dash := strings.LastIndex(value, "-")
	if dash < 1 || dash == len(value)-1 {
		return false
	}
	for _, char := range value[dash+1:] {
		if char < '0' || char > '9' {
			return false
		}
	}
	return true
}
