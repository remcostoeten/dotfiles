package layout

import "pc/internal/tui/kernel"

// Sizes resolves constraints against a total extent. The returned slice always
// has one entry per constraint and never sums to more than total.
func Sizes(total int, cs ...Constraint) []int {
	if len(cs) == 0 {
		return nil
	}
	if total < 0 {
		total = 0
	}

	sizes := make([]int, len(cs))
	settled := make([]bool, len(cs))
	used := 0

	for i, c := range cs {
		switch c.kind {
		case kindFixed:
			sizes[i] = c.clamp(c.value)
		case kindPercent:
			sizes[i] = c.clamp(roundPercent(c.value, total))
		default:
			continue
		}
		settled[i] = true
		used += sizes[i]
	}

	remaining := total - used
	if remaining < 0 {
		remaining = 0
	}
	distributeFlex(sizes, settled, cs, remaining)

	return shrinkToFit(sizes, total)
}

// distributeFlex hands the leftover extent to the unsettled tracks by weight,
// re-running whenever a bound clips a track so the clipped surplus reaches the
// tracks that can still absorb it.
func distributeFlex(sizes []int, settled []bool, cs []Constraint, remaining int) {
	for {
		var open []int
		for i := range cs {
			if !settled[i] {
				open = append(open, i)
			}
		}
		if len(open) == 0 {
			return
		}

		weights := make([]int, len(open))
		for k, i := range open {
			weights[k] = cs[i].weight
		}
		shares := distribute(remaining, weights)

		clipped := false
		for k, i := range open {
			bounded := cs[i].clamp(shares[k])
			if bounded == shares[k] {
				continue
			}
			sizes[i] = bounded
			settled[i] = true
			remaining -= bounded
			if remaining < 0 {
				remaining = 0
			}
			clipped = true
		}
		if clipped {
			continue
		}

		for k, i := range open {
			sizes[i] = shares[k]
			settled[i] = true
		}
		return
	}
}

// shrinkToFit removes any overflow from the tail so that the tracks always fit
// inside the container, even when the declared minimums cannot all be honoured.
func shrinkToFit(sizes []int, total int) []int {
	sum := 0
	for _, n := range sizes {
		sum += n
	}
	over := sum - total
	for i := len(sizes) - 1; i >= 0 && over > 0; i-- {
		take := min(over, sizes[i])
		sizes[i] -= take
		over -= take
	}
	return sizes
}

// distribute splits amount across weights using the largest-remainder method,
// breaking ties by the lowest index so the result is deterministic.
func distribute(amount int, weights []int) []int {
	out := make([]int, len(weights))
	if amount <= 0 {
		return out
	}
	total := 0
	for _, w := range weights {
		total += w
	}
	if total <= 0 {
		return out
	}

	remainders := make([]int, len(weights))
	assigned := 0
	for i, w := range weights {
		n := amount * w
		out[i] = n / total
		remainders[i] = n % total
		assigned += out[i]
	}

	for left := amount - assigned; left > 0; left-- {
		best := 0
		found := false
		for i, r := range remainders {
			if r > 0 && (!found || r > remainders[best]) {
				best = i
				found = true
			}
		}
		out[best]++
		remainders[best] = 0
	}
	return out
}

func roundPercent(pct, total int) int {
	if pct <= 0 || total <= 0 {
		return 0
	}
	return (pct*total + 50) / 100
}

// Cols splits a rectangle horizontally. The returned rectangles tile r from
// left to right without gaps or overlap.
func Cols(r kernel.Rect, cs ...Constraint) []kernel.Rect {
	widths := Sizes(r.Width, cs...)
	out := make([]kernel.Rect, len(widths))
	x := r.X
	for i, w := range widths {
		out[i] = kernel.Rect{X: x, Y: r.Y, Width: w, Height: r.Height}
		x += w
	}
	return out
}

// Rows splits a rectangle vertically. The returned rectangles tile r from top
// to bottom without gaps or overlap.
func Rows(r kernel.Rect, cs ...Constraint) []kernel.Rect {
	heights := Sizes(r.Height, cs...)
	out := make([]kernel.Rect, len(heights))
	y := r.Y
	for i, h := range heights {
		out[i] = kernel.Rect{X: r.X, Y: y, Width: r.Width, Height: h}
		y += h
	}
	return out
}
