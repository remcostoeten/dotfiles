package kernel

import "testing"

func TestSize(t *testing.T) {
	tests := []struct {
		name   string
		size   Size
		zero   bool
		area   int
		fits   Size
		inside bool
	}{
		{name: "square", size: Size{10, 10}, area: 100, fits: Size{10, 10}, inside: true},
		{name: "wider than tall", size: Size{80, 24}, area: 1920, fits: Size{40, 10}, inside: true},
		{name: "too short", size: Size{80, 8}, area: 640, fits: Size{40, 10}},
		{name: "zero width", size: Size{0, 24}, zero: true, fits: Size{1, 1}},
		{name: "negative height", size: Size{80, -2}, zero: true, fits: Size{1, 1}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := tt.size.IsZero(); got != tt.zero {
				t.Errorf("IsZero() = %v, want %v", got, tt.zero)
			}
			if got := tt.size.Area(); got != tt.area {
				t.Errorf("Area() = %d, want %d", got, tt.area)
			}
			if got := tt.size.Fits(tt.fits); got != tt.inside {
				t.Errorf("Fits(%v) = %v, want %v", tt.fits, got, tt.inside)
			}
		})
	}
}

func TestRectContains(t *testing.T) {
	r := Rect{X: 2, Y: 3, Width: 4, Height: 5}

	tests := []struct {
		name string
		x, y int
		want bool
	}{
		{name: "top left corner", x: 2, y: 3, want: true},
		{name: "bottom right cell", x: 5, y: 7, want: true},
		{name: "right edge is exclusive", x: 6, y: 5},
		{name: "bottom edge is exclusive", x: 4, y: 8},
		{name: "left of", x: 1, y: 5},
		{name: "above", x: 4, y: 2},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := r.Contains(tt.x, tt.y); got != tt.want {
				t.Errorf("Contains(%d, %d) = %v, want %v", tt.x, tt.y, got, tt.want)
			}
		})
	}

	if (Rect{X: 1, Y: 1}).Contains(1, 1) {
		t.Error("an empty rect must contain nothing")
	}
}

func TestRectInset(t *testing.T) {
	tests := []struct {
		name string
		in   Rect
		by   int
		want Rect
	}{
		{name: "one cell border", in: Rect{0, 0, 10, 6}, by: 1, want: Rect{1, 1, 8, 4}},
		{name: "zero is identity", in: Rect{2, 2, 10, 6}, by: 0, want: Rect{2, 2, 10, 6}},
		{name: "over-inset clamps to empty", in: Rect{0, 0, 3, 3}, by: 2, want: Rect{2, 2, 0, 0}},
		{name: "negative grows", in: Rect{2, 2, 4, 4}, by: -1, want: Rect{1, 1, 6, 6}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := tt.in.Inset(tt.by); got != tt.want {
				t.Errorf("Inset(%d) = %+v, want %+v", tt.by, got, tt.want)
			}
		})
	}
}

func TestRectIntersectAndUnion(t *testing.T) {
	tests := []struct {
		name      string
		a, b      Rect
		intersect Rect
		union     Rect
		overlaps  bool
	}{
		{
			name:      "partial overlap",
			a:         Rect{0, 0, 10, 10},
			b:         Rect{5, 5, 10, 10},
			intersect: Rect{5, 5, 5, 5},
			union:     Rect{0, 0, 15, 15},
			overlaps:  true,
		},
		{
			name:      "touching edges do not overlap",
			a:         Rect{0, 0, 5, 5},
			b:         Rect{5, 0, 5, 5},
			intersect: Rect{},
			union:     Rect{0, 0, 10, 5},
		},
		{
			name:      "contained",
			a:         Rect{0, 0, 10, 10},
			b:         Rect{2, 2, 3, 3},
			intersect: Rect{2, 2, 3, 3},
			union:     Rect{0, 0, 10, 10},
			overlaps:  true,
		},
		{
			name:      "empty operand",
			a:         Rect{0, 0, 10, 10},
			b:         Rect{},
			intersect: Rect{},
			union:     Rect{0, 0, 10, 10},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := tt.a.Intersect(tt.b); got != tt.intersect {
				t.Errorf("Intersect() = %+v, want %+v", got, tt.intersect)
			}
			if got := tt.a.Union(tt.b); got != tt.union {
				t.Errorf("Union() = %+v, want %+v", got, tt.union)
			}
			if got := tt.a.Overlaps(tt.b); got != tt.overlaps {
				t.Errorf("Overlaps() = %v, want %v", got, tt.overlaps)
			}
		})
	}
}

func TestRectCenter(t *testing.T) {
	tests := []struct {
		name string
		in   Rect
		size Size
		want Rect
	}{
		{name: "even inside even", in: Rect{0, 0, 10, 10}, size: Size{4, 4}, want: Rect{3, 3, 4, 4}},
		{name: "odd remainder rounds down", in: Rect{0, 0, 10, 10}, size: Size{5, 5}, want: Rect{2, 2, 5, 5}},
		{name: "oversized clips to container", in: Rect{0, 0, 6, 4}, size: Size{20, 20}, want: Rect{0, 0, 6, 4}},
		{name: "respects origin", in: Rect{10, 5, 10, 10}, size: Size{2, 2}, want: Rect{14, 9, 2, 2}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := tt.in.Center(tt.size); got != tt.want {
				t.Errorf("Center(%v) = %+v, want %+v", tt.size, got, tt.want)
			}
		})
	}
}
