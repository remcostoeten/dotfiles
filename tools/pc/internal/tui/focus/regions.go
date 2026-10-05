package focus

import (
	"slices"
	"strings"

	"pc/internal/tui/kernel"
)

// ordered sorts regions by their declared traversal order, breaking ties by id
// so that the ring is stable across rebuilds.
func ordered(regions []Region) []Region {
	out := slices.Clone(regions)
	slices.SortStableFunc(out, func(a, b Region) int {
		if a.Order != b.Order {
			return a.Order - b.Order
		}
		return strings.Compare(string(a.ID), string(b.ID))
	})
	return out
}

func contains(regions []Region, id ID) bool {
	return slices.ContainsFunc(regions, func(r Region) bool { return r.ID == id })
}

// reachable reports whether a region exists and can hold focus. A region that
// declared itself Skip — an empty list, a disabled control — is present on
// screen but out of the ring.
func reachable(regions []Region, id ID) bool {
	if id.IsZero() {
		return false
	}
	return slices.ContainsFunc(regions, func(r Region) bool { return r.ID == id && !r.Skip })
}

func reachableRegions(regions []Region) []Region {
	out := make([]Region, 0, len(regions))
	for _, r := range regions {
		if !r.Skip {
			out = append(out, r)
		}
	}
	return out
}

func firstReachable(regions []Region) ID {
	for _, r := range regions {
		if !r.Skip {
			return r.ID
		}
	}
	return ""
}

// nearest picks the surviving region closest in declared order to a region
// that has gone away, so that focus lands where the user was looking.
func nearest(regions []Region, order int) ID {
	best := ID("")
	bestDistance := 0
	for _, r := range regions {
		if r.Skip {
			continue
		}
		d := r.Order - order
		if d < 0 {
			d = -d
		}
		if best.IsZero() || d < bestDistance {
			best, bestDistance = r.ID, d
		}
	}
	return best
}

// inDirection reports whether to lies beyond from along d, comparing the
// leading edges so that adjacent panels of different sizes still qualify.
func inDirection(d Dir, from, to kernel.Rect) bool {
	switch d {
	case Up:
		return to.Y < from.Y
	case Down:
		return to.Y > from.Y
	case Left:
		return to.X < from.X
	default:
		return to.X > from.X
	}
}

// distance scores a candidate, lower being better. A region that shares any
// span with the source on the cross axis — one actually beside or above it —
// always beats one that merely happens to be nearby diagonally.
func distance(d Dir, from, to kernel.Rect) int {
	fx, fy := centre(from)
	tx, ty := centre(to)

	primary, cross := abs(ty-fy), abs(tx-fx)
	if d == Left || d == Right {
		primary, cross = abs(tx-fx), abs(ty-fy)
	}

	score := primary + cross*4
	if !alignedAcross(d, from, to) {
		score += offAxisPenalty
	}
	return score
}

// offAxisPenalty exceeds any on-screen distance, so it orders diagonal
// candidates behind every aligned one rather than merely discouraging them.
const offAxisPenalty = 1 << 20

// alignedAcross reports whether the two rectangles share any span on the axis
// perpendicular to the movement.
func alignedAcross(d Dir, from, to kernel.Rect) bool {
	if d == Left || d == Right {
		return from.Y < to.Bottom() && to.Y < from.Bottom()
	}
	return from.X < to.Right() && to.X < from.Right()
}

func centre(r kernel.Rect) (int, int) {
	return r.X + r.Width/2, r.Y + r.Height/2
}

func abs(n int) int {
	if n < 0 {
		return -n
	}
	return n
}

func lower(s string) string {
	return strings.ToLower(s)
}
