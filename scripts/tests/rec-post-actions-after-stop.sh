#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
tmp_dir="$(mktemp -d "$repo_root/.rec-post-stop-test.XXXXXX")"
runner=""
cleanup() {
  pkill -CONT -f "$tmp_dir/recorder-helper" 2>/dev/null || true
  pkill -TERM -f "$tmp_dir/recorder-helper" 2>/dev/null || true
  pkill -KILL -f "$tmp_dir/recorder-helper" 2>/dev/null || true
  if [[ -n "${runner:-}" ]] && kill -0 "$runner" 2>/dev/null; then
    kill -TERM "$runner" 2>/dev/null || true
    wait "$runner" 2>/dev/null || true
  fi
  rm -rf "$tmp_dir"
}
trap cleanup EXIT

helper="$tmp_dir/recorder-helper"
input="$tmp_dir/input"
actions="$tmp_dir/actions"
log="$tmp_dir/log"

cat >"$helper" <<'HELPER'
#!/usr/bin/env bash
sleep 0.25
exit 130
HELPER
chmod +x "$helper"

run_case() {
  local mode="$1"

  : >"$actions"
  : >"$log"
  rm -f "$input"
  mkfifo "$input"

  (
    set -euo pipefail
    source "$repo_root/scripts/rec/lib/capture.sh"
  start_overlay() { :; }
  stop_overlay() { :; }
    post_recording_actions() { printf 'post actions for %s\n' "$1" >>"$actions"; }
    run_recorder "$tmp_dir/out-$mode.mp4" "$helper"
  ) <"$input" >"$log" 2>&1 &
  runner=$!

  exec 3>"$input"
  sleep 0.15

  case "$mode" in
    q) printf q >&3;;
    ctrl-c) kill -INT "$runner" 2>/dev/null || true;;
  esac

  for _ in {1..100}; do
    [[ -s "$actions" ]] && break
    sleep 0.03
  done

  exec 3>&-
  if kill -0 "$runner" 2>/dev/null; then
    kill -TERM "$runner" 2>/dev/null || true
  fi
  wait "$runner" || true
  runner=""

  if ! grep -Fq "post actions for $tmp_dir/out-$mode.mp4" "$actions"; then
    echo "post recording actions did not run after $mode" >&2
    cat "$log" >&2
    exit 1
  fi
}

run_case q
run_case ctrl-c
