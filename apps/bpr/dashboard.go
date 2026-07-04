package main

import "context"

// cmdDashboard launches the interactive TUI (PRs + tickets).
func cmdDashboard(_ context.Context, a *app) error {
	return runTUI(a)
}
