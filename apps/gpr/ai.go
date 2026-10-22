package main

import (
	"bufio"
	"cmp"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os/exec"
	"regexp"
	"strings"
	"syscall"
	"time"
)

// aiBackends are the supported non-interactive AI CLIs, in cycle order.
var aiBackends = []string{"claude", "opencode", "codex", "gemini"}

const aiTimeout = 15 * time.Minute

type aiEventKind int

const (
	aiStep aiEventKind = iota
	aiMessage
	aiDone
	aiFailed
	aiSession
)

type aiEvent struct {
	kind aiEventKind
	text string
}

type aiTurn struct {
	Question string          `json:"question"`
	Answer   string          `json:"answer"`
	Steps    []string        `json:"steps"`
	Err      string          `json:"err"`
	Done     map[string]bool `json:"done,omitempty"`
}

// aiThread is one conversation with a backend about a ticket (or a set of
// tickets), resumable through the backend's session id.
type aiThread struct {
	Key       string   `json:"key"`
	Label     string   `json:"label"`
	Backend   string   `json:"backend"`
	Prompt    string   `json:"prompt"`
	SessionID string   `json:"session_id"`
	Turns     []aiTurn `json:"turns"`
}

func (t *aiThread) current() *aiTurn {
	return &t.Turns[len(t.Turns)-1]
}

func (t *aiThread) canFollowUp() bool {
	return t.SessionID != ""
}

// aiRun is a running backend process whose progress arrives on events.
// The channel is closed once the process has exited.
type aiRun struct {
	events <-chan aiEvent
	cancel context.CancelFunc
	exited chan struct{}
}

// stop kills the backend and waits briefly for it to exit.
func (r *aiRun) stop() {
	r.cancel()
	select {
	case <-r.exited:
	case <-time.After(2 * time.Second):
	}
}

// claudeReadOnlyTools are the only tools the claude backend may use, so an
// analysis run can never edit the repository.
var claudeReadOnlyTools = []string{
	"Read", "Grep", "Glob", "WebFetch", "WebSearch",
	"Bash(git log:*)", "Bash(git show:*)", "Bash(git diff:*)", "Bash(git grep:*)", "Bash(git blame:*)",
	"Bash(ls:*)", "Bash(gh issue view:*)", "Bash(gh pr view:*)",
}

// buildAICommand returns the exec.Cmd used to send prompt to the given backend
// non-interactively, read-only, with machine-readable streaming output.
// When sessionID is set the backend's earlier conversation is resumed.
func buildAICommand(ctx context.Context, backend, prompt, sessionID string) *exec.Cmd {
	switch backend {
	case "opencode":
		args := []string{"run", "--format", "json", "--agent", "plan"}
		if sessionID != "" {
			args = append(args, "--session", sessionID)
		}
		return exec.CommandContext(ctx, "opencode", append(args, prompt)...)
	case "gemini":
		args := []string{"-p", prompt, "--approval-mode", "plan", "--skip-trust", "--output-format", "stream-json"}
		if sessionID != "" {
			args = append(args, "--resume", sessionID)
		}
		return exec.CommandContext(ctx, "gemini", args...)
	case "codex":
		flags := []string{"--json", "--skip-git-repo-check", "-c", `sandbox_mode="read-only"`, "-c", `approval_policy="never"`}
		if sessionID != "" {
			args := append([]string{"exec", "resume"}, flags...)
			return exec.CommandContext(ctx, "codex", append(args, sessionID, prompt)...)
		}
		return exec.CommandContext(ctx, "codex", append(append([]string{"exec"}, flags...), prompt)...)
	default:
		args := []string{"-p", prompt, "--permission-mode", "dontAsk", "--output-format", "stream-json", "--verbose",
			"--allowedTools", strings.Join(claudeReadOnlyTools, ",")}
		if sessionID != "" {
			args = append(args, "--resume", sessionID)
		}
		return exec.CommandContext(ctx, "claude", args...)
	}
}

// startAI launches backend with prompt and streams its progress as events.
func startAI(backend, prompt, sessionID string) *aiRun {
	ctx, cancel := context.WithTimeout(context.Background(), aiTimeout)
	events := make(chan aiEvent, 64)
	run := &aiRun{events: events, cancel: cancel, exited: make(chan struct{})}

	cmd := buildAICommand(ctx, backend, prompt, sessionID)
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
	cmd.Cancel = func() error {
		return syscall.Kill(-cmd.Process.Pid, syscall.SIGKILL)
	}
	stderr := &tailBuffer{max: 4096}
	cmd.Stderr = stderr

	go func() {
		defer close(run.exited)
		defer close(events)
		defer cancel()

		stdout, err := cmd.StdoutPipe()
		if err == nil {
			err = cmd.Start()
		}
		if err != nil {
			events <- aiEvent{kind: aiFailed, text: fmt.Sprintf("could not start %s: %v", backend, err)}
			return
		}

		parse := newAIParser(backend)
		scanner := bufio.NewScanner(stdout)
		scanner.Buffer(make([]byte, 0, 64*1024), 16*1024*1024)
		for scanner.Scan() {
			for _, ev := range parse(scanner.Text()) {
				events <- ev
			}
		}

		err = cmd.Wait()
		switch {
		case errors.Is(ctx.Err(), context.DeadlineExceeded):
			events <- aiEvent{kind: aiFailed, text: fmt.Sprintf("timed out after %s", aiTimeout)}
		case errors.Is(ctx.Err(), context.Canceled):
			events <- aiEvent{kind: aiFailed, text: "cancelled"}
		case err != nil:
			events <- aiEvent{kind: aiFailed, text: strings.TrimSpace(fmt.Sprintf("%v: %s", err, stderr.String()))}
		default:
			events <- aiEvent{kind: aiDone}
		}
	}()

	return run
}

func newAIParser(backend string) func(line string) []aiEvent {
	switch backend {
	case "claude":
		return parseClaudeLine
	case "codex":
		return newCodexParser()
	case "opencode":
		return newOpencodeParser()
	case "gemini":
		return newGeminiParser()
	default:
		return newPlainParser()
	}
}

func parseClaudeLine(line string) []aiEvent {
	var ev struct {
		Type      string `json:"type"`
		Subtype   string `json:"subtype"`
		SessionID string `json:"session_id"`
		IsError   bool   `json:"is_error"`
		Result    string `json:"result"`
		Message   struct {
			Content []struct {
				Type  string          `json:"type"`
				Text  string          `json:"text"`
				Name  string          `json:"name"`
				Input json.RawMessage `json:"input"`
			} `json:"content"`
		} `json:"message"`
	}
	if json.Unmarshal([]byte(line), &ev) != nil {
		return nil
	}

	var out []aiEvent
	switch ev.Type {
	case "system":
		if ev.Subtype == "init" && ev.SessionID != "" {
			out = append(out, aiEvent{kind: aiSession, text: ev.SessionID})
		}
	case "assistant":
		for _, c := range ev.Message.Content {
			switch c.Type {
			case "text":
				if strings.TrimSpace(c.Text) != "" {
					out = append(out, aiEvent{kind: aiMessage, text: c.Text})
				}
			case "tool_use":
				out = append(out, aiEvent{kind: aiStep, text: summarizeToolUse(c.Name, c.Input)})
			}
		}
	case "result":
		if ev.IsError {
			out = append(out, aiEvent{kind: aiFailed, text: ev.Result})
		} else if strings.TrimSpace(ev.Result) != "" {
			out = append(out, aiEvent{kind: aiMessage, text: ev.Result})
		}
	}
	return out
}

func summarizeToolUse(name string, input json.RawMessage) string {
	var fields map[string]any
	_ = json.Unmarshal(input, &fields)
	for _, key := range []string{"command", "file_path", "pattern", "url", "query", "description", "prompt"} {
		if v, ok := fields[key].(string); ok && v != "" {
			return name + ": " + oneLine(v, 100)
		}
	}
	return name
}

func newCodexParser() func(line string) []aiEvent {
	return func(line string) []aiEvent {
		var ev struct {
			Type     string `json:"type"`
			ThreadID string `json:"thread_id"`
			Message  string `json:"message"`
			Error    struct {
				Message string `json:"message"`
			} `json:"error"`
			Item struct {
				Type    string `json:"type"`
				Text    string `json:"text"`
				Command string `json:"command"`
			} `json:"item"`
		}
		if json.Unmarshal([]byte(line), &ev) != nil {
			return nil
		}

		switch {
		case ev.Type == "thread.started" && ev.ThreadID != "":
			return []aiEvent{{kind: aiSession, text: ev.ThreadID}}
		case ev.Type == "item.started" && ev.Item.Type == "command_execution":
			return []aiEvent{{kind: aiStep, text: "$ " + oneLine(ev.Item.Command, 100)}}
		case ev.Type == "item.completed" && ev.Item.Type == "agent_message":
			return []aiEvent{{kind: aiMessage, text: ev.Item.Text}}
		case ev.Type == "item.completed" && ev.Item.Type != "command_execution" && ev.Item.Type != "reasoning":
			return []aiEvent{{kind: aiStep, text: ev.Item.Type}}
		case ev.Type == "error":
			return []aiEvent{{kind: aiFailed, text: ev.Message}}
		case ev.Type == "turn.failed":
			return []aiEvent{{kind: aiFailed, text: ev.Error.Message}}
		}
		return nil
	}
}

func newOpencodeParser() func(line string) []aiEvent {
	sessionSeen := false
	var answer strings.Builder
	return func(line string) []aiEvent {
		var ev struct {
			Type      string `json:"type"`
			SessionID string `json:"sessionID"`
			Error     struct {
				Name string `json:"name"`
				Data struct {
					Message string `json:"message"`
				} `json:"data"`
			} `json:"error"`
			Part struct {
				Type  string `json:"type"`
				Text  string `json:"text"`
				Tool  string `json:"tool"`
				State struct {
					Input json.RawMessage `json:"input"`
				} `json:"state"`
			} `json:"part"`
		}
		if json.Unmarshal([]byte(line), &ev) != nil {
			return nil
		}

		var out []aiEvent
		if !sessionSeen && ev.SessionID != "" {
			sessionSeen = true
			out = append(out, aiEvent{kind: aiSession, text: ev.SessionID})
		}
		switch ev.Type {
		case "text":
			if strings.TrimSpace(ev.Part.Text) != "" {
				if answer.Len() > 0 {
					answer.WriteString("\n\n")
				}
				answer.WriteString(ev.Part.Text)
				out = append(out, aiEvent{kind: aiMessage, text: answer.String()})
			}
		case "tool_use":
			out = append(out, aiEvent{kind: aiStep, text: summarizeToolUse(ev.Part.Tool, ev.Part.State.Input)})
		case "error":
			msg := ev.Error.Data.Message
			if msg == "" {
				msg = ev.Error.Name
			}
			out = append(out, aiEvent{kind: aiFailed, text: msg})
		}
		return out
	}
}

func newGeminiParser() func(line string) []aiEvent {
	var answer strings.Builder
	return func(line string) []aiEvent {
		var ev struct {
			Type       string          `json:"type"`
			SessionID  string          `json:"session_id"`
			Role       string          `json:"role"`
			Content    string          `json:"content"`
			Delta      bool            `json:"delta"`
			ToolName   string          `json:"tool_name"`
			Parameters json.RawMessage `json:"parameters"`
			Status     string          `json:"status"`
			Message    string          `json:"message"`
			Error      struct {
				Message string `json:"message"`
			} `json:"error"`
		}
		if json.Unmarshal([]byte(line), &ev) != nil {
			return nil
		}

		switch ev.Type {
		case "init":
			if ev.SessionID != "" {
				return []aiEvent{{kind: aiSession, text: ev.SessionID}}
			}
		case "message":
			if ev.Role != "assistant" || ev.Content == "" {
				return nil
			}
			if !ev.Delta {
				answer.Reset()
			}
			answer.WriteString(ev.Content)
			return []aiEvent{{kind: aiMessage, text: answer.String()}}
		case "tool_use":
			return []aiEvent{{kind: aiStep, text: summarizeToolUse(ev.ToolName, ev.Parameters)}}
		case "error":
			return []aiEvent{{kind: aiFailed, text: cmp.Or(ev.Message, ev.Error.Message)}}
		case "result":
			if ev.Status == "error" {
				return []aiEvent{{kind: aiFailed, text: cmp.Or(ev.Error.Message, "gemini reported an error")}}
			}
		}
		return nil
	}
}

var ansiPattern = regexp.MustCompile(`\x1b\[[0-9;?]*[a-zA-Z]`)

func newPlainParser() func(line string) []aiEvent {
	var buf strings.Builder
	return func(line string) []aiEvent {
		buf.WriteString(ansiPattern.ReplaceAllString(line, ""))
		buf.WriteString("\n")
		return []aiEvent{{kind: aiMessage, text: buf.String()}}
	}
}

func oneLine(s string, limit int) string {
	s = strings.Join(strings.Fields(s), " ")
	if len(s) > limit {
		return s[:limit-1] + "…"
	}
	return s
}

// tailBuffer is an io.Writer that keeps only the last max bytes written.
type tailBuffer struct {
	max  int
	data []byte
}

func (b *tailBuffer) Write(p []byte) (int, error) {
	b.data = append(b.data, p...)
	if len(b.data) > b.max {
		b.data = b.data[len(b.data)-b.max:]
	}
	return len(p), nil
}

func (b *tailBuffer) String() string {
	return string(b.data)
}
