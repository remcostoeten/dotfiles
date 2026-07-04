package main

import (
	"os/exec"
	"runtime"
)

// openURL launches the default browser for url (best-effort, non-blocking).
func openURL(url string) {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "darwin":
		cmd = exec.Command("open", url)
	default:
		cmd = exec.Command("xdg-open", url)
	}
	_ = cmd.Start()
}
