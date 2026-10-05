package layout

import "math"

const unbounded = math.MaxInt

type kind uint8

const (
	kindFixed kind = iota
	kindPercent
	kindFlex
)

// Constraint describes how one track of a Rows or Cols split claims space.
// Constraints are values; the bound helpers return copies.
type Constraint struct {
	kind   kind
	value  int
	weight int
	min    int
	max    int
}

// Fixed claims exactly n cells.
func Fixed(n int) Constraint {
	return Constraint{kind: kindFixed, value: n, min: 0, max: unbounded}
}

// Percent claims n percent of the container, rounded to whole cells.
func Percent(n int) Constraint {
	return Constraint{kind: kindPercent, value: n, min: 0, max: unbounded}
}

// Flex claims a share of whatever is left over, proportional to weight. A
// weight below one is treated as one.
func Flex(weight int) Constraint {
	if weight < 1 {
		weight = 1
	}
	return Constraint{kind: kindFlex, weight: weight, min: 0, max: unbounded}
}

// Min claims leftover space but never shrinks below n cells.
func Min(n int) Constraint {
	return Flex(1).AtLeast(n)
}

// Max claims leftover space but never grows past n cells.
func Max(n int) Constraint {
	return Flex(1).AtMost(n)
}

// AtLeast bounds the constraint from below.
func (c Constraint) AtLeast(n int) Constraint {
	if n < 0 {
		n = 0
	}
	c.min = n
	if c.max < c.min {
		c.max = c.min
	}
	return c
}

// AtMost bounds the constraint from above.
func (c Constraint) AtMost(n int) Constraint {
	if n < 0 {
		n = 0
	}
	c.max = n
	if c.min > c.max {
		c.min = c.max
	}
	return c
}

func (c Constraint) clamp(n int) int {
	if n < c.min {
		n = c.min
	}
	if n > c.max {
		n = c.max
	}
	if n < 0 {
		n = 0
	}
	return n
}
