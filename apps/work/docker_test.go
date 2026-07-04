package main

import (
	"reflect"
	"testing"
)

func TestUpTargets(t *testing.T) {
	full := Service{
		Name:     "regeljelease",
		StartAll: true,
		Services: []string{"regeljelease-php", "regeljelease-js", "regeljelease-sanity"},
	}
	if got := upTargets(full); got != nil {
		t.Fatalf("StartAll: got %v, want nil", got)
	}

	studio := Service{
		Name:     "studio",
		Services: []string{"regeljelease-sanity"},
	}
	want := []string{"regeljelease-sanity", "database", "mailer"}
	if got := upTargets(studio); !reflect.DeepEqual(got, want) {
		t.Fatalf("studio: got %v, want %v", got, want)
	}
}

func TestComposeProfilePrefix(t *testing.T) {
	if got := composeProfilePrefix(Service{Profile: "regeljelease"}); !reflect.DeepEqual(got, []string{"--profile", "regeljelease"}) {
		t.Fatalf("got %v", got)
	}
	if got := composeProfilePrefix(Service{}); got != nil {
		t.Fatalf("empty profile: got %v, want nil", got)
	}
}
