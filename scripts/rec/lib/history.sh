# rec engine — persistence and replay of interactive setups.
# History lives in $HISTORY_FILE, newest first, capped at $HISTORY_LIMIT.

history_line() {
  printf 'ts=%s quality=%s preset=%s fps=%s audio=%s name=%s class=%s region=%s countdown=%s copy_path=%s play_after=%s notify=%s gif=%s outdir=%s prefix=%s\n' \
    "$(quote_value "$(date +%Y-%m-%dT%H:%M:%S%z)")" \
    "$(quote_value "$QUALITY")" \
    "$(quote_value "$PRESET")" \
    "$(quote_value "$FPS")" \
    "$(quote_value "$AUDIO")" \
    "$(quote_value "$NAME")" \
    "$(quote_value "$CLASS")" \
    "$(quote_value "$REGION")" \
    "$(quote_value "$COUNTDOWN")" \
    "$(quote_value "$COPY_PATH")" \
    "$(quote_value "$PLAY_AFTER")" \
    "$(quote_value "$NOTIFY")" \
    "$(quote_value "$GIF")" \
    "$(quote_value "$OUTDIR")" \
    "$(quote_value "$PREFIX")"
}

save_history() {
  local dir
  local tmp

  dir="$(dirname -- "$HISTORY_FILE")"
  mkdir -p "$dir"
  tmp="$(mktemp)"

  history_line >"$tmp"
  if [[ -f "$HISTORY_FILE" ]]; then
    grep -v '^[[:space:]]*$' "$HISTORY_FILE" | head -n "$((HISTORY_LIMIT - 1))" >>"$tmp" || true
  fi
  mv "$tmp" "$HISTORY_FILE"
}

history_entry() {
  local index="$1"
  [[ -f "$HISTORY_FILE" ]] || return 1
  grep -v '^[[:space:]]*$' "$HISTORY_FILE" | sed -n "$((index + 1))p"
}

apply_history_entry() {
  local index="$1"
  local line
  local ts quality preset fps audio name class region countdown copy_path play_after notify gif outdir prefix

  line="$(history_entry "$index")" || {
    echo "No rec history entry ~$index in $HISTORY_FILE" >&2
    exit 1
  }
  [[ -n "$line" ]] || {
    echo "No rec history entry ~$index in $HISTORY_FILE" >&2
    exit 1
  }

  eval "$line"
  QUALITY="$quality"
  PRESET="$preset"
  FPS="$fps"
  AUDIO="$audio"
  NAME="$name"
  CLASS="$class"
  REGION="$region"
  COUNTDOWN="$countdown"
  COPY_PATH="$copy_path"
  PLAY_AFTER="$play_after"
  NOTIFY="$notify"
  GIF="$gif"
  OUTDIR="$outdir"
  PREFIX="$prefix"
}

history_summary() {
  local index="$1"
  local line="$2"
  local ts quality preset fps audio name class region countdown copy_path play_after notify gif outdir prefix
  local target
  local flags=()

  eval "$line"
  if [[ "$region" -eq 1 ]]; then
    target="region"
  elif [[ -n "$class" ]]; then
    target="class:$class"
  elif [[ -n "$name" ]]; then
    target="name:$name"
  else
    target="active"
  fi

  [[ "$audio" -eq 1 ]] && flags+=("audio")
  [[ "$copy_path" -eq 1 ]] && flags+=("copy")
  [[ "$play_after" -eq 1 ]] && flags+=("play")
  [[ "$notify" -eq 1 ]] && flags+=("notify")
  [[ "$gif" -eq 1 ]] && flags+=("gif")

  printf '  rec ~'
  [[ "$index" -gt 0 ]] && printf '%s' "$index"
  printf '  %s  %s/%sfps  target=%s  countdown=%s  output=%s/%s-*' \
    "$ts" "$quality" "$fps" "$target" "$countdown" "$outdir" "$prefix"
  if [[ "${#flags[@]}" -gt 0 ]]; then
    printf '  flags=%s' "${flags[*]}"
  fi
  printf '\n'
}

show_history() {
  local line
  local index=0

  echo "rec history"
  echo "Stored in: $HISTORY_FILE"
  echo

  if [[ ! -f "$HISTORY_FILE" ]] || ! grep -q '[^[:space:]]' "$HISTORY_FILE"; then
    echo "No interactive configs saved yet."
    return 0
  fi

  while IFS= read -r line && [[ "$index" -lt "$HISTORY_LIMIT" ]]; do
    [[ -n "$line" ]] || continue
    history_summary "$index" "$line"
    index=$((index + 1))
  done <"$HISTORY_FILE"
}

history_index_from_arg() {
  local arg="$1"

  if [[ "$arg" == "~" || "$arg" == "$HOME" ]]; then
    printf '0\n'
    return 0
  fi
  if [[ "$arg" =~ ^~([0-9]|10)$ ]]; then
    printf '%s\n' "${BASH_REMATCH[1]}"
    return 0
  fi
  return 1
}
