// twg.go routes every REST call through `twg api`, which signs requests with
// the twg CLI's own OAuth session (auto-refreshed). A manually-issued API token
// expires or misses scopes; the twg session does not, so it is preferred.
package jira

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"os/exec"
	"strings"
)

// HasTWG reports whether the twg CLI is on PATH.
func HasTWG() bool {
	_, err := exec.LookPath("twg")
	return err == nil
}

// NewTWG builds a Client whose REST calls are proxied by `twg api`.
func NewTWG(site string) *Client {
	return &Client{base: strings.TrimSuffix(site, "/"), twgSite: siteHost(site)}
}

func siteHost(site string) string {
	s := strings.TrimPrefix(site, "https://")
	s = strings.TrimPrefix(s, "http://")
	return strings.TrimSuffix(s, "/")
}

func (c *Client) twgDo(ctx context.Context, method, path string, body any, out any) error {
	args := []string{"api", "jira:" + path, "-X", method, "--site", c.twgSite}
	cmd := exec.CommandContext(ctx, "twg", args...)
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return err
		}
		cmd.Args = append(cmd.Args, "--input", "-")
		cmd.Stdin = bytes.NewReader(b)
	}
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		data := bytes.TrimSpace(stdout.Bytes())
		if len(data) > 0 && data[0] == '{' {
			return apiError(0, data)
		}
		msg := strings.TrimSpace(stderr.String())
		if msg == "" {
			msg = err.Error()
		}
		return fmt.Errorf("twg: %s", msg)
	}
	data := bytes.TrimSpace(stdout.Bytes())
	if out == nil || len(data) == 0 {
		return nil
	}
	if err := json.Unmarshal(data, out); err != nil {
		return fmt.Errorf("twg: unexpected output: %w", err)
	}
	return nil
}
