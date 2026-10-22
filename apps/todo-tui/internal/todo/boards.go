package todo

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"slices"
	"strconv"
	"strings"
	"time"
)

// MaxBoardDuration caps how long a timed board may run.
const MaxBoardDuration = 24 * time.Hour

// Lane names match the CLI's boards.json keys.
const (
	LaneNow   = "now"
	LaneLater = "later"
)

// Board is a curated view of tasks with two lanes. Lanes list root ids; a
// task's descendants follow the nearest listed ancestor. The CLI owns every
// write; the TUI only reads boards.json.
type Board struct {
	Name      string   `json:"name"`
	CreatedAt int64    `json:"createdAt"`
	ExpiresAt int64    `json:"expiresAt,omitempty"`
	Now       []string `json:"now"`
	Later     []string `json:"later"`
}

// Boards is the whole boards.json file.
type Boards struct {
	Active string  `json:"active,omitempty"`
	Boards []Board `json:"boards"`
}

// Timed reports whether the board ends by itself.
func (b Board) Timed() bool {
	return b.ExpiresAt > 0
}

// Expired reports whether a timed board has run out.
func (b Board) Expired(now time.Time) bool {
	return b.Timed() && now.UnixMilli() >= b.ExpiresAt
}

// Remaining is the time left on a timed board.
func (b Board) Remaining(now time.Time) time.Duration {
	return max(0, time.UnixMilli(b.ExpiresAt).Sub(now))
}

// LaneOf returns the lane a task shows in, or "" when it is not on the board.
func (b Board) LaneOf(all []Task, id string) string {
	parents := make(map[string]string, len(all))
	for _, t := range all {
		parents[t.ID] = t.ParentID
	}
	return b.laneOf(parents, id)
}

// Listed reports whether the id itself sits in a lane, rather than following an ancestor.
func (b Board) Listed(id string) bool {
	return slices.Contains(b.Now, id) || slices.Contains(b.Later, id)
}

func (b Board) laneOf(parents map[string]string, id string) string {
	seen := map[string]bool{}
	for current := id; current != "" && !seen[current]; current = parents[current] {
		switch {
		case slices.Contains(b.Now, current):
			return LaneNow
		case slices.Contains(b.Later, current):
			return LaneLater
		}
		seen[current] = true
	}
	return ""
}

// Members returns every task id on the board, in either lane.
func (b Board) Members(all []Task) map[string]bool {
	return b.lane(all, "")
}

// NowIDs returns the ids in the Now lane, descendants included.
func (b Board) NowIDs(all []Task) map[string]bool {
	return b.lane(all, LaneNow)
}

// LaterIDs returns the ids in the Later lane, descendants included.
func (b Board) LaterIDs(all []Task) map[string]bool {
	return b.lane(all, LaneLater)
}

func (b Board) lane(all []Task, want string) map[string]bool {
	parents := make(map[string]string, len(all))
	for _, t := range all {
		parents[t.ID] = t.ParentID
	}
	out := map[string]bool{}
	for _, t := range all {
		lane := b.laneOf(parents, t.ID)
		if lane != "" && (want == "" || lane == want) {
			out[t.ID] = true
		}
	}
	return out
}

// FilterLane keeps the pending tasks in one lane of a board.
func FilterLane(all []Task, b Board, lane string) []Task {
	ids := b.lane(all, lane)
	var out []Task
	for _, t := range all {
		if t.Pending() && ids[t.ID] {
			out = append(out, t)
		}
	}
	return out
}

// Find looks a board up by name, ignoring case like the CLI does.
func (s Boards) Find(name string) (Board, bool) {
	for _, b := range s.Boards {
		if strings.EqualFold(b.Name, name) {
			return b, true
		}
	}
	return Board{}, false
}

// ActiveBoard returns the active board, if any.
func (s Boards) ActiveBoard() (Board, bool) {
	if s.Active == "" {
		return Board{}, false
	}
	return s.Find(s.Active)
}

// AnyExpired reports whether a timed board has run out and still waits for the CLI to wrap it up.
func (s Boards) AnyExpired(now time.Time) bool {
	for _, b := range s.Boards {
		if b.Expired(now) {
			return true
		}
	}
	return false
}

// Live drops boards that have run out, for display while the CLI wraps them up.
func (s Boards) Live(now time.Time) Boards {
	out := Boards{Boards: make([]Board, 0, len(s.Boards))}
	for _, b := range s.Boards {
		if b.Expired(now) {
			continue
		}
		out.Boards = append(out.Boards, b)
		if strings.EqualFold(b.Name, s.Active) {
			out.Active = b.Name
		}
	}
	return out
}

// ParseTimedSpec reads the F prompt: "4h", "90m", "2h30m" or a bare hour
// count, with an optional board name after it: "4h deploy day".
func ParseTimedSpec(spec string) (time.Duration, string, error) {
	words := strings.Fields(spec)
	if len(words) == 0 {
		return 0, "", errors.New("give a duration, e.g. 4h")
	}
	d, err := parseDuration(words[0])
	if err != nil {
		return 0, "", err
	}
	if d > MaxBoardDuration {
		return 0, "", fmt.Errorf("a timed board lasts at most %dh", int(MaxBoardDuration.Hours()))
	}
	if d < time.Minute {
		return 0, "", errors.New("a timed board needs at least a minute")
	}
	return d, strings.Join(words[1:], " "), nil
}

func parseDuration(word string) (time.Duration, error) {
	if hours, err := strconv.ParseFloat(word, 64); err == nil {
		return time.Duration(hours * float64(time.Hour)), nil
	}
	d, err := time.ParseDuration(word)
	if err != nil {
		return 0, fmt.Errorf("not a duration: %s (try 4h or 90m)", word)
	}
	return d, nil
}

// BoardStore reads boards.json. Writes go through the CLI.
type BoardStore struct {
	Path string
}

// NewBoardStore points at boards.json in the data directory.
func NewBoardStore() *BoardStore {
	return &BoardStore{Path: filepath.Join(DataDir(), "boards.json")}
}

// Load reads the boards. A missing file is no boards.
func (s *BoardStore) Load() (Boards, error) {
	raw, err := os.ReadFile(s.Path)
	if errors.Is(err, os.ErrNotExist) {
		return Boards{}, nil
	}
	if err != nil {
		return Boards{}, err
	}
	var b Boards
	if err := json.Unmarshal(raw, &b); err != nil {
		return Boards{}, fmt.Errorf("could not read %s: %w", s.Path, err)
	}
	return b, nil
}

// NeedsMigration reports a pre-boards focus.json that the CLI has not converted yet.
func (s *BoardStore) NeedsMigration() bool {
	if _, err := os.Stat(s.Path); err == nil {
		return false
	}
	_, err := os.Stat(filepath.Join(filepath.Dir(s.Path), "focus.json"))
	return err == nil
}
