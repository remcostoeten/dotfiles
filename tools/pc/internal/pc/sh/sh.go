// Package sh runs the system tools the pc screens read from and write to.
package sh

import (
	"errors"
	"os/exec"
	"strconv"
	"strings"
)

// ErrSudoPassword means sudo wanted a password it could not prompt for.
var ErrSudoPassword = errors.New("sudo needs a password — run `sudo -v` in another terminal first")

// Run executes a program and returns its combined output.
func Run(name string, args ...string) (string, error) {
	out, err := exec.Command(name, args...).CombinedOutput()
	return string(out), err
}

// Exec executes a program, turning a failure into an error carrying its output.
func Exec(name string, args ...string) error {
	out, err := Run(name, args...)
	if err != nil {
		return failure(out, err)
	}
	return nil
}

// Sudo executes a program through non-interactive sudo.
func Sudo(args ...string) error {
	out, err := Run("sudo", append([]string{"-n"}, args...)...)
	if err == nil {
		return nil
	}
	if strings.Contains(out, "password") {
		return ErrSudoPassword
	}
	return failure(out, err)
}

// Atoi parses the integer part of a loosely formatted number, returning 0 when
// there is none.
func Atoi(s string) int {
	s = strings.TrimSpace(s)
	if i := strings.IndexByte(s, '.'); i >= 0 {
		s = s[:i]
	}
	n, err := strconv.Atoi(s)
	if err != nil {
		return 0
	}
	return n
}

func failure(out string, err error) error {
	if msg := strings.TrimSpace(out); msg != "" {
		return errors.New(msg)
	}
	return err
}
