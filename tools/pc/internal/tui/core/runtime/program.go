package runtime

import (
	"os"

	tea "charm.land/bubbletea/v2"

	"pc/internal/tui/kernel"
)

// restoreSequence leaves the alternate screen, shows the cursor and resets
// styling. It is the last-resort path: every other restore should have run
// first, but a corrupted terminal is the one bug that outlives the process.
const restoreSequence = "\x1b[?1049l\x1b[?25h\x1b[0m"

// RestoreTerminal writes the reset sequence directly. It is safe to call more
// than once and safe to call when the terminal was never put into raw mode.
func RestoreTerminal() {
	_, _ = os.Stdout.WriteString(restoreSequence)
}

// Run starts the program and guarantees the terminal is returned to the user,
// whether the program exits cleanly, panics, or is killed by a signal that
// Bubble Tea's own handler did not finish.
func Run(m Model, opts ...tea.ProgramOption) (err error) {
	defer func() {
		if r := recover(); r != nil {
			RestoreTerminal()
			err = kernel.Errorf(kernel.KindInternal, "runtime.Run", "%v", r)
		}
	}()
	defer RestoreTerminal()

	if _, runErr := tea.NewProgram(m, opts...).Run(); runErr != nil {
		return kernel.Wrap(kernel.KindTerminal, "runtime.Run", runErr, "running the program")
	}
	return nil
}
