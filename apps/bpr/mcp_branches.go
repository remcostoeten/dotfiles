package main

import (
	"context"
	"fmt"
	"strconv"
	"strings"

	"github.com/modelcontextprotocol/go-sdk/mcp"
)

type branchListInput struct {
	Workspace  string `json:"workspace,omitempty" jsonschema:"Bitbucket workspace slug"`
	Repository string `json:"repository,omitempty" jsonschema:"Bitbucket repository slug"`
	Query      string `json:"query,omitempty" jsonschema:"plain branch name filter"`
	Limit      int    `json:"limit,omitempty" jsonschema:"maximum number of branches"`
}

type branchCreateInput struct {
	Workspace  string `json:"workspace,omitempty" jsonschema:"Bitbucket workspace slug"`
	Repository string `json:"repository,omitempty" jsonschema:"Bitbucket repository slug"`
	Branch     string `json:"branch" jsonschema:"new branch name"`
	From       string `json:"from" jsonschema:"source branch or commit hash"`
}

type branchSpec struct {
	Branch string `json:"branch" jsonschema:"new branch name"`
	From   string `json:"from" jsonschema:"source branch or commit hash"`
}

type branchBulkCreateInput struct {
	Workspace  string       `json:"workspace,omitempty" jsonschema:"Bitbucket workspace slug"`
	Repository string       `json:"repository,omitempty" jsonschema:"Bitbucket repository slug"`
	Branches   []branchSpec `json:"branches" jsonschema:"branches to create"`
	DryRun     bool         `json:"dry_run,omitempty" jsonschema:"return the plan without creating branches"`
}

type branchDeleteInput struct {
	Workspace         string   `json:"workspace,omitempty" jsonschema:"Bitbucket workspace slug"`
	Repository        string   `json:"repository,omitempty" jsonschema:"Bitbucket repository slug"`
	Branches          []string `json:"branches" jsonschema:"branch names to delete"`
	Confirm           bool     `json:"confirm,omitempty" jsonschema:"explicitly approve the destructive action"`
	ConfirmationToken string   `json:"confirmation_token,omitempty" jsonschema:"token returned by a dry-run plan"`
	DryRun            bool     `json:"dry_run,omitempty" jsonschema:"return the plan without deleting"`
}

type branchMutation struct {
	Branch string `json:"branch"`
	From   string `json:"from,omitempty"`
	Status string `json:"status"`
	Error  string `json:"error,omitempty"`
}

func registerBranchTools(server *mcp.Server, service *bprMCP) {
	addMCPTool(server, &mcp.Tool{Name: "bitbucket_branch_list", Description: "List remote Bitbucket branches.", Annotations: readOnlyAnnotations()}, func(ctx context.Context, input branchListInput) (any, error) {
		return service.branchList(ctx, input)
	})
	addMCPTool(server, &mcp.Tool{Name: "bitbucket_branch_create", Description: "Create one remote Bitbucket branch from a source branch or commit.", Annotations: mutatingAnnotations()}, func(ctx context.Context, input branchCreateInput) (any, error) {
		return service.branchCreate(ctx, input)
	})
	addMCPTool(server, &mcp.Tool{Name: "bitbucket_branch_create_bulk", Description: "Create up to 100 remote Bitbucket branches and return per-item results.", Annotations: mutatingAnnotations()}, func(ctx context.Context, input branchBulkCreateInput) (any, error) {
		return service.branchCreateBulk(ctx, input)
	})
	addMCPTool(server, &mcp.Tool{Name: "bitbucket_branch_delete", Description: "Preview or permanently delete remote Bitbucket branches. A confirmation token is required to execute.", Annotations: destructiveAnnotations()}, func(ctx context.Context, input branchDeleteInput) (any, error) {
		return service.branchDelete(ctx, input)
	})
}

func (s *bprMCP) branchList(ctx context.Context, input branchListInput) (any, error) {
	workspace, repo, err := s.repoFor(input.Workspace, input.Repository)
	if err != nil {
		return nil, err
	}
	limit := input.Limit
	if limit == 0 {
		limit = 25
	}
	if limit < 1 || limit > mcpMaxBatch {
		return nil, fmt.Errorf("limit must be between 1 and %d", mcpMaxBatch)
	}
	args := []string{"branch", "query", "--limit", strconv.Itoa(limit)}
	if input.Query != "" {
		args = append(args, "--query", input.Query)
	}
	return s.bitbucket(ctx, workspace, repo, args...)
}

func (s *bprMCP) branchCreate(ctx context.Context, input branchCreateInput) (any, error) {
	workspace, repo, err := s.repoFor(input.Workspace, input.Repository)
	if err != nil {
		return nil, err
	}
	if err := validateBranchSpec(branchSpec{Branch: input.Branch, From: input.From}); err != nil {
		return nil, err
	}
	return s.createBranch(ctx, workspace, repo, branchSpec{Branch: input.Branch, From: input.From})
}

func (s *bprMCP) branchCreateBulk(ctx context.Context, input branchBulkCreateInput) (any, error) {
	workspace, repo, err := s.repoFor(input.Workspace, input.Repository)
	if err != nil {
		return nil, err
	}
	if err := requireBatchSize(len(input.Branches)); err != nil {
		return nil, err
	}
	for i, branch := range input.Branches {
		if err := validateBranchSpec(branch); err != nil {
			return nil, fmt.Errorf("branch %d: %w", i+1, err)
		}
	}
	if input.DryRun {
		results := make([]branchMutation, len(input.Branches))
		for i, branch := range input.Branches {
			results[i] = branchMutation{Branch: branch.Branch, From: branch.From, Status: "planned"}
		}
		return map[string]any{"workspace": workspace, "repository": repo, "dry_run": true, "items": results}, nil
	}
	results := make([]branchMutation, 0, len(input.Branches))
	for _, branch := range input.Branches {
		value, err := s.createBranch(ctx, workspace, repo, branch)
		if err != nil {
			results = append(results, branchMutation{Branch: branch.Branch, From: branch.From, Status: "failed", Error: err.Error()})
			continue
		}
		results = append(results, value)
	}
	return map[string]any{"workspace": workspace, "repository": repo, "dry_run": false, "items": results}, nil
}

func (s *bprMCP) createBranch(ctx context.Context, workspace, repo string, branch branchSpec) (branchMutation, error) {
	_, err := s.bitbucket(ctx, workspace, repo, "branch", "create", "--branch", branch.Branch, "--from", branch.From)
	if err != nil {
		return branchMutation{}, err
	}
	return branchMutation{Branch: branch.Branch, From: branch.From, Status: "created"}, nil
}

func (s *bprMCP) branchDelete(ctx context.Context, input branchDeleteInput) (any, error) {
	workspace, repo, err := s.repoFor(input.Workspace, input.Repository)
	if err != nil {
		return nil, err
	}
	if err := requireBatchSize(len(input.Branches)); err != nil {
		return nil, err
	}
	for _, branch := range input.Branches {
		if err := validateDeletableBranchName(branch); err != nil {
			return nil, err
		}
	}
	expected := confirmationToken("bitbucket-branch-delete", input.Branches)
	if input.DryRun || !input.Confirm || input.ConfirmationToken != expected {
		return map[string]any{
			"action":                "bitbucket_branch_delete",
			"workspace":             workspace,
			"repository":            repo,
			"requires_confirmation": true,
			"confirmation_token":    expected,
			"branches":              input.Branches,
		}, nil
	}
	results := make([]branchMutation, 0, len(input.Branches))
	for _, branch := range input.Branches {
		_, err := s.bitbucket(ctx, workspace, repo, "branch", "delete", branch, "--yes")
		result := branchMutation{Branch: branch, Status: "deleted"}
		if err != nil {
			result.Status = "failed"
			result.Error = err.Error()
		}
		results = append(results, result)
	}
	return map[string]any{"action": "bitbucket_branch_delete", "workspace": workspace, "repository": repo, "confirmed": true, "items": results}, nil
}

func validateBranchSpec(branch branchSpec) error {
	if err := validateBranchName(branch.Branch); err != nil {
		return err
	}
	if strings.TrimSpace(branch.From) == "" || strings.ContainsAny(branch.From, " \t\r\n") {
		return fmt.Errorf("source branch or commit is required")
	}
	return nil
}

func validateBranchName(branch string) error {
	branch = strings.TrimSpace(branch)
	if branch == "" || strings.ContainsAny(branch, " \t\r\n") {
		return fmt.Errorf("invalid branch name %q", branch)
	}
	return nil
}

func validateDeletableBranchName(branch string) error {
	if err := validateBranchName(branch); err != nil {
		return err
	}
	switch strings.ToLower(branch) {
	case "main", "master", "develop", "trunk":
		return fmt.Errorf("refusing to delete protected branch %q", branch)
	}
	return nil
}
