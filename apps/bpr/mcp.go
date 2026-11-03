package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/modelcontextprotocol/go-sdk/mcp"
	"github.com/remcostoeten/bpr/internal/config"
)

const mcpMaxBatch = 100

type twgCommand struct {
	binary string
	run    func(context.Context, string, []string, []byte) ([]byte, error)
}

type bprMCP struct {
	twg             *twgCommand
	site            string
	project         string
	repo            string
	allowedProjects map[string]struct{}
	allowedRepos    map[string]struct{}
}

func runMCP(ctx context.Context) error {
	service, err := newBPRMCP()
	if err != nil {
		return err
	}
	server := newMCPServer(service)
	return server.Run(ctx, &mcp.StdioTransport{})
}

func newBPRMCP() (*bprMCP, error) {
	binary, err := resolveTWGBinary()
	if err != nil {
		return nil, err
	}
	settings := config.LoadSettings()
	slug := settings.RepoSlug
	if slug == "" {
		slug, _ = config.RepoSlug("", settings)
	}
	return &bprMCP{
		twg:             &twgCommand{binary: binary, run: runTWGCommand},
		site:            siteHost(firstNonEmpty(os.Getenv("BPR_MCP_JIRA_SITE"), settings.JiraSite)),
		project:         firstNonEmpty(os.Getenv("BPR_MCP_JIRA_PROJECT"), settings.JiraProject),
		repo:            slug,
		allowedProjects: configuredAllowlist("BPR_MCP_ALLOWED_PROJECTS", settings.JiraProject),
		allowedRepos:    configuredAllowlist("BPR_MCP_ALLOWED_REPOS", slug),
	}, nil
}

func resolveTWGBinary() (string, error) {
	configured := firstNonEmpty(os.Getenv("BPR_MCP_TWG_BIN"), os.Getenv("BPR_TWG_BIN"))
	if configured != "" {
		return resolveExecutable(configured)
	}
	if home, err := os.UserHomeDir(); err == nil {
		local := filepath.Join(home, ".local", "bin", "twg")
		if _, err := os.Stat(local); err == nil {
			return local, nil
		}
	}
	return exec.LookPath("twg")
}

func resolveExecutable(path string) (string, error) {
	if filepath.IsAbs(path) {
		if _, err := os.Stat(path); err != nil {
			return "", fmt.Errorf("twg binary %q: %w", path, err)
		}
		return path, nil
	}
	return exec.LookPath(path)
}

func runTWGCommand(ctx context.Context, binary string, args []string, input []byte) ([]byte, error) {
	cmd := exec.CommandContext(ctx, binary, args...)
	cmd.Stdin = bytes.NewReader(input)
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		message := strings.TrimSpace(stderr.String())
		if message == "" {
			message = strings.TrimSpace(stdout.String())
		}
		if message == "" {
			message = err.Error()
		}
		return nil, fmt.Errorf("twg: %s", message)
	}
	return bytes.TrimSpace(stdout.Bytes()), nil
}

func (s *bprMCP) command(ctx context.Context, args ...string) (any, error) {
	full := []string{"--output", "json", "--output-summary", "none"}
	if s.site != "" {
		full = append(full, "--site", s.site)
	}
	full = append(full, args...)
	raw, err := s.twg.run(ctx, s.twg.binary, full, nil)
	if err != nil {
		return nil, err
	}
	if len(raw) == 0 {
		return map[string]any{}, nil
	}
	var value any
	if err := json.Unmarshal(raw, &value); err != nil {
		return nil, fmt.Errorf("twg returned invalid JSON: %w", err)
	}
	return value, nil
}

func (s *bprMCP) jira(ctx context.Context, args ...string) (any, error) {
	if s.site == "" {
		return nil, fmt.Errorf("no Jira site configured; set jira_site or BPR_MCP_JIRA_SITE")
	}
	return s.command(ctx, append([]string{"jira"}, args...)...)
}

func (s *bprMCP) bitbucket(ctx context.Context, workspace, repo string, args ...string) (any, error) {
	if workspace == "" || repo == "" {
		return nil, fmt.Errorf("workspace and repository are required")
	}
	return s.command(ctx, append([]string{"bitbucket"}, append(args, "--workspace", workspace, "--repo", repo)...)...)
}

func newMCPServer(service *bprMCP) *mcp.Server {
	server := mcp.NewServer(&mcp.Implementation{Name: "bpr", Version: "0.1.0"}, nil)
	registerJiraTools(server, service)
	registerBranchTools(server, service)
	return server
}

func mcpResult(value any) *mcp.CallToolResult {
	data, err := json.Marshal(value)
	if err != nil {
		return &mcp.CallToolResult{
			Content: []mcp.Content{&mcp.TextContent{Text: err.Error()}},
			IsError: true,
		}
	}
	return &mcp.CallToolResult{
		Content:           []mcp.Content{&mcp.TextContent{Text: string(data)}},
		StructuredContent: value,
	}
}

func siteHost(site string) string {
	s := strings.TrimSpace(site)
	s = strings.TrimPrefix(s, "https://")
	s = strings.TrimPrefix(s, "http://")
	return strings.TrimSuffix(s, "/")
}

func configuredAllowlist(envKey, fallback string) map[string]struct{} {
	value := strings.TrimSpace(os.Getenv(envKey))
	if value == "" {
		value = fallback
	}
	items := map[string]struct{}{}
	for _, item := range strings.Split(value, ",") {
		item = strings.TrimSpace(item)
		if item != "" {
			items[item] = struct{}{}
		}
	}
	return items
}

func (s *bprMCP) projectFor(value string) (string, error) {
	project := strings.TrimSpace(value)
	if project == "" {
		project = s.project
	}
	if project == "" {
		return "", fmt.Errorf("project is required; set jira_project or BPR_MCP_JIRA_PROJECT")
	}
	if len(s.allowedProjects) > 0 {
		if _, ok := s.allowedProjects[project]; !ok {
			return "", fmt.Errorf("project %q is outside the MCP allowlist", project)
		}
	}
	return project, nil
}

func (s *bprMCP) repoFor(workspace, repo string) (string, string, error) {
	workspace = strings.TrimSpace(workspace)
	repo = strings.TrimSpace(repo)
	if repo == "" {
		workspace, repo = splitRepo(s.repo)
	}
	if workspace == "" || repo == "" {
		return "", "", fmt.Errorf("workspace and repository are required; set repo_slug or pass both")
	}
	slug := workspace + "/" + repo
	if len(s.allowedRepos) == 0 {
		return "", "", fmt.Errorf("no Bitbucket repository allowlist configured; set repo_slug or BPR_MCP_ALLOWED_REPOS")
	}
	if _, ok := s.allowedRepos[slug]; !ok {
		return "", "", fmt.Errorf("repository %q is outside the MCP allowlist", slug)
	}
	return workspace, repo, nil
}

func splitRepo(slug string) (string, string) {
	parts := strings.SplitN(strings.Trim(slug, "/"), "/", 2)
	if len(parts) != 2 {
		return "", ""
	}
	return parts[0], parts[1]
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

func requireBatchSize(count int) error {
	if count == 0 {
		return fmt.Errorf("at least one item is required")
	}
	if count > mcpMaxBatch {
		return fmt.Errorf("batch size %d exceeds the limit of %d", count, mcpMaxBatch)
	}
	return nil
}

func validateIssueKeys(keys []string) error {
	if err := requireBatchSize(len(keys)); err != nil {
		return err
	}
	for _, key := range keys {
		key = strings.TrimSpace(key)
		if key == "" || strings.ContainsAny(key, " \t\r\n") {
			return fmt.Errorf("invalid Jira issue key %q", key)
		}
	}
	return nil
}

func (s *bprMCP) validateIssueScope(keys []string) error {
	if len(s.allowedProjects) == 0 {
		return fmt.Errorf("no Jira project allowlist configured; set jira_project or BPR_MCP_ALLOWED_PROJECTS")
	}
	for _, key := range keys {
		separator := strings.LastIndex(key, "-")
		if separator < 1 {
			return fmt.Errorf("issue %q is not a Jira key in an allowed project", key)
		}
		project := key[:separator]
		if _, ok := s.allowedProjects[project]; !ok {
			return fmt.Errorf("issue %q is outside the MCP project allowlist", key)
		}
	}
	return nil
}

func confirmationToken(prefix string, values []string) string {
	return prefix + ":" + strings.Join(values, ",")
}
