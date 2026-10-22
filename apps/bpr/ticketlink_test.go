package main

import (
	"os"
	"path/filepath"
	"testing"
)

func TestTicketBranchName(t *testing.T) {
	if got := ticketBranchName("MAR-2112", "PDP card color regression"); got != "MAR-2112-pdp-card-color-regression" {
		t.Errorf("got %q", got)
	}
}

func TestPRTitleFor(t *testing.T) {
	cases := []struct{ key, summary, fallback, want string }{
		{"MAR-2112", "RJL | PDP card color regression", "", "MAR-2112: PDP card color regression"},
		{"MAR-2112", "", "tweak colors for livechat", "MAR-2112: Tweak colors for livechat"},
		{"MAR-2112", "MAR-2112 already there", "", "MAR-2112 already there"},
	}
	for _, c := range cases {
		if got := prTitleFor(c.key, c.summary, c.fallback); got != c.want {
			t.Errorf("prTitleFor(%q) = %q, want %q", c.summary, got, c.want)
		}
	}
}

func TestWordOverlap(t *testing.T) {
	if wordOverlap(titleFromBranch("fix/pdp-card-color-regression"), "RJL | PDP card color regression") < 3 {
		t.Error("expected strong overlap")
	}
	if wordOverlap("Header alignment", "Nieuwe voertuigen tonen") != 0 {
		t.Error("expected no overlap")
	}
}

func TestBranchLink(t *testing.T) {
	dir := t.TempDir()
	for _, args := range [][]string{
		{"init", "-q", "-b", "main"},
		{"-c", "user.email=t@t", "-c", "user.name=t", "commit", "-q", "--allow-empty", "-m", "init"},
		{"checkout", "-q", "-b", "fix/pdp-card-color-regression"},
	} {
		if out, err := git(dir, args...); err != nil {
			t.Fatal(out)
		}
	}
	branch := "fix/pdp-card-color-regression"
	if !localBranchExists(dir, branch) || isDirty(dir) {
		t.Fatal("expected clean existing branch")
	}
	linkBranchTicket(dir, branch, "MAR-2112")
	if got := linkedTicket(dir, branch); got != "MAR-2112" {
		t.Errorf("linkedTicket = %q", got)
	}
	os.WriteFile(filepath.Join(dir, "x"), []byte("x"), 0o644)
	if !isDirty(dir) {
		t.Error("expected dirty")
	}
}
