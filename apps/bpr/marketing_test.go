package main

import "testing"

func TestTitleFromBranch(t *testing.T) {
	cases := map[string]string{
		"fix/header-alignemtn-error": "Header alignemtn error",
		"feat/somefeature":           "Somefeature",
		"feature/some-feature-name":  "Some feature name",
		"chore/bump_deps":            "Bump deps",
		"hotfix/MAR-12-broken-menu":  "Broken menu",
		"tmp/scratch/nested-thing":   "Scratch nested thing",
		"quickfix/  spaced--out ":    "Spaced out",
		"no-prefix-here":             "No prefix here",
	}
	for in, want := range cases {
		if got := titleFromBranch(in); got != want {
			t.Errorf("titleFromBranch(%q) = %q, want %q", in, got, want)
		}
	}
}
