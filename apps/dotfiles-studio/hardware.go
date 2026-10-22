package main

import (
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"syscall"
)

const gib = 1024 * 1024 * 1024

var lspciRevision = regexp.MustCompile(`\s*\(rev [0-9a-f]+\)$`)

var vendorAliases = map[string]string{
	"Micro-Star International Co., Ltd.": "MSI",
	"ASUSTeK COMPUTER INC.":              "ASUS",
	"Gigabyte Technology Co., Ltd.":      "Gigabyte",
	"Hewlett-Packard":                    "HP",
}

func readMemory() string {
	data, err := os.ReadFile("/proc/meminfo")
	if err != nil {
		return "unknown"
	}
	kb := map[string]float64{}
	for _, line := range strings.Split(string(data), "\n") {
		fields := strings.Fields(line)
		if len(fields) < 2 {
			continue
		}
		if value, err := strconv.ParseFloat(fields[1], 64); err == nil {
			kb[strings.TrimSuffix(fields[0], ":")] = value
		}
	}
	total, ok := kb["MemTotal"]
	if !ok || total == 0 {
		return "unknown"
	}
	available, ok := kb["MemAvailable"]
	if !ok {
		return formatBytes(total * 1024)
	}
	return usageLine((total-available)*1024, total*1024, (total-available)/total)
}

func readMachine() string {
	vendor := shortVendor(readDMI("sys_vendor"))
	product := readDMI("product_name")
	board := readDMI("board_name")
	if board != "" && (product == "" || strings.Contains(board, product) || isPlaceholderDMI(product)) {
		vendor = firstNonEmpty(shortVendor(readDMI("board_vendor")), vendor)
		product = board
	}
	if isPlaceholderDMI(product) {
		return "unknown"
	}
	return strings.TrimSpace(vendor + " " + product)
}

func readGPU() string {
	out, err := exec.Command("lspci").Output()
	if err != nil {
		return "unknown"
	}
	var gpus []string
	for _, line := range strings.Split(string(out), "\n") {
		_, rest, ok := strings.Cut(line, " ")
		if !ok {
			continue
		}
		class, name, ok := strings.Cut(rest, ": ")
		if !ok || !isDisplayClass(class) {
			continue
		}
		name = lspciRevision.ReplaceAllString(name, "")
		name = strings.NewReplacer(" Corporation", "", " Inc.", "", "Advanced Micro Devices, Inc. ", "AMD ").Replace(name)
		gpus = append(gpus, strings.TrimSpace(name))
	}
	if len(gpus) == 0 {
		return "unknown"
	}
	return strings.Join(gpus, " · ")
}

func readStorage() string {
	root, ok := filesystemUsage("/")
	if !ok {
		return "unknown"
	}
	parts := []string{"/ " + root.line()}
	if home, err := os.UserHomeDir(); err == nil {
		if usage, ok := filesystemUsage(home); ok && usage.device != root.device {
			parts = append(parts, "~ "+usage.line())
		}
	}
	return strings.Join(parts, " · ")
}

func readDisks() string {
	entries, err := os.ReadDir("/sys/block")
	if err != nil {
		return "unknown"
	}
	var disks []string
	for _, entry := range entries {
		name := entry.Name()
		if isVirtualBlockDevice(name) {
			continue
		}
		dir := filepath.Join("/sys/block", name)
		sectors, err := strconv.ParseFloat(readTrimmed(filepath.Join(dir, "size")), 64)
		if err != nil || sectors == 0 {
			continue
		}
		label := firstNonEmpty(readTrimmed(filepath.Join(dir, "device", "model")), name)
		disks = append(disks, label+" "+formatBytes(sectors*512))
	}
	if len(disks) == 0 {
		return "unknown"
	}
	return strings.Join(disks, " · ")
}

type fsUsage struct {
	device    uint64
	used      float64
	available float64
	total     float64
}

func (u fsUsage) line() string {
	return usageLine(u.used, u.total, u.used/(u.used+u.available))
}

func filesystemUsage(path string) (fsUsage, bool) {
	var st syscall.Statfs_t
	if err := syscall.Statfs(path, &st); err != nil || st.Blocks == 0 {
		return fsUsage{}, false
	}
	var stat syscall.Stat_t
	if err := syscall.Stat(path, &stat); err != nil {
		return fsUsage{}, false
	}
	size := float64(st.Bsize)
	return fsUsage{
		device:    uint64(stat.Dev),
		used:      float64(st.Blocks-st.Bfree) * size,
		available: float64(st.Bavail) * size,
		total:     float64(st.Blocks) * size,
	}, true
}

func usageLine(used, total, ratio float64) string {
	return formatBytes(used) + " / " + formatBytes(total) + " used (" + strconv.Itoa(int(ratio*100+0.5)) + "%)"
}

func formatBytes(bytes float64) string {
	value := bytes / gib
	if value >= 1024 {
		return strconv.FormatFloat(value/1024, 'f', 1, 64) + " TB"
	}
	return strconv.FormatFloat(value, 'f', 1, 64) + " GB"
}

func isDisplayClass(class string) bool {
	return strings.HasPrefix(class, "VGA") || strings.HasPrefix(class, "3D") || strings.HasPrefix(class, "Display")
}

func isVirtualBlockDevice(name string) bool {
	for _, prefix := range []string{"loop", "zram", "ram", "dm-", "sr", "md", "nbd", "fd"} {
		if strings.HasPrefix(name, prefix) {
			return true
		}
	}
	return false
}

func isPlaceholderDMI(value string) bool {
	switch strings.ToLower(value) {
	case "", "to be filled by o.e.m.", "system product name", "default string", "not applicable", "none":
		return true
	}
	return false
}

func shortVendor(vendor string) string {
	if alias, ok := vendorAliases[vendor]; ok {
		return alias
	}
	if isPlaceholderDMI(vendor) {
		return ""
	}
	return vendor
}

func readDMI(field string) string {
	return readTrimmed(filepath.Join("/sys/class/dmi/id", field))
}

func readTrimmed(path string) string {
	data, err := os.ReadFile(path)
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(data))
}
