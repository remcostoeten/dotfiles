package main

import (
	"os"
	"testing"
)

func TestDraftRoundTrip(t *testing.T) {
	path, err := writeDraft("Fix login", "Steps:\n1. open\n2. fail")
	if err != nil {
		t.Fatal(err)
	}
	defer os.Remove(path)
	title, body, err := readDraft(path)
	if err != nil {
		t.Fatal(err)
	}
	if title != "Fix login" || body != "Steps:\n1. open\n2. fail" {
		t.Fatalf("got %q / %q", title, body)
	}
}

func TestEditorCommandAddsWaitFlag(t *testing.T) {
	c, gui, err := editorCommand("code", "/tmp/x.md")
	if err != nil {
		t.Fatal(err)
	}
	if !gui || c.Args[1] != "--wait" || c.Args[2] != "/tmp/x.md" {
		t.Fatalf("got gui=%v args=%v", gui, c.Args)
	}
	c, gui, _ = editorCommand("zed --wait", "/tmp/x.md")
	if !gui || len(c.Args) != 3 {
		t.Fatalf("duplicated wait flag: %v", c.Args)
	}
	c, gui, _ = editorCommand("nvim", "/tmp/x.md")
	if gui || len(c.Args) != 2 {
		t.Fatalf("nvim: gui=%v args=%v", gui, c.Args)
	}
}

func TestParseAgentPrompts(t *testing.T) {
	answer := "Sure.\n<<<PLAIN>>>\n## Goal\nFix login\n<<<END PLAIN>>>\n\n<<<CONTEXT>>>\n## Goal\nFix login\n## Context\nGo app\n<<<END CONTEXT>>>\n"
	plain, withContext := parseAgentPrompts(answer)
	if plain != "## Goal\nFix login" {
		t.Fatalf("plain: %q", plain)
	}
	if withContext != "## Goal\nFix login\n## Context\nGo app" {
		t.Fatalf("context: %q", withContext)
	}
}
