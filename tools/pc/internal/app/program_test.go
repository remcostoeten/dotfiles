package app_test

import (
	"bytes"
	"testing"
	"time"

	"github.com/charmbracelet/x/exp/teatest/v2"
)

// TestProgramBootsAndQuits drives the real Bubble Tea loop rather than calling
// Update by hand. It covers what the model-level tests cannot: that the
// program starts, paints a frame to a terminal and shuts down cleanly.
//
// It deliberately asserts nothing about the middle of a key sequence. The
// renderer emits diffs, so what reaches the byte stream depends on which cells
// changed; the sequences themselves are asserted against real state in
// app_test.go, which is both stronger and stable.
func TestProgramBootsAndQuits(t *testing.T) {
	tm := teatest.NewTestModel(t, build(t, "ascii"), teatest.WithInitialTermSize(120, 40))

	teatest.WaitFor(t, tm.Output(), func(out []byte) bool {
		return bytes.Contains(out, []byte("Tuning"))
	}, teatest.WithDuration(5*time.Second))

	tm.Send(keyPress("q"))
	tm.WaitFinished(t, teatest.WithFinalTimeout(5*time.Second))
}
