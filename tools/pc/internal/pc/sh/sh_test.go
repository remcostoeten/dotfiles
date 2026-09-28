package sh

import "testing"

func TestAtoi(t *testing.T) {
	tests := map[string]int{"42": 42, " 7 ": 7, "12.9": 12, "[N/A]": 0, "": 0}
	for in, want := range tests {
		if got := Atoi(in); got != want {
			t.Errorf("Atoi(%q) = %d, want %d", in, got, want)
		}
	}
}
