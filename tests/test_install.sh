#!/usr/bin/env bash
set -u

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INSTALL="$ROOT/install"

PASS=0
FAIL=0

LAST_OUT=""
LAST_STATUS=0

strip_ansi() {
  sed -E 's/\x1B\[[0-9;]*[A-Za-z]//g'
}

run_cmd() {
  local tmp_home
  local tmp_out
  tmp_home="$(mktemp -d)"
  tmp_out="$(mktemp)"

  set +e
  HOME="$tmp_home" "$@" >"$tmp_out" 2>&1
  LAST_STATUS=$?
  set -e
  LAST_OUT="$(strip_ansi < "$tmp_out")"

  rm -f "$tmp_out"
  rm -rf "$tmp_home"
}

pass() {
  printf "ok - %s\n" "$1"
  PASS=$((PASS + 1))
}

fail() {
  printf "not ok - %s\n" "$1"
  printf "  status: %s\n" "$LAST_STATUS"
  printf "  output:\n"
  printf "%s\n" "$LAST_OUT" | sed 's/^/    /'
  FAIL=$((FAIL + 1))
}

assert_status() {
  local expected="$1"
  [[ "$LAST_STATUS" -eq "$expected" ]]
}

assert_contains() {
  local needle="$1"
  [[ "$LAST_OUT" == *"$needle"* ]]
}

test_help_overview() {
  run_cmd "$INSTALL" help
  assert_status 0 && assert_contains "Usage:" && assert_contains "Modules:" && assert_contains "Vendors:"
}

test_list() {
  run_cmd "$INSTALL" list
  assert_status 0 && assert_contains "fish" && assert_contains "golang"
}

test_help_targets() {
  run_cmd "$INSTALL" help fish
  assert_status 0 && assert_contains "dotfiles install fish"

  run_cmd "$INSTALL" help go
  assert_status 0 && assert_contains "dotfiles install go"
}

test_unknown_target_fails() {
  run_cmd "$INSTALL" install does-not-exist
  assert_status 1 && assert_contains "unknown target: does-not-exist"
}

test_dry_run_all() {
  run_cmd "$INSTALL" install --dry-run
  assert_status 0 && assert_contains "os=" && assert_contains "mode=dry-run" && assert_contains "module=fish" && assert_contains "module=scripts" && assert_contains "[ok] done"
}

test_dry_run_specific_targets() {
  run_cmd "$INSTALL" install --dry-run fish go
  assert_status 0 && assert_contains "module=fish" && assert_contains "vendor=golang" && assert_contains "[ok] done"
}

test_scripts_manifest_includes_set_sudo() {
  run_cmd "$INSTALL" install --dry-run scripts
  assert_status 0 && assert_contains "set-sudo" && assert_contains ".local/bin/set-sudo"
}

run_test() {
  local name="$1"
  if "$name"; then
    pass "$name"
  else
    fail "$name"
  fi
}

set -e

run_test test_help_overview
run_test test_list
run_test test_help_targets
run_test test_unknown_target_fails
run_test test_dry_run_all
run_test test_dry_run_specific_targets
run_test test_scripts_manifest_includes_set_sudo

printf "\nPassed: %d\nFailed: %d\n" "$PASS" "$FAIL"

if [[ "$FAIL" -ne 0 ]]; then
  exit 1
fi
