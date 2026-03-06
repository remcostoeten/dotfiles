#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PACKAGES_LIB="$ROOT/internal/lib/packages"

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
  cat >"$dir/dirname" <<'EOF'
#!/usr/bin/bash
/usr/bin/dirname "$@"
EOF
  chmod +x "$dir/dirname"
  printf "%s\n" "$dir"
}

add_fake_cmd() {
  local dir="$1"
  local name="$2"
  cat >"$dir/$name" <<EOF
#!/usr/bin/bash
echo fake-$name "\$@" >/dev/null
EOF
  chmod +x "$dir/$name"
}

run_pkg() {
  local fakebin="$1"
  local os="$2"
  local expr="$3"
  local tmp_out
  tmp_out="$(mktemp)"

  set +e
  PATH="$fakebin" /usr/bin/bash -c "source '$PACKAGES_LIB'; OS='$os'; $expr" >"$tmp_out" 2>&1
  LAST_STATUS=$?
  set -e
  LAST_OUT="$(cat "$tmp_out")"
  rm -f "$tmp_out"
}

test_pkg_update_macos_uses_brew() {
  local fakebin
  fakebin="$(mk_fakebin)"
  add_fake_cmd "$fakebin" brew

  run_pkg "$fakebin" "macos" "pkg_update dry-run"
  rm -rf "$fakebin"

  assert_status 0 && assert_contains "[dry-run] brew update"
}

test_pkg_install_linux_uses_apt_when_present() {
  local fakebin
  fakebin="$(mk_fakebin)"
  add_fake_cmd "$fakebin" apt-get

  run_pkg "$fakebin" "linux" "pkg_install_one ripgrep dry-run"
  rm -rf "$fakebin"

  assert_status 0 && assert_contains "[dry-run] sudo apt-get install -y ripgrep"
}

test_pkg_install_linux_uses_yay_when_no_apt() {
  local fakebin
  fakebin="$(mk_fakebin)"
  add_fake_cmd "$fakebin" yay

  run_pkg "$fakebin" "linux" "pkg_install_one ripgrep dry-run"
  rm -rf "$fakebin"

  assert_status 0 && assert_contains "[dry-run] yay -S --noconfirm --needed ripgrep"
}

test_go_package_maps_to_arch_name() {
  local fakebin
  fakebin="$(mk_fakebin)"
  add_fake_cmd "$fakebin" yay

  run_pkg "$fakebin" "linux" "pkg_install_one golang-go dry-run"
  rm -rf "$fakebin"

  assert_status 0 && assert_contains "[dry-run] yay -S --noconfirm --needed go"
}

run_test() {
  local name="$1"
  if "$name"; then
    pass "$name"
  else
    fail "$name"
  fi
}

run_test test_pkg_update_macos_uses_brew
run_test test_pkg_install_linux_uses_apt_when_present
run_test test_pkg_install_linux_uses_yay_when_no_apt
run_test test_go_package_maps_to_arch_name

printf "\nPassed: %d\nFailed: %d\n" "$PASS" "$FAIL"
[[ "$FAIL" -eq 0 ]]
