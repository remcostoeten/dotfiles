package main

import (
	"net"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

// composeInfraServices are unprofiled compose services that site stacks depend on.
// Passed explicitly when StartAll is false (e.g. studio-only); omitted when
// StartAll is true because `compose --profile X up -d` starts them anyway.
var composeInfraServices = []string{"database", "mailer"}

// portActive reports whether something is accepting TCP connections on
// localhost:port. Used to show the live-reload badge only when the watcher's
// SSE server is up (it's gated behind LIVE_RELOAD, so it may well be off).
func portActive(port int) bool {
	if port == 0 {
		return false
	}
	conn, err := net.DialTimeout("tcp", net.JoinHostPort("127.0.0.1", strconv.Itoa(port)), 250*time.Millisecond)
	if err != nil {
		return false
	}
	_ = conn.Close()
	return true
}

// composePrefix is ["docker","compose"] when the v2 plugin is present, else
// ["docker-compose"] for older installs.
func composePrefix() []string {
	if err := exec.Command("docker", "compose", "version").Run(); err == nil {
		return []string{"docker", "compose"}
	}
	if _, err := exec.LookPath("docker-compose"); err == nil {
		return []string{"docker-compose"}
	}
	return []string{"docker", "compose"}
}

// projectName is the compose project name used to build container names.
func projectName(dir string) string {
	return filepath.Base(dir)
}

// runningContainers returns the set of running container names.
func runningContainers() map[string]bool {
	set := map[string]bool{}
	out, err := sh("", "docker", "ps", "--format", "{{.Names}}")
	if err != nil {
		return set
	}
	for _, line := range strings.Split(out, "\n") {
		if line != "" {
			set[line] = true
		}
	}
	return set
}

type svcState int

const (
	stStopped svcState = iota
	stPartial
	stRunning
)

// serviceState reports whether all/some/none of a Service's containers run.
func serviceState(dir string, s Service, running map[string]bool) svcState {
	proj := projectName(dir)
	up := 0
	for _, name := range s.Services {
		if running[proj+"-"+name+"-1"] {
			up++
		}
	}
	switch {
	case up == 0:
		return stStopped
	case up == len(s.Services):
		return stRunning
	default:
		return stPartial
	}
}

func composeArgs(extra ...string) []string {
	return append(composePrefix(), extra...)
}

func dcRun(dir string, args ...string) (string, error) {
	full := composeArgs(args...)
	return sh(dir, full[0], full[1:]...)
}

// composeProfilePrefix returns ["--profile", name] when the service has a profile.
func composeProfilePrefix(s Service) []string {
	if s.Profile == "" {
		return nil
	}
	return []string{"--profile", s.Profile}
}

// upTargets lists the compose service names passed to `up -d`.
func upTargets(s Service) []string {
	if s.StartAll {
		return nil
	}
	out := append([]string{}, s.Services...)
	return append(out, composeInfraServices...)
}

func startService(dir string, s Service) (string, error) {
	args := composeProfilePrefix(s)
	args = append(args, "up", "-d")
	args = append(args, upTargets(s)...)
	return dcRun(dir, args...)
}

func stopService(dir string, s Service) (string, error) {
	args := composeProfilePrefix(s)
	args = append(args, "stop")
	args = append(args, s.Services...)
	return dcRun(dir, args...)
}

func restartService(dir string, s Service) (string, error) {
	if serviceState(dir, s, runningContainers()) != stRunning {
		return startService(dir, s)
	}
	args := composeProfilePrefix(s)
	args = append(args, "restart")
	args = append(args, s.Services...)
	return dcRun(dir, args...)
}
