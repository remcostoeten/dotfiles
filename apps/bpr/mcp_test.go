package main

import (
	"context"
	"encoding/json"
	"strings"
	"testing"

	"github.com/modelcontextprotocol/go-sdk/mcp"
)

func TestParseTaskTreeMarkdown(t *testing.T) {
	got, err := parseTaskTreeMarkdown(`# Nieuwe checkout

Doel en context.

## Subtasks

### API aanpassen

Endpoint uitbreiden.

- Assignee: alice
- Estimate: 4h

### UI aanpassen

- Assignee: me
- Time spent: 30m
`)
	if err != nil {
		t.Fatal(err)
	}
	if got.Root.Summary != "Nieuwe checkout" {
		t.Fatalf("root summary = %q", got.Root.Summary)
	}
	if got.Root.Description != "Doel en context." {
		t.Fatalf("root description = %q", got.Root.Description)
	}
	if len(got.Subtasks) != 2 {
		t.Fatalf("subtasks = %d", len(got.Subtasks))
	}
	if got.Subtasks[0].Assignee != "alice" || got.Subtasks[0].OriginalEstimate != "4h" {
		t.Fatalf("first subtask metadata = %#v", got.Subtasks[0])
	}
	if got.Subtasks[1].TimeSpent != "30m" {
		t.Fatalf("second subtask time = %q", got.Subtasks[1].TimeSpent)
	}
}

func TestDeleteRequiresConfirmationToken(t *testing.T) {
	service, calls := fakeMCPService(`{"data":{"items":[]}}`)
	value, err := service.jiraDeleteBulk(context.Background(), jiraBulkDeleteInput{Keys: []string{"MAR-1", "MAR-2"}})
	if err != nil {
		t.Fatal(err)
	}
	plan, ok := value.(map[string]any)
	if !ok {
		t.Fatalf("plan type = %T", value)
	}
	if plan["confirmation_token"] != "jira-delete:MAR-1,MAR-2" {
		t.Fatalf("unexpected token: %#v", plan["confirmation_token"])
	}
	if len(*calls) != 1 || strings.Contains((*calls)[0], "workitem delete") {
		t.Fatalf("unexpected commands: %#v", *calls)
	}
}

func TestCreateUsesMarkdownAndReturnsKey(t *testing.T) {
	service, calls := fakeMCPService(`{"data":{"key":"MAR-123"}}`)
	value, err := service.jiraCreate(context.Background(), jiraCreateInput{
		Project: "MAR",
		Issue: jiraIssueSpec{
			Summary:     "Nieuwe checkout",
			Description: "## Context\n\nBeschrijving",
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	result, ok := value.(jiraMutation)
	if !ok {
		t.Fatalf("result type = %T", value)
	}
	if result.Key != "MAR-123" || result.Status != "created" {
		t.Fatalf("result = %#v", result)
	}
	if len(*calls) != 1 || !strings.Contains((*calls)[0], "--description-format markdown") {
		t.Fatalf("unexpected command: %#v", *calls)
	}
}

func TestTaskTreeCanDeriveRootFromMarkdown(t *testing.T) {
	service, calls := fakeMCPService(`{"data":{"key":"MAR-123"}}`)
	value, err := service.jiraCreateTaskTree(context.Background(), jiraTaskTreeInput{
		Project: "MAR",
		Markdown: `# Root task

Context.

## Subtasks

### First subtask

Description.
`,
		ExpectedSubtaskCount: intPointer(1),
	})
	if err != nil {
		t.Fatal(err)
	}
	result, ok := value.(map[string]any)
	if !ok || result["partial_failure"] != false {
		t.Fatalf("result = %#v", value)
	}
	if len(*calls) != 2 {
		t.Fatalf("commands = %#v", *calls)
	}
}

func TestMCPListsTools(t *testing.T) {
	service, _ := fakeMCPService(`{"data":{}}`)
	server := newMCPServer(service)
	ctx := context.Background()
	serverTransport, clientTransport := mcp.NewInMemoryTransports()
	serverSession, err := server.Connect(ctx, serverTransport, nil)
	if err != nil {
		t.Fatal(err)
	}
	defer serverSession.Close()
	clientSession, err := mcp.NewClient(&mcp.Implementation{Name: "test-client", Version: "1.0.0"}, nil).Connect(ctx, clientTransport, nil)
	if err != nil {
		t.Fatal(err)
	}
	defer clientSession.Close()
	response, err := clientSession.ListTools(ctx, nil)
	if err != nil {
		t.Fatal(err)
	}
	toolNames := map[string]bool{}
	for _, tool := range response.Tools {
		toolNames[tool.Name] = true
	}
	for _, name := range []string{"jira_create_task_tree", "jira_delete_bulk", "jira_worklog_add", "bitbucket_branch_delete"} {
		if !toolNames[name] {
			t.Fatalf("missing tool %q", name)
		}
	}
}

func fakeMCPService(response string) (*bprMCP, *[]string) {
	calls := []string{}
	service := &bprMCP{
		twg: &twgCommand{
			binary: "twg",
			run: func(_ context.Context, _ string, args []string, _ []byte) ([]byte, error) {
				calls = append(calls, strings.Join(args, " "))
				var value any
				if err := json.Unmarshal([]byte(response), &value); err != nil {
					return nil, err
				}
				return []byte(response), nil
			},
		},
		site:            "example.atlassian.net",
		project:         "MAR",
		repo:            "workspace/repository",
		allowedProjects: map[string]struct{}{"MAR": {}},
		allowedRepos:    map[string]struct{}{"workspace/repository": {}},
	}
	return service, &calls
}

func intPointer(value int) *int {
	return &value
}
