# rec engine — the capture core: locating recordings, region/window geometry,
# the ffmpeg command, the recorder control loop, and the record orchestration.

latest_recording() {
  find "$OUTDIR" -maxdepth 1 -type f \( -name '*.mp4' -o -name '*.gif' \) -printf '%T@ %p\n' 2>/dev/null |
    sort -nr |
    awk 'NR == 1 { sub(/^[^ ]+ /, ""); print }'
}

# Round down to an even number (NVENC requires even dimensions).
even() { echo $(( $1 - ($1 % 2) )); }

parse_x11_region() {
  local selection="$1"
  read -r X Y W H <<<"$selection"
  [[ "${X:-}" =~ ^-?[0-9]+$ && "${Y:-}" =~ ^-?[0-9]+$ && "${W:-}" =~ ^[0-9]+$ && "${H:-}" =~ ^[0-9]+$ ]] &&
    (( W > 0 && H > 0 ))
}

select_x11_region() {
  local selection=""
  local err_file
  local status=0

  command -v slop >/dev/null 2>&1 || {
    echo "Region capture on X11 requires slop." >&2
    exit 1
  }

  err_file="$(mktemp)"
  echo "Select a region with two clicks..."

  # Some X11 setups cancel immediately with --nodrag; fall back to drag-select
  # before treating it as a real cancellation.
  if selection="$(slop --noopengl --nodrag -f '%x %y %w %h' 2>"$err_file")"; then
    status=0
  else
    status=$?
  fi

  if [[ "$status" -eq 0 && -n "$selection" ]] && parse_x11_region "$selection"; then
    rm -f "$err_file"
    return 0
  fi

  echo "Two-click selection did not return a usable region; retrying with click-drag..."
  : >"$err_file"
  status=0
  if selection="$(slop --noopengl -f '%x %y %w %h' 2>"$err_file")"; then
    status=0
  else
    status=$?
  fi

  if [[ "$status" -eq 0 && -n "$selection" ]] && parse_x11_region "$selection"; then
    rm -f "$err_file"
    return 0
  fi

  if [[ -s "$err_file" ]]; then
    sed 's/^/slop: /' "$err_file" >&2
  fi
  rm -f "$err_file"
  echo "selection cancelled" >&2
  exit 1
}

run_recorder() {
  local out="$1"
  shift
  local paused=0
  local key
  local status=0

  # Run ffmpeg in its own session when possible, so a terminal Ctrl-C
  # (delivered to our whole foreground process group) does NOT reach ffmpeg
  # directly. Otherwise ffmpeg would get the terminal's SIGINT *and* a second
  # signal from our trap, hit "Immediate exit requested", and leave a file
  # with no moov atom / trailer. We instead deliver exactly one SIGINT
  # ourselves and let ffmpeg finalize the recording cleanly.
  local signal_target
  if command -v setsid >/dev/null 2>&1; then
    setsid "$@" &
    signal_target="-$!"
  else
    "$@" &
    signal_target="$!"
  fi
  local pid=$!

  stop_recorder() {
    if [[ "$STOPPING" -eq 1 ]]; then return 0; fi
    STOPPING=1
    kill -CONT -- "$signal_target" >/dev/null 2>&1 || true   # un-pause if needed
    kill -INT -- "$signal_target" >/dev/null 2>&1 || true     # graceful: ffmpeg writes the trailer
  }
  STOPPING=0
  # Stop gracefully once; ignore further signals so an impatient second
  # Ctrl-C can't truncate the file mid-finalize.
  trap 'stop_recorder' INT TERM

  # Show the on-screen recording indicator for the duration of the capture.
  # No-op when unavailable (missing yad, --no-indicator, unknown geometry).
  start_overlay

  printf 'Controls: p pause, r resume, q stop\n'
  while [[ "$STOPPING" -eq 0 ]] && kill -0 "$pid" >/dev/null 2>&1; do
    if IFS= read -rsn1 -t 0.2 key; then
      case "$key" in
        p|P)
          if [[ "$paused" -eq 0 ]]; then
            kill -STOP -- "$signal_target" >/dev/null 2>&1 || true
            paused=1
            echo "Paused. Press r to resume."
          fi
          ;;
        r|R)
          if [[ "$paused" -eq 1 ]]; then
            kill -CONT -- "$signal_target" >/dev/null 2>&1 || true
            paused=0
            echo "Resumed."
          fi
          ;;
        q|Q)
          stop_recorder
          break
          ;;
      esac
    fi
  done

  # Wait for ffmpeg to fully exit, resuming the wait if a trapped signal
  # interrupts it, so the trailer is always written before we continue.
  while kill -0 "$pid" >/dev/null 2>&1; do
    if wait "$pid"; then
      status=0
    else
      status=$?
    fi
  done
  trap - INT TERM
  stop_overlay
  [[ "$status" -eq 0 || "$status" -eq 255 || "$status" -eq 130 ]] || return "$status"
  post_recording_actions "$out"
}

# Determine the output path, resolve geometry, build the ffmpeg/wf-recorder
# command, and run it. Honors REC_DRY_RUN=1 (print plan and exit).
do_record() {
  mkdir -p "$OUTDIR"
  STAMP="$(date +%Y%m%d-%H%M%S)"
  EXT="mp4"
  [[ "$GIF" -eq 1 ]] && EXT="gif"
  OUT="$OUTDIR/$PREFIX-$STAMP.$EXT"

  if [[ "${XDG_SESSION_TYPE-}" == "wayland" ]]; then
    echo "Wayland session detected. X11 window targeting is unavailable; install wf-recorder or wl-screenrec for native Wayland capture." >&2
  fi

  if [[ "${REC_DRY_RUN-}" == "1" ]]; then
    echo "Dry run: would record preset=$PRESET quality=$QUALITY fps=$FPS audio=$AUDIO countdown=$COUNTDOWN copy=$COPY_PATH play=$PLAY_AFTER notify=$NOTIFY gif=$GIF region=$REGION class='$CLASS' name='$NAME' output='$OUT'"
    exit 0
  fi

  if [[ "${XDG_SESSION_TYPE-}" == "wayland" ]]; then
    [[ -z "$NAME" && -z "$CLASS" ]] || {
      echo "Wayland fallback cannot target windows by title/class. Use active/fullscreen capture or switch to X11." >&2
      exit 1
    }
    [[ "$GIF" -eq 0 ]] || {
      echo "Wayland fallback currently records video only; use X11 for gif preset." >&2
      exit 1
    }
    command -v wf-recorder >/dev/null 2>&1 || {
      echo "Wayland fallback requires wf-recorder. Install wf-recorder, or run an X11 session for x11grab." >&2
      exit 1
    }

    WF_CMD=(wf-recorder -f "$OUT")
    if [[ "$REGION" -eq 1 ]]; then
      command -v slurp >/dev/null 2>&1 || {
        echo "Region capture on Wayland requires slurp." >&2
        exit 1
      }
      GEOM="$(slurp)" || { echo "selection cancelled"; exit 1; }
      WF_CMD+=( -g "$GEOM" )
    fi

    echo "Recording Wayland output @${FPS}fps -> $OUT"
    run_countdown "$COUNTDOWN"
    send_notification "Recording started: $OUT"
    run_recorder "$OUT" "${WF_CMD[@]}"
    exit $?
  fi

  # --- determine capture geometry (must be even for NVENC) ---
  if [[ $REGION -eq 1 ]]; then
    select_x11_region
  else
    # Find candidate windows by title/class, otherwise use the active window.
    if [[ -n "$NAME" ]]; then
      CANDS="$(xdotool search --name "$NAME" 2>/dev/null || true)"
    elif [[ -n "$CLASS" ]]; then
      CANDS="$(xdotool search --class "$CLASS" 2>/dev/null || true)"
    else
      CANDS="$(xdotool getactivewindow 2>/dev/null || true)"
    fi
    [[ -z "${CANDS:-}" ]] && { echo "No matching window for class='$CLASS' name='$NAME'. Try --class, --name, --active, or --region." >&2; exit 1; }
    # Pick the largest visible window (the real app window, not webview/decoration children).
    WID=""; BEST=0
    for id in $CANDS; do
      g="$(xdotool getwindowgeometry --shell "$id" 2>/dev/null)" || continue
      eval "$g"   # sets X Y WIDTH HEIGHT for this id
      area=$(( WIDTH * HEIGHT ))
      if (( area > BEST )); then BEST=$area; WID=$id; fi
    done
    [[ -z "$WID" ]] && { echo "Found windows but none with geometry." >&2; exit 1; }
    xdotool windowactivate "$WID" >/dev/null 2>&1 || true
    eval "$(xdotool getwindowgeometry --shell "$WID")"   # final X Y WIDTH HEIGHT
    W="$WIDTH"; H="$HEIGHT"
    echo "Target window: $WID ($(xdotool getwindowname "$WID" 2>/dev/null))"
  fi
  W="$(even "$W")"; H="$(even "$H")"
  echo "Recording ${W}x${H} at +${X},${Y}  @${FPS}fps  [$QUALITY]  -> $OUT"

  run_countdown "$COUNTDOWN"
  send_notification "Recording started: $OUT"

  if [[ "$GIF" -eq 1 ]]; then
    REC_CMD=(ffmpeg -nostdin -hide_banner -loglevel warning -stats
      -f x11grab -draw_mouse 1 -framerate "$FPS" -video_size "${W}x${H}" -i ":0.0+${X},${Y}"
      -vf "fps=${FPS},scale=trunc(iw/2)*2:trunc(ih/2)*2:flags=lanczos"
      "$OUT")
  else
    # --- quality presets (NVENC, p7 = slowest/best) ---
    if [[ "$QUALITY" == "master" ]]; then
      VENC=(-c:v hevc_nvenc -preset p7 -tune lossless -rc constqp -qp 0 -pix_fmt yuv444p)
    else
      VENC=(-c:v h264_nvenc -preset p7 -tune hq -rc vbr -cq 18 -b:v 0 -profile:v high -pix_fmt yuv420p)
    fi

    # --- audio (desktop output via default sink monitor) ---
    AUDIO_IN=(); AUDIO_ENC=()
    if [[ $AUDIO -eq 1 ]]; then
      SINK="$(pactl get-default-sink).monitor"
      AUDIO_IN=(-f pulse -i "$SINK")
      AUDIO_ENC=(-c:a aac -b:a 256k)
    fi

    REC_CMD=(ffmpeg -nostdin -hide_banner -loglevel warning -stats
      -f x11grab -draw_mouse 1 -framerate "$FPS" -video_size "${W}x${H}" -i ":0.0+${X},${Y}"
      "${AUDIO_IN[@]}"
      "${VENC[@]}" "${AUDIO_ENC[@]}"
      -movflags +faststart
      "$OUT")
  fi

  run_recorder "$OUT" "${REC_CMD[@]}"
}
