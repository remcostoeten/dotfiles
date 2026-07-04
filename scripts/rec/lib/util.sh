# rec engine — small shared utilities: arg validation, opening paths,
# clipboard, notifications, countdown, and human-readable formatting.

need_value() {
  local opt="$1"
  local value="${2-}"
  [[ -n "$value" ]] || { echo "$opt requires a value" >&2; exit 1; }
  printf '%s\n' "$value"
}

quote_value() {
  printf '%q' "$1"
}

open_path() {
  local path="$1"
  command -v xdg-open >/dev/null 2>&1 || { echo "xdg-open is not installed" >&2; return 1; }
  xdg-open "$path" >/dev/null 2>&1 &
}

copy_to_clipboard() {
  local value="$1"
  if command -v wl-copy >/dev/null 2>&1 && [[ "${XDG_SESSION_TYPE-}" == "wayland" ]]; then
    printf '%s' "$value" | wl-copy
  elif command -v xclip >/dev/null 2>&1; then
    printf '%s' "$value" | xclip -selection clipboard
  elif command -v wl-copy >/dev/null 2>&1; then
    printf '%s' "$value" | wl-copy
  else
    echo "No clipboard tool found (need xclip or wl-copy)" >&2
    return 1
  fi
}

send_notification() {
  [[ "$NOTIFY" -eq 1 ]] || return 0
  command -v notify-send >/dev/null 2>&1 || return 0
  notify-send "rec" "$1" >/dev/null 2>&1 || true
}

run_countdown() {
  local seconds="$1"
  local left
  [[ "$seconds" =~ ^[0-9]+$ ]] || { echo "invalid countdown: $seconds" >&2; exit 1; }
  for ((left = seconds; left > 0; left--)); do
    printf 'Recording starts in %s...\r' "$left"
    sleep 1
  done
  if [[ "$seconds" -gt 0 ]]; then printf '\n'; fi
}

human_size() {
  local bytes="$1"
  if command -v numfmt >/dev/null 2>&1; then
    numfmt --to=iec --suffix=B --format='%.1f' "$bytes" 2>/dev/null && return 0
  fi
  printf '%s B' "$bytes"
}

human_duration() {
  # seconds (may be fractional) -> H:MM:SS or M:SS
  local total="${1%.*}"
  [[ "$total" =~ ^[0-9]+$ ]] || { printf 'unknown'; return 0; }
  local h=$((total / 3600)) m=$(((total % 3600) / 60)) s=$((total % 60))
  if (( h > 0 )); then
    printf '%d:%02d:%02d' "$h" "$m" "$s"
  else
    printf '%d:%02d' "$m" "$s"
  fi
}
