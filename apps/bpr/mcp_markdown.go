package main

import (
	"fmt"
	"strings"
)

type parsedTaskTree struct {
	Root     jiraIssueSpec
	Subtasks []jiraIssueSpec
}

func taskTreeInputs(input jiraTaskTreeInput) (jiraIssueSpec, []jiraIssueSpec, error) {
	root := jiraIssueSpec{}
	if input.Root != nil {
		root = *input.Root
	}
	subtasks := append([]jiraIssueSpec(nil), input.Subtasks...)
	if input.Markdown == "" {
		return root, subtasks, nil
	}
	parsed, err := parseTaskTreeMarkdown(input.Markdown)
	if err != nil {
		return jiraIssueSpec{}, nil, err
	}
	if root.Summary == "" {
		root.Summary = parsed.Root.Summary
	}
	if root.Description == "" {
		root.Description = parsed.Root.Description
	}
	if len(subtasks) == 0 {
		subtasks = parsed.Subtasks
	}
	return root, subtasks, nil
}

func parseTaskTreeMarkdown(markdown string) (parsedTaskTree, error) {
	lines := strings.Split(strings.ReplaceAll(markdown, "\r\n", "\n"), "\n")
	result := parsedTaskTree{}
	inSubtasks := false
	var current *jiraIssueSpec
	var rootDescription []string
	var subtaskDescription []string
	flush := func() {
		if current == nil {
			return
		}
		current.Description = strings.TrimSpace(strings.Join(subtaskDescription, "\n"))
		result.Subtasks = append(result.Subtasks, *current)
		current = nil
		subtaskDescription = nil
	}
	for _, rawLine := range lines {
		line := strings.TrimRight(rawLine, " \t")
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "# ") && result.Root.Summary == "" {
			result.Root.Summary = strings.TrimSpace(strings.TrimPrefix(trimmed, "# "))
			continue
		}
		if strings.EqualFold(trimmed, "## subtasks") || strings.EqualFold(trimmed, "## subtaken") {
			flush()
			inSubtasks = true
			continue
		}
		if !inSubtasks {
			rootDescription = append(rootDescription, line)
			continue
		}
		if summary, ok := markdownSubtaskHeading(trimmed); ok {
			flush()
			current = &jiraIssueSpec{Summary: summary}
			continue
		}
		if current == nil {
			if trimmed != "" {
				return parsedTaskTree{}, fmt.Errorf("Markdown subtask content appears before a subtask heading: %q", trimmed)
			}
			continue
		}
		if parseSubtaskMetadata(trimmed, current) {
			continue
		}
		subtaskDescription = append(subtaskDescription, line)
	}
	flush()
	result.Root.Description = strings.TrimSpace(strings.Join(rootDescription, "\n"))
	if result.Root.Summary == "" {
		return parsedTaskTree{}, fmt.Errorf("Markdown must start with a # root summary")
	}
	if len(result.Subtasks) == 0 {
		return parsedTaskTree{}, fmt.Errorf("Markdown must contain at least one ### subtask heading or - [ ] item")
	}
	return result, nil
}

func markdownSubtaskHeading(line string) (string, bool) {
	if strings.HasPrefix(line, "### ") {
		return strings.TrimSpace(strings.TrimPrefix(line, "### ")), true
	}
	if strings.HasPrefix(line, "- [ ] ") || strings.HasPrefix(line, "- [x] ") || strings.HasPrefix(line, "- [X] ") {
		return strings.TrimSpace(line[6:]), true
	}
	return "", false
}

func parseSubtaskMetadata(line string, issue *jiraIssueSpec) bool {
	metadata := strings.TrimSpace(strings.TrimPrefix(line, "- "))
	separator := strings.Index(metadata, ":")
	if separator < 1 {
		return false
	}
	name := strings.ToLower(strings.TrimSpace(metadata[:separator]))
	value := strings.TrimSpace(metadata[separator+1:])
	switch name {
	case "assignee", "toegewezen aan":
		issue.Assignee = value
	case "estimate", "original estimate", "schatting":
		issue.OriginalEstimate = value
	case "remaining estimate", "resterende schatting":
		issue.RemainingEstimate = value
	case "time spent", "tijd besteed":
		issue.TimeSpent = value
	case "priority", "prioriteit":
		issue.Priority = value
	case "labels", "tags":
		issue.Labels = splitCommaList(value)
	case "description", "beschrijving":
		issue.Description = value
	default:
		return false
	}
	return true
}

func splitCommaList(value string) []string {
	parts := strings.Split(value, ",")
	labels := make([]string, 0, len(parts))
	for _, part := range parts {
		if item := strings.TrimSpace(part); item != "" {
			labels = append(labels, item)
		}
	}
	return labels
}
