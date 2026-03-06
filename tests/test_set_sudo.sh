#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SET_SUDO="$ROOT/scripts/core/set-sudo"

PASS=0
FAIL=0
LAST_OUT=""
LAST_STATUS=0

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

mk_fakebin() {
  local dir
  dir="$(mktemp -d)"

  cat >"$dir/sudo" <<'EOF'
#!/usr/bin/bash
"$@"
EOF
  chmod +x "$dir/sudo"

  cat >"$dir/visudo" <<'EOF'
#!/usr/bin/bash
exit 0
EOF
  chmod +x "$dir/visudo"

  printf "%s\n" "$dir"
}

run_set_sudo() {
  local fakebin="$1"
  local sudoers_dir="$2"
  shift 2

  local tmp_out
  tmp_out="$(mktemp)"

  set +e
  PATH="$fakebin:/usr/bin:/bin" DOTFILES_SUDOERS_DIR="$sudoers_dir" "$SET_SUDO" "$@" >"$tmp_out" 2>&1
  LAST_STATUS=$?
  set -e
  LAST_OUT="$(cat "$tmp_out")"
  rm -f "$tmp_out"
}

test_enable_status_disable_cycle() {
  local fakebin sudoers_dir expected_file expected_line
  fakebin="$(mk_fakebin)"
  sudoers_dir="$(mktemp -d)"
  expected_file="$sudoers_dir/99-dotfiles-nopasswd-all-tester"
  expected_line="tester ALL=(ALL) NOPASSWD: ALL"

  run_set_sudo "$fakebin" "$sudoers_dir" enable --yes --user tester
  assert_status 0 || { rm -rf "$fakebin" "$sudoers_dir"; return 1; }
  assert_contains "enabled passwordless sudo for user=tester" || { rm -rf "$fakebin" "$sudoers_dir"; return 1; }
  [[ -f "$expected_file" ]] || { rm -rf "$fakebin" "$sudoers_dir"; return 1; }
  grep -Fqx "$expected_line" "$expected_file" || { rm -rf "$fakebin" "$sudoers_dir"; return 1; }

  run_set_sudo "$fakebin" "$sudoers_dir" status --user tester
  assert_status 0 || { rm -rf "$fakebin" "$sudoers_dir"; return 1; }
  assert_contains "enabled for user=tester" || { rm -rf "$fakebin" "$sudoers_dir"; return 1; }

  run_set_sudo "$fakebin" "$sudoers_dir" disable --yes --user tester
  assert_status 0 || { rm -rf "$fakebin" "$sudoers_dir"; return 1; }
  assert_contains "disabled passwordless sudo for user=tester" || { rm -rf "$fakebin" "$sudoers_dir"; return 1; }
  [[ ! -f "$expected_file" ]] || { rm -rf "$fakebin" "$sudoers_dir"; return 1; }

  run_set_sudo "$fakebin" "$sudoers_dir" status --user tester
  assert_status 1 || { rm -rf "$fakebin" "$sudoers_dir"; return 1; }
  assert_contains "not enabled for user=tester" || { rm -rf "$fakebin" "$sudoers_dir"; return 1; }

  rm -rf "$fakebin" "$sudoers_dir"
}

run_test() {
  local name="$1"
  if "$name"; then
    pass "$name"
  else
    fail "$name"
  fi
}

run_test test_enable_status_disable_cycle

printf "\nPassed: %d\nFailed: %d\n" "$PASS" "$FAIL"
[[ "$FAIL" -eq 0 ]]
