package main

import (
	"encoding/json"
	"os"
	"path/filepath"
)

func getCacheDir() string {
	base, err := os.UserCacheDir()
	if err != nil {
		base = filepath.Join(os.Getenv("HOME"), ".cache")
	}
	dir := filepath.Join(base, "gpr-github")
	_ = os.MkdirAll(dir, 0755)
	return dir
}

func loadCache(filename string, dest interface{}) bool {
	path := filepath.Join(getCacheDir(), filename)
	data, err := os.ReadFile(path)
	if err != nil {
		return false
	}
	err = json.Unmarshal(data, dest)
	return err == nil
}

func writeCache(filename string, data interface{}) {
	path := filepath.Join(getCacheDir(), filename)
	bytes, err := json.Marshal(data)
	if err == nil {
		_ = os.WriteFile(path, bytes, 0644)
	}
}
