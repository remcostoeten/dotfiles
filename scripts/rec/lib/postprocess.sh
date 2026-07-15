# rec engine — everything that happens after a clean capture: metrics,
# opening the result, and the post-capture prompt.
#
# Future post-processing belongs here: add a function, then wire it into
# post_capture_prompt's menu.

open_in_explorer() {
  local path="$1"
  local dir
  dir="$(dirname -- "$path")"
  # Reveal the file in a graphical file manager, selecting it where supported;
  # fall back to just opening the containing folder.
  if command -v nautilus >/dev/null 2>&1; then
    nautilus --select "$path" >/dev/null 2>&1 &
  elif command -v dolphin >/dev/null 2>&1; then
    dolphin --select "$path" >/dev/null 2>&1 &
  elif command -v nemo >/dev/null 2>&1; then
    nemo "$path" >/dev/null 2>&1 &
  elif command -v thunar >/dev/null 2>&1; then
    thunar "$dir" >/dev/null 2>&1 &
  elif command -v pcmanfm >/dev/null 2>&1; then
    pcmanfm "$dir" >/dev/null 2>&1 &
  else
    open_path "$dir"
  fi
}

open_in_vlc() {
  local path="$1"
  command -v vlc >/dev/null 2>&1 || { echo "vlc is not installed" >&2; return 1; }
  vlc "$path" >/dev/null 2>&1 &
}

open_in_browser() {
  local path="$1"
  local browser
  for browser in brave brave-browser brave-browser-stable; do
    if command -v "$browser" >/dev/null 2>&1; then
      "$browser" "file://$path" >/dev/null 2>&1 &
      return 0
    fi
  done
  echo "brave is not installed" >&2
  return 1
}

print_capture_metrics() {
  local out="$1"
  local size_bytes size dur res fps raw_fps

  size_bytes="$(stat -c '%s' -- "$out" 2>/dev/null || echo 0)"
  size="$(human_size "$size_bytes")"

  if command -v ffprobe >/dev/null 2>&1; then
    # Pull container duration and the first video stream's geometry/rate.
    dur="$(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 -- "$out" 2>/dev/null)"
    res="$(ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=s=x:p=0 -- "$out" 2>/dev/null)"
    raw_fps="$(ffprobe -v error -select_streams v:0 -show_entries stream=avg_frame_rate -of default=nw=1:nk=1 -- "$out" 2>/dev/null)"
    if [[ "$raw_fps" == */* && "${raw_fps#*/}" != 0 ]]; then
      fps="$(awk -v r="$raw_fps" 'BEGIN { split(r, p, "/"); printf "%g", p[1] / p[2] }')"
    else
      fps="$raw_fps"
    fi
  fi

  printf '  %sfile%s        %s\n' "$DIM" "$RESET" "$out"
  printf '  %sduration%s    %s\n' "$DIM" "$RESET" "$(human_duration "${dur:-}")"
  printf '  %ssize%s        %s\n' "$DIM" "$RESET" "$size"
  printf '  %sresolution%s  %s\n' "$DIM" "$RESET" "${res:-unknown}"
  printf '  %sfps%s         %s\n' "$DIM" "$RESET" "${fps:-unknown}"
}

# Editing (trim/strip/compress) only makes sense for mp4 output.
post_capture_can_edit() {
  [[ "$1" == *.mp4 ]] && command -v ffmpeg >/dev/null 2>&1
}

print_post_capture_menu() {
  local out="$1"
  printf '\n'
  printf 'Open:   %se%s explorer   %sv%s vlc   %sb%s browser\n' \
    "$MAGENTA" "$RESET" "$MAGENTA" "$RESET" "$MAGENTA" "$RESET"
  if post_capture_can_edit "$out"; then
    if edit_trim_available; then
      printf 'Edit:   %st%s trim   %sa%s strip-audio   %sc%s compress\n' \
        "$MAGENTA" "$RESET" "$MAGENTA" "$RESET" "$MAGENTA" "$RESET"
    else
      printf 'Edit:   %sa%s strip-audio   %sc%s compress\n' \
        "$MAGENTA" "$RESET" "$MAGENTA" "$RESET"
    fi
  fi
  if share_available; then
    printf 'Share:  %su%s upload + copy link\n' "$MAGENTA" "$RESET"
  fi
  printf 'Other:  %sd%s delete (asks first)   %sq%s / %sEnter%s keep and exit\n' \
    "$MAGENTA" "$RESET" "$MAGENTA" "$RESET" "$MAGENTA" "$RESET"
}

post_capture_prompt() {
  local out="$1"
  local key reply
  local finished=0

  # Only prompt when attached to an interactive terminal.
  [[ -t 0 && -t 1 ]] || return 0
  # Nothing to act on if the file is gone.
  [[ -f "$out" ]] || return 0

  setup_colors

  printf '\n%sCaptured successfully:%s %s\n' "$BOLD$GREEN" "$RESET" "$out"
  print_capture_metrics "$out"
  print_post_capture_menu "$out"

  # Ctrl-C here means "keep it, do nothing" — not "abort the script".
  trap 'finished=1' INT
  while (( finished == 0 )); do
    IFS= read -rsn1 key || break
    case "$key" in
      e|E) open_in_explorer "$out"; break;;
      v|V) open_in_vlc "$out"; break;;
      b|B) open_in_browser "$out"; break;;
      t|T)
        if post_capture_can_edit "$out"; then
          edit_trim "$out" || true
          print_post_capture_menu "$out"
        fi
        ;;
      a|A)
        if post_capture_can_edit "$out"; then
          edit_strip_audio "$out" || true
          print_post_capture_menu "$out"
        fi
        ;;
      c|C)
        if post_capture_can_edit "$out"; then
          edit_compress "$out" || true
          print_post_capture_menu "$out"
        fi
        ;;
      u|U)
        share_upload "$out" || true
        print_post_capture_menu "$out"
        ;;
      d|D)
        printf 'Delete %s? [y/N]: ' "$(basename -- "$out")"
        IFS= read -r reply || reply=""
        if [[ "$reply" =~ ^[yY] ]]; then
          if rm -f -- "$out"; then
            printf '%sRecording deleted.%s\n' "$YELLOW" "$RESET"
          fi
          trap - INT
          return 0
        fi
        printf 'Kept.\n'
        print_post_capture_menu "$out"
        ;;
      q|Q|""|$'\003') finished=1;;
    esac
  done
  trap - INT

  printf 'Recording kept: %s\n' "$out"
  return 0
}

post_recording_actions() {
  local out="$1"
  if [[ "$COPY_PATH" -eq 1 ]]; then
    copy_to_clipboard "$out" && echo "Copied path: $out"
  fi
  if [[ "$PLAY_AFTER" -eq 1 ]]; then
    open_path "$out"
  fi
  send_notification "Saved: $out"
  post_capture_prompt "$out"
}
