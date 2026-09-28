package layout

import (
	"slices"
	"testing"

	"pc/internal/tui/kernel"
)

func TestSizes(t *testing.T) {
	tests := []struct {
		name        string
		total       int
		constraints []Constraint
		want        []int
	}{
		{name: "no constraints", total: 100, want: nil},
		{name: "fixed plus flex", total: 100, constraints: []Constraint{Fixed(20), Flex(1)}, want: []int{20, 80}},
		{name: "fixed only leaves slack", total: 100, constraints: []Constraint{Fixed(20), Fixed(30)}, want: []int{20, 30}},
		{name: "fixed larger than container shrinks", total: 10, constraints: []Constraint{Fixed(20)}, want: []int{10}},
		{name: "overflow is taken from the tail", total: 10, constraints: []Constraint{Fixed(8), Fixed(8)}, want: []int{8, 2}},
		{name: "percent rounds to whole cells", total: 100, constraints: []Constraint{Percent(25), Flex(1)}, want: []int{25, 75}},
		{name: "percent rounds half up", total: 10, constraints: []Constraint{Percent(35), Flex(1)}, want: []int{4, 6}},
		{name: "percent over 100 is clipped by the container", total: 100, constraints: []Constraint{Percent(150)}, want: []int{100}},
		{name: "weighted flex", total: 100, constraints: []Constraint{Flex(1), Flex(3)}, want: []int{25, 75}},
		{name: "indivisible remainder goes to the first track", total: 10, constraints: []Constraint{Flex(1), Flex(1), Flex(1)}, want: []int{4, 3, 3}},
		{name: "min is satisfied before flex", total: 40, constraints: []Constraint{Min(30), Flex(1)}, want: []int{30, 10}},
		{name: "min is inert when there is room", total: 100, constraints: []Constraint{Min(30), Flex(1)}, want: []int{50, 50}},
		{name: "max caps and donates the surplus", total: 100, constraints: []Constraint{Max(30), Flex(1)}, want: []int{30, 70}},
		{name: "several caps cascade in one pass", total: 90, constraints: []Constraint{Max(10), Max(10), Flex(1)}, want: []int{10, 10, 70}},
		{name: "bounds apply to fixed too", total: 100, constraints: []Constraint{Fixed(50).AtMost(20), Flex(1)}, want: []int{20, 80}},
		{name: "negative total yields zeroes", total: -5, constraints: []Constraint{Flex(1), Fixed(3)}, want: []int{0, 0}},
		{name: "zero total yields zeroes", total: 0, constraints: []Constraint{Flex(1), Flex(2)}, want: []int{0, 0}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := Sizes(tt.total, tt.constraints...)
			if !slices.Equal(got, tt.want) {
				t.Fatalf("Sizes(%d) = %v, want %v", tt.total, got, tt.want)
			}
		})
	}
}

func TestSizesNeverExceedTheContainer(t *testing.T) {
	sets := [][]Constraint{
		{Fixed(30), Fixed(30), Fixed(30)},
		{Percent(60), Percent(60)},
		{Min(50), Min(50), Min(50)},
		{Fixed(10), Flex(1), Percent(50), Max(4)},
	}

	for _, cs := range sets {
		for total := 0; total <= 64; total++ {
			sum := 0
			for _, n := range Sizes(total, cs...) {
				if n < 0 {
					t.Fatalf("Sizes(%d, %v) produced a negative track", total, cs)
				}
				sum += n
			}
			if sum > total {
				t.Fatalf("Sizes(%d, %v) summed to %d", total, cs, sum)
			}
		}
	}
}

func TestColsTileWithoutGaps(t *testing.T) {
	r := kernel.Rect{X: 4, Y: 2, Width: 100, Height: 20}
	got := Cols(r, Fixed(28), Flex(1))

	want := []kernel.Rect{
		{X: 4, Y: 2, Width: 28, Height: 20},
		{X: 32, Y: 2, Width: 72, Height: 20},
	}
	if !slices.Equal(got, want) {
		t.Fatalf("Cols() = %+v, want %+v", got, want)
	}

	cursor := r.X
	for _, c := range got {
		if c.X != cursor {
			t.Fatalf("column starts at %d, want %d", c.X, cursor)
		}
		cursor = c.Right()
	}
	if cursor > r.Right() {
		t.Fatalf("columns overflow the container: %d > %d", cursor, r.Right())
	}
}

func TestRowsTileWithoutGaps(t *testing.T) {
	r := kernel.Rect{X: 0, Y: 0, Width: 80, Height: 24}
	got := Rows(r, Fixed(1), Flex(1), Fixed(1))

	want := []kernel.Rect{
		{X: 0, Y: 0, Width: 80, Height: 1},
		{X: 0, Y: 1, Width: 80, Height: 22},
		{X: 0, Y: 23, Width: 80, Height: 1},
	}
	if !slices.Equal(got, want) {
		t.Fatalf("Rows() = %+v, want %+v", got, want)
	}
}

func TestConstraintBoundsAreOrderIndependent(t *testing.T) {
	tests := []struct {
		name string
		c    Constraint
		in   int
		want int
	}{
		{name: "below min", c: Flex(1).AtLeast(10), in: 4, want: 10},
		{name: "above max", c: Flex(1).AtMost(10), in: 40, want: 10},
		{name: "inside both", c: Flex(1).AtLeast(5).AtMost(10), in: 7, want: 7},
		{name: "max below min collapses to max", c: Flex(1).AtLeast(20).AtMost(10), in: 15, want: 10},
		{name: "min above max collapses to min", c: Flex(1).AtMost(10).AtLeast(20), in: 15, want: 20},
		{name: "negative bounds are floored at zero", c: Flex(1).AtLeast(-5), in: -3, want: 0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := tt.c.clamp(tt.in); got != tt.want {
				t.Errorf("clamp(%d) = %d, want %d", tt.in, got, tt.want)
			}
		})
	}
}

func TestFlexWeightIsAtLeastOne(t *testing.T) {
	if got := Sizes(10, Flex(0), Flex(0)); !slices.Equal(got, []int{5, 5}) {
		t.Errorf("Sizes() = %v, want [5 5]", got)
	}
}
