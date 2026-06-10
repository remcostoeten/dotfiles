package main

import (
	"bufio"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"
)

// reloadInfo is a snapshot of a port's reload activity for the TUI to render.
type reloadInfo struct {
	count int
	last  time.Time
}

// reloadTracker subscribes to live-reload SSE streams and counts the reload
// events they push, so the launcher can show "N reloads · Xs ago". Liveness
// itself is still decided by a cheap TCP probe (portActive); this only adds history.
type reloadTracker struct {
	mu    sync.Mutex
	stats map[int]*reloadInfo // keyed by port
}

var tracker = &reloadTracker{stats: map[int]*reloadInfo{}}

// snapshot returns the current count/last-time for a port (ok=false if never seen).
func (t *reloadTracker) snapshot(port int) (count int, last time.Time, ok bool) {
	t.mu.Lock()
	defer t.mu.Unlock()
	if s := t.stats[port]; s != nil {
		return s.count, s.last, true
	}
	return 0, time.Time{}, false
}

func (t *reloadTracker) bump(port int) {
	t.mu.Lock()
	defer t.mu.Unlock()
	s := t.stats[port]
	if s == nil {
		s = &reloadInfo{}
		t.stats[port] = s
	}
	s.count++
	s.last = time.Now()
}

// watch connects to a port's SSE stream and counts `data: reload` events,
// reconnecting forever (the watcher may not be up yet, or may restart). Run once
// per configured port in its own goroutine; it lives for the process lifetime.
func (t *reloadTracker) watch(port int) {
	url := "http://127.0.0.1:" + strconv.Itoa(port) + "/livereload"
	client := &http.Client{} // no timeout: the SSE connection is long-lived
	for {
		t.stream(client, url, port)
		time.Sleep(time.Second) // reconnect backoff
	}
}

func (t *reloadTracker) stream(client *http.Client, url string, port int) {
	resp, err := client.Get(url)
	if err != nil {
		return
	}
	defer resp.Body.Close()
	sc := bufio.NewScanner(resp.Body)
	for sc.Scan() {
		// Each rebuild broadcasts a "data: reload" line; the initial
		// "retry:" line on connect is ignored.
		if line := sc.Text(); strings.HasPrefix(line, "data:") && strings.Contains(line, "reload") {
			t.bump(port)
		}
	}
}
