#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
tmp_dir="$(mktemp -d "$repo_root/.rec-pause-test.XXXXXX")"
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
ticks="$tmp_dir/ticks"
input="$tmp_dir/input"
log="$tmp_dir/log"

cat >"$helper" <<'HELPER'
#!/usr/bin/env bash
set -euo pipefail

ticks="$1"
(
  trap 'exit 0' INT TERM
  while :; do
    printf 'tick\n' >>"$ticks"
    sleep 0.05
  done
) &
child=$!

stop_child() {
  kill -INT "$child" 2>/dev/null || true
  wait "$child" 2>/dev/null || true
  exit 130
}

trap 'stop_child' INT TERM
wait "$child"
HELPER
chmod +x "$helper"
mkfifo "$input"

(
  source "$repo_root/scripts/rec/lib/capture.sh"
  start_overlay() { :; }
  stop_overlay() { :; }
  post_recording_actions() { :; }
  run_recorder "$tmp_dir/out.mp4" "$helper" "$ticks"
) <"$input" >"$log" 2>&1 &
runner=$!

exec 3>"$input"

for _ in {1..100}; do
  [[ -f "$ticks" ]] && [[ "$(wc -l <"$ticks")" -ge 3 ]] && break
  sleep 0.02
done

printf p >&3
sleep 0.15
paused_count="$(wc -l <"$ticks")"
sleep 0.30
after_pause_count="$(wc -l <"$ticks")"

if (( after_pause_count > paused_count )); then
  echo "recorder child kept writing while paused: before=$paused_count after=$after_pause_count" >&2
  cat "$log" >&2
  exit 1
fi

exec 3>&-
