package kernel

// Size is a dimension in terminal cells.
type Size struct {
	Width  int
	Height int
}

// IsZero reports whether the size has no drawable area.
func (s Size) IsZero() bool {
	return s.Width <= 0 || s.Height <= 0
}

// Area is the number of cells the size covers, or zero if it is degenerate.
func (s Size) Area() int {
	if s.IsZero() {
		return 0
	}
	return s.Width * s.Height
}

// Rect returns the size as a rectangle anchored at the origin.
func (s Size) Rect() Rect {
	return Rect{Width: s.Width, Height: s.Height}
}

// Fits reports whether the size is at least as large as other in both axes.
func (s Size) Fits(other Size) bool {
	return s.Width >= other.Width && s.Height >= other.Height
}

// Rect is an axis-aligned block of cells. X and Y are the top-left corner;
// Right and Bottom are exclusive.
type Rect struct {
	X      int
	Y      int
	Width  int
	Height int
}

// Right is the first column past the rectangle.
func (r Rect) Right() int {
	return r.X + r.Width
}

// Bottom is the first row past the rectangle.
func (r Rect) Bottom() int {
	return r.Y + r.Height
}

// Size is the rectangle's extent, discarding its position.
func (r Rect) Size() Size {
	return Size{Width: r.Width, Height: r.Height}
}

// IsEmpty reports whether the rectangle covers no cells.
func (r Rect) IsEmpty() bool {
	return r.Width <= 0 || r.Height <= 0
}

// Contains reports whether the cell at (x, y) lies inside the rectangle.
func (r Rect) Contains(x, y int) bool {
	if r.IsEmpty() {
		return false
	}
	return x >= r.X && x < r.Right() && y >= r.Y && y < r.Bottom()
}

// Inset shrinks the rectangle by n cells on every side, clamping at empty.
func (r Rect) Inset(n int) Rect {
	return r.InsetXY(n, n)
}

// InsetXY shrinks the rectangle by dx cells horizontally and dy vertically on
// each side, clamping at empty.
func (r Rect) InsetXY(dx, dy int) Rect {
	out := Rect{
		X:      r.X + dx,
		Y:      r.Y + dy,
		Width:  r.Width - 2*dx,
		Height: r.Height - 2*dy,
	}
	if out.Width < 0 {
		out.Width = 0
	}
	if out.Height < 0 {
		out.Height = 0
	}
	return out
}

// Translate moves the rectangle by (dx, dy) without resizing it.
func (r Rect) Translate(dx, dy int) Rect {
	r.X += dx
	r.Y += dy
	return r
}

// Overlaps reports whether the two rectangles share at least one cell.
func (r Rect) Overlaps(other Rect) bool {
	return !r.Intersect(other).IsEmpty()
}

// Intersect returns the overlap of the two rectangles, or an empty rectangle.
func (r Rect) Intersect(other Rect) Rect {
	if r.IsEmpty() || other.IsEmpty() {
		return Rect{}
	}
	x := max(r.X, other.X)
	y := max(r.Y, other.Y)
	right := min(r.Right(), other.Right())
	bottom := min(r.Bottom(), other.Bottom())
	if right <= x || bottom <= y {
		return Rect{}
	}
	return Rect{X: x, Y: y, Width: right - x, Height: bottom - y}
}

// Union returns the smallest rectangle containing both operands. An empty
// operand is ignored.
func (r Rect) Union(other Rect) Rect {
	if r.IsEmpty() {
		return other
	}
	if other.IsEmpty() {
		return r
	}
	x := min(r.X, other.X)
	y := min(r.Y, other.Y)
	right := max(r.Right(), other.Right())
	bottom := max(r.Bottom(), other.Bottom())
	return Rect{X: x, Y: y, Width: right - x, Height: bottom - y}
}

// Center returns a rectangle of the given size centred inside r, clipped to r.
func (r Rect) Center(s Size) Rect {
	w := min(s.Width, r.Width)
	h := min(s.Height, r.Height)
	if w < 0 {
		w = 0
	}
	if h < 0 {
		h = 0
	}
	return Rect{
		X:      r.X + (r.Width-w)/2,
		Y:      r.Y + (r.Height-h)/2,
		Width:  w,
		Height: h,
	}
}
