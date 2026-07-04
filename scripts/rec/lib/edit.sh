# rec engine — post-capture editing. Currently: GUI-assisted trim via mpv.
#
# The trim flow opens the recording in mpv, where the user marks the start and
# end points by pressing keys (with on-screen confirmation), then closes mpv.
# rec reads the marks and cuts a new "<name>-trim.<ext>" losslessly, leaving the
# original untouched. If the marks can't be read automatically, it falls back to
# asking for the timecodes in the terminal.

# Is the GUI trim flow usable on this machine?
edit_trim_available() {
  command -v ffmpeg >/dev/null 2>&1 && command -v mpv >/dev/null 2>&1
}

# Convert a timecode to seconds. Accepts: 12, 12.5, 1:23, 1:23.4, 1:02:03.
# Prints the numeric seconds on success; returns non-zero on bad input.
parse_timecode() {
  local tc="$1"
  awk -v t="$tc" 'BEGIN {
    n = split(t, p, ":")
    if (n < 1 || n > 3) { exit 1 }
    secs = 0
    for (i = 1; i <= n; i++) {
      if (p[i] !~ /^[0-9]+(\.[0-9]+)?$/) { exit 1 }
      secs = secs * 60 + p[i]
    }
    printf "%.3f", secs
  }'
}

# Print the clear, step-by-step instructions for the mpv marking session.
edit_trim_instructions() {
  printf '\n%s%sTrim — set the start and end of your clip%s\n' "$BOLD" "$CYAN" "$RESET"
  printf '%sThe clip will open in the mpv video player. In that window:%s\n' "$DIM" "$RESET"
  printf '\n'
  printf '   %s1.%s Seek to where the clip should %sSTART%s, then press   %si%s\n' "$BOLD" "$RESET" "$BOLD" "$RESET" "$GREEN" "$RESET"
  printf '   %s2.%s Seek to where the clip should %sEND%s,   then press   %so%s\n' "$BOLD" "$RESET" "$BOLD" "$RESET" "$GREEN" "$RESET"
  printf '   %s3.%s Press %sq%s to close mpv and create the trimmed clip\n' "$BOLD" "$RESET" "$GREEN" "$RESET"
  printf '\n'
  printf '%s   • Seek by dragging the bar at the bottom, or arrow keys (←/→).%s\n' "$DIM" "$RESET"
  printf '%s   • Each press shows an "IN set" / "OUT set" confirmation on the video.%s\n' "$DIM" "$RESET"
  printf '%s   • Re-press i or o anytime to correct a mark — the last one wins.%s\n' "$DIM" "$RESET"
  printf '%s   • The original recording is kept; the trim is saved as a new file.%s\n' "$DIM" "$RESET"
  printf '\n'
}

# Run the GUI marking session; on success sets TRIM_IN / TRIM_OUT (seconds).
# Returns non-zero if the user cancelled or gave no usable marks.
edit_trim_collect_marks() {
  local out="$1"
  local conf marks raw_in raw_out
  TRIM_IN=""; TRIM_OUT=""

  conf="$(mktemp --tmpdir rec-mpv.XXXXXX.conf)"
  marks="$(mktemp --tmpdir rec-mpv.XXXXXX.marks)"

  # Bind i/o to print the raw timestamp (machine-readable) and flash a clear
  # on-screen confirmation (human-readable, formatted as a timecode).
  {
    printf 'i print-text "REC_MARK_IN=${=time-pos}" ; show-text "IN  set  →  ${time-pos}   (start of clip)" 2500\n'
    printf 'o print-text "REC_MARK_OUT=${=time-pos}" ; show-text "OUT set  →  ${time-pos}   (end of clip)" 2500\n'
  } >"$conf"

  # --keep-open keeps the last frame visible so the END can be marked at EOF.
  # The big startup banner restates the controls right on the video.
  mpv --input-conf="$conf" \
      --keep-open=yes \
      --osd-duration=4500 \
      --osd-playing-msg='rec trim    i = mark START      o = mark END      q = done' \
      -- "$out" >"$marks" 2>/dev/null || true

  raw_in="$(grep '^REC_MARK_IN=' "$marks" 2>/dev/null | tail -1 | cut -d= -f2 | tr -dc '0-9.')"
  raw_out="$(grep '^REC_MARK_OUT=' "$marks" 2>/dev/null | tail -1 | cut -d= -f2 | tr -dc '0-9.')"
  rm -f "$conf" "$marks"

  # Fall back to manual entry for whichever mark wasn't captured in mpv.
  if [[ -z "$raw_in" ]]; then
    echo "No START mark was read from mpv."
    raw_in="$(parse_timecode "$(prompt_text 'Start time (e.g. 0:05 or 5)' '0')")" || raw_in=""
  fi
  if [[ -z "$raw_out" ]]; then
    echo "No END mark was read from mpv."
    raw_out="$(prompt_text 'End time (e.g. 1:30, blank = end of recording)' '')"
    if [[ -z "$raw_out" ]]; then
      raw_out="$(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 -- "$out" 2>/dev/null)"
    else
      raw_out="$(parse_timecode "$raw_out")" || raw_out=""
    fi
  fi

  [[ -n "$raw_in" && -n "$raw_out" ]] || { echo "Trim cancelled: missing start/end." >&2; return 1; }

  # End must be after start.
  if ! awk -v a="$raw_in" -v b="$raw_out" 'BEGIN { exit !(b > a) }'; then
    echo "Trim cancelled: end ($raw_out s) is not after start ($raw_in s)." >&2
    return 1
  fi

  TRIM_IN="$raw_in"; TRIM_OUT="$raw_out"
}

# Trim entry point used by the post-capture prompt.
edit_trim() {
  local out="$1"
  local base ext trimmed dur

  if ! edit_trim_available; then
    echo "Trim needs both ffmpeg and mpv installed." >&2
    return 1
  fi

  edit_trim_instructions
  printf 'Opening %s in mpv...\n' "$(basename -- "$out")"
  edit_trim_collect_marks "$out" || return 1

  # Build "<name>-trim.<ext>" next to the original.
  ext="${out##*.}"
  base="${out%.*}"
  trimmed="${base}-trim.${ext}"

  # Duration for an unambiguous, fast, lossless stream-copy cut.
  dur="$(awk -v a="$TRIM_IN" -v b="$TRIM_OUT" 'BEGIN { printf "%.3f", b - a }')"

  printf 'Cutting %s → %s ... (%.1fs)\n' "$TRIM_IN" "$TRIM_OUT" "$dur"
  if ! ffmpeg -nostdin -hide_banner -loglevel warning -y \
        -ss "$TRIM_IN" -i "$out" -t "$dur" -c copy -movflags +faststart \
        -- "$trimmed" </dev/null; then
    echo "Trim failed." >&2
    return 1
  fi

  setup_colors
  printf '\n%sTrimmed clip saved:%s %s\n' "$BOLD$GREEN" "$RESET" "$trimmed"
  print_capture_metrics "$trimmed"
  printf '%s(The original recording was kept.)%s\n' "$DIM" "$RESET"
}

# True if the file has at least one audio stream. Assumes "yes" if it can't
# check, so we never wrongly refuse to try.
has_audio_stream() {
  local f="$1"
  command -v ffprobe >/dev/null 2>&1 || return 0
  [[ -n "$(ffprobe -v error -select_streams a -show_entries stream=index -of csv=p=0 -- "$f" 2>/dev/null | head -1)" ]]
}

# Remove the audio track losslessly. Saves "<name>-mute.<ext>".
edit_strip_audio() {
  local out="$1" base ext target
  command -v ffmpeg >/dev/null 2>&1 || { echo "Strip audio needs ffmpeg." >&2; return 1; }
  if ! has_audio_stream "$out"; then
    echo "No audio track found — nothing to strip." >&2
    return 1
  fi

  ext="${out##*.}"; base="${out%.*}"; target="${base}-mute.${ext}"
  printf 'Removing audio track...\n'
  if ! ffmpeg -nostdin -hide_banner -loglevel error -y \
        -i "$out" -c copy -an -movflags +faststart -- "$target" </dev/null; then
    echo "Strip audio failed." >&2; return 1
  fi

  setup_colors
  printf '\n%sAudio removed:%s %s\n' "$BOLD$GREEN" "$RESET" "$target"
  print_capture_metrics "$target"
  printf '%s(The original recording was kept.)%s\n' "$DIM" "$RESET"
}

# Re-encode smaller (NVENC). Two modes via a single prompt:
#   • blank   -> quality mode: pick a CQ (constant-quality) value.
#   • a number -> target-size mode: aim for that many MB.
# Saves "<name>-small.mp4" and reports the before/after size.
edit_compress() {
  local out="$1" base target reply before after dur
  command -v ffmpeg >/dev/null 2>&1 || { echo "Compress needs ffmpeg." >&2; return 1; }
  setup_colors

  base="${out%.*}"; target="${base}-small.mp4"
  before="$(human_size "$(stat -c '%s' -- "$out" 2>/dev/null || echo 0)")"
  printf '\n%sCompress%s  (current size: %s)\n' "$BOLD$CYAN" "$RESET" "$before"
  printf '%sEnter a target size to aim for that, or leave blank to pick a quality level.%s\n' "$DIM" "$RESET"

  local venc=() audio_opt=()
  has_audio_stream "$out" && audio_opt=(-c:a aac -b:a 128k) || audio_opt=(-an)

  reply="$(prompt_text 'Target size in MB (blank = quality mode)' '')"
  if [[ -n "$reply" ]]; then
    [[ "$reply" =~ ^[0-9]+(\.[0-9]+)?$ ]] || { echo "Invalid size: $reply" >&2; return 1; }
    dur="$(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 -- "$out" 2>/dev/null)"
    [[ "$dur" =~ ^[0-9.]+$ ]] || { echo "Could not read duration to compute bitrate." >&2; return 1; }
    local abit=0 vbit
    has_audio_stream "$out" && abit=128
    # video kbit/s = (target megabytes * 8192 kbit/MB) / seconds  - audio kbit/s
    vbit="$(awk -v mb="$reply" -v d="$dur" -v a="$abit" 'BEGIN { v = mb*8192/d - a; if (v < 50) v = 50; printf "%d", v }')"
    printf 'Targeting ~%s MB  ->  video bitrate %sk\n' "$reply" "$vbit"
    venc=(-c:v h264_nvenc -preset p5 -rc vbr -b:v "${vbit}k" -maxrate "$(( vbit * 3 / 2 ))k" -bufsize "$(( vbit * 2 ))k" -pix_fmt yuv420p)
  else
    reply="$(prompt_text 'Quality CQ (18 = best/larger ... 32 = small, default 28)' '28')"
    [[ "$reply" =~ ^[0-9]+$ ]] || { echo "Invalid CQ: $reply" >&2; return 1; }
    venc=(-c:v h264_nvenc -preset p5 -rc vbr -cq "$reply" -b:v 0 -pix_fmt yuv420p)
  fi

  printf 'Compressing... (re-encodes — may take a moment)\n'
  if ! ffmpeg -nostdin -hide_banner -loglevel error -stats -y \
        -i "$out" "${venc[@]}" "${audio_opt[@]}" -movflags +faststart -- "$target" </dev/null; then
    echo "Compression failed." >&2; return 1
  fi

  after="$(human_size "$(stat -c '%s' -- "$target" 2>/dev/null || echo 0)")"
  printf '\n%sCompressed:%s %s\n' "$BOLD$GREEN" "$RESET" "$target"
  printf '  %ssize%s  %s  ->  %s\n' "$DIM" "$RESET" "$before" "$after"
  print_capture_metrics "$target"
  printf '%s(The original recording was kept.)%s\n' "$DIM" "$RESET"
}
