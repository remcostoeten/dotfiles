package render

import (
	"strings"
	"testing"

	"pc/internal/tui/kernel"
)

const bold = "\x1b[1m"
const reset = "\x1b[m"

func TestWidth(t *testing.T) {
	tests := []struct {
		name string
		in   string
		want int
	}{
		{name: "ascii", in: "hello", want: 5},
		{name: "empty", in: "", want: 0},
		{name: "escapes are free", in: bold + "hello" + reset, want: 5},
		{name: "wide runes count double", in: "日本語", want: 6},
		{name: "mixed", in: "go" + bold + "日" + reset + "!", want: 5},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := Width(tt.in); got != tt.want {
				t.Errorf("Width(%q) = %d, want %d", tt.in, got, tt.want)
			}
		})
	}
}

func TestTruncate(t *testing.T) {
	tests := []struct {
		name  string
		in    string
		width int
		tail  string
		want  string
	}{
		{name: "shorter than the limit", in: "abc", width: 10, want: "abc"},
		{name: "exact fit", in: "abcde", width: 5, want: "abcde"},
		{name: "cut with no tail", in: "abcdef", width: 3, want: "abc"},
		{name: "cut with a tail", in: "abcdef", width: 4, tail: "…", want: "abc…"},
		{name: "zero width", in: "abc", width: 0, want: ""},
		{name: "negative width", in: "abc", width: -3, want: ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := Truncate(tt.in, tt.width, tt.tail)
			if got != tt.want {
				t.Errorf("Truncate(%q, %d, %q) = %q, want %q", tt.in, tt.width, tt.tail, got, tt.want)
			}
			if Width(got) > max(0, tt.width) {
				t.Errorf("Truncate produced %d cells, want at most %d", Width(got), tt.width)
			}
		})
	}
}

func TestTruncateKeepsWideRunesWhole(t *testing.T) {
	got := Truncate("日本語", 3, "")
	if w := Width(got); w > 3 {
		t.Fatalf("Truncate cut inside a wide rune: %q is %d cells", got, w)
	}
}

func TestPadAndFit(t *testing.T) {
	tests := []struct {
		name  string
		in    string
		width int
		align Align
		want  string
	}{
		{name: "left", in: "ab", width: 5, align: Left, want: "ab   "},
		{name: "right", in: "ab", width: 5, align: Right, want: "   ab"},
		{name: "centre biases the extra cell right", in: "ab", width: 5, align: Center, want: " ab  "},
		{name: "already wide enough", in: "abcde", width: 5, align: Left, want: "abcde"},
		{name: "wider than requested is untouched", in: "abcdef", width: 3, align: Left, want: "abcdef"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := Pad(tt.in, tt.width, tt.align); got != tt.want {
				t.Errorf("Pad(%q, %d) = %q, want %q", tt.in, tt.width, got, tt.want)
			}
		})
	}

	if got := Fit("abcdef", 3, Left, ""); got != "abc" {
		t.Errorf("Fit must truncate as well as pad, got %q", got)
	}
	if got := Fit("ab", 4, Left, ""); got != "ab  " {
		t.Errorf("Fit() = %q, want %q", got, "ab  ")
	}
}

func TestPadIgnoresEscapeSequences(t *testing.T) {
	got := Pad(bold+"ab"+reset, 5, Left)
	if Width(got) != 5 {
		t.Fatalf("Pad produced %d cells, want 5", Width(got))
	}
	if !strings.HasPrefix(got, bold) {
		t.Error("Pad must not disturb the styling it was handed")
	}
}

func TestClip(t *testing.T) {
	tests := []struct {
		name string
		in   string
		size kernel.Size
		want []string
	}{
		{
			name: "pads short lines and adds rows",
			in:   "ab\ncd",
			size: kernel.Size{Width: 4, Height: 3},
			want: []string{"ab  ", "cd  ", "    "},
		},
		{
			name: "truncates long lines and drops rows",
			in:   "abcdef\nghijkl\nmnopqr",
			size: kernel.Size{Width: 3, Height: 2},
			want: []string{"abc", "ghi"},
		},
		{
			name: "empty input becomes blank rows",
			in:   "",
			size: kernel.Size{Width: 2, Height: 2},
			want: []string{"  ", "  "},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := Lines(Clip(tt.in, tt.size))
			if len(got) != len(tt.want) {
				t.Fatalf("Clip produced %d rows, want %d: %q", len(got), len(tt.want), got)
			}
			for i := range got {
				if got[i] != tt.want[i] {
					t.Errorf("row %d = %q, want %q", i, got[i], tt.want[i])
				}
			}
		})
	}

	if got := Clip("anything", kernel.Size{}); got != "" {
		t.Errorf("Clip to an empty size = %q, want %q", got, "")
	}
}

func TestClipAlwaysProducesARectangle(t *testing.T) {
	inputs := []string{"", "a", "日本語\nab", bold + "styled" + reset, strings.Repeat("x", 40)}

	for _, in := range inputs {
		size := kernel.Size{Width: 7, Height: 4}
		lines := Lines(Clip(in, size))
		if len(lines) != size.Height {
			t.Fatalf("Clip(%q) produced %d rows, want %d", in, len(lines), size.Height)
		}
		for i, l := range lines {
			if Width(l) != size.Width {
				t.Fatalf("Clip(%q) row %d is %d cells, want %d", in, i, Width(l), size.Width)
			}
		}
	}
}

func TestBlank(t *testing.T) {
	got := Lines(Blank(kernel.Size{Width: 3, Height: 2}))
	if len(got) != 2 || got[0] != "   " || got[1] != "   " {
		t.Errorf("Blank() = %q, want two rows of three spaces", got)
	}
	if Blank(kernel.Size{Width: 0, Height: 4}) != "" {
		t.Error("Blank of a degenerate size must be empty")
	}
}
