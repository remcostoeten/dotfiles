package render

import (
	"strings"
	"testing"

	lipgloss "charm.land/lipgloss/v2"

	"pc/internal/tui/kernel"
)

func TestCompose(t *testing.T) {
	area := kernel.Rect{Width: 8, Height: 4}

	got := Lines(Compose(area,
		At(kernel.Rect{X: 0, Y: 0, Width: 8, Height: 1}, "top"),
		At(kernel.Rect{X: 0, Y: 1, Width: 3, Height: 2}, "ab\ncd"),
		At(kernel.Rect{X: 3, Y: 1, Width: 5, Height: 2}, "right"),
		At(kernel.Rect{X: 0, Y: 3, Width: 8, Height: 1}, "bottom"),
	))

	want := []string{
		"top",
		"ab right",
		"cd",
		"bottom",
	}
	if len(got) != len(want) {
		t.Fatalf("Compose produced %d rows, want %d: %q", len(got), len(want), got)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Errorf("row %d = %q, want %q", i, got[i], want[i])
		}
	}
}

func TestComposeClipsBlocksToTheirOwnRect(t *testing.T) {
	area := kernel.Rect{Width: 6, Height: 2}

	got := Lines(Compose(area,
		At(kernel.Rect{X: 0, Y: 0, Width: 3, Height: 1}, "overlong"),
		At(kernel.Rect{X: 3, Y: 0, Width: 3, Height: 1}, "ok"),
	))

	if got[0] != "oveok" {
		t.Errorf("row 0 = %q, want %q — a block must not spill into its neighbour", got[0], "oveok")
	}
}

func TestComposeSkipsEmptyBlocksAndAreas(t *testing.T) {
	if Compose(kernel.Rect{}) != "" {
		t.Error("composing into an empty area must produce nothing")
	}

	got := Compose(kernel.Rect{Width: 3, Height: 1}, At(kernel.Rect{}, "ignored"))
	if got != "" {
		t.Errorf("Compose() = %q, want an empty row — a block with no rect draws nothing", got)
	}
}

func TestOverlay(t *testing.T) {
	base := "aaaaa\nbbbbb\nccccc"

	got := Lines(Overlay(base, "XX\nYY", kernel.Rect{X: 1, Y: 1, Width: 2, Height: 2}))
	want := []string{"aaaaa", "bXXbb", "cYYcc"}

	for i := range want {
		if got[i] != want[i] {
			t.Errorf("row %d = %q, want %q", i, got[i], want[i])
		}
	}
}

func TestOverlayIsIdentityForNothingToDraw(t *testing.T) {
	base := "abc"
	if got := Overlay(base, "", kernel.Rect{X: 0, Y: 0, Width: 2, Height: 1}); got != base {
		t.Errorf("Overlay of empty content = %q, want %q", got, base)
	}
	if got := Overlay(base, "x", kernel.Rect{}); got != base {
		t.Errorf("Overlay into an empty rect = %q, want %q", got, base)
	}
}

func TestOverlayRespectsWideRunesInTheBase(t *testing.T) {
	got := Overlay("日本語", "x", kernel.Rect{X: 2, Y: 0, Width: 1, Height: 1})
	if w := Width(got); w != 6 {
		t.Fatalf("overlay changed the row width to %d, want 6: %q", w, got)
	}
}

func TestFillPaintsEveryCellIncludingPadding(t *testing.T) {
	size := kernel.Size{Width: 4, Height: 2}
	bg := lipgloss.Color("#112233")

	got := Fill("hi", size, bg)

	for i, line := range Lines(got) {
		if strings.Count(line, "48;2;17;34;51") == 0 {
			t.Errorf("row %d carries no background: %q", i, line)
		}
		if Width(line) != size.Width {
			t.Errorf("row %d is %d cells wide, want %d", i, Width(line), size.Width)
		}
	}
}

func TestFillKeepsCellsThatNamedTheirOwnBackground(t *testing.T) {
	size := kernel.Size{Width: 6, Height: 1}
	selected := lipgloss.NewStyle().Background(lipgloss.Color("#aabbcc")).Render("sel")

	got := Fill(selected, size, lipgloss.Color("#112233"))

	if !strings.Contains(got, "48;2;170;187;204") {
		t.Errorf("Fill overwrote an explicit background: %q", got)
	}
	if !strings.Contains(got, "48;2;17;34;51") {
		t.Errorf("Fill skipped the padding cells: %q", got)
	}
}

func TestFillWithoutAColourIsANoOp(t *testing.T) {
	if got := Fill("hi", kernel.Size{Width: 4, Height: 1}, nil); got != "hi" {
		t.Errorf("Fill(nil) = %q, want %q", got, "hi")
	}
}
