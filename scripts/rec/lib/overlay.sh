# rec engine — on-screen recording indicator.
#
# Draws a small always-on-top, borderless, transparent overlay (a blinking red
# dot + an elapsed MM:SS timer) positioned just OUTSIDE the captured rectangle,
# so it is visible to the user but never lands in the recording (x11grab only
# captures the pixels inside the rectangle).
#
# For a true fullscreen capture there is no off-capture space on a single
# monitor; in that case the overlay is tucked into a corner and WILL appear in
# the recording — start_overlay() prints a one-line heads-up when that happens.
#
# Backed by yad. If yad is missing (or indicator disabled) every entry point is
# a graceful no-op, so the recorder keeps working without it.

OVERLAY_FIFO=""
OVERLAY_YAD_PID=""
OVERLAY_FEEDER_PID=""

# Decide whether the overlay can/should run. Sets globals OVL_* on success.
# Reads the capture rectangle from X Y W H (already even-adjusted).
overlay_available() {
  [[ "${INDICATOR:-1}" -eq 1 ]] || return 1
  [[ -n "${DISPLAY-}" ]] || return 1
  command -v yad >/dev/null 2>&1 || return 1
  # Need a known rectangle to anchor against.
  [[ "${X:-}" =~ ^-?[0-9]+$ && "${Y:-}" =~ ^-?[0-9]+$ && "${W:-}" =~ ^[0-9]+$ && "${H:-}" =~ ^[0-9]+$ ]] || return 1
  return 0
}

# Compute OVL_X/OVL_Y for the indicator, anchored to the capture rectangle.
# Prefers just above the top-right corner; falls back to just below the bottom
# if there's no room above. Clamps to the screen. Sets OVL_INSIDE=1 when the
# overlay unavoidably overlaps the capture rectangle (fullscreen case).
overlay_geometry() {
  local gap=6
  local screen_w screen_h disp
  OVL_W="${OVL_W:-150}"; OVL_H="${OVL_H:-38}"
  OVL_INSIDE=0

  disp="$(xdotool getdisplaygeometry 2>/dev/null || echo "0 0")"
  screen_w="${disp%% *}"; screen_h="${disp##* }"
  [[ "$screen_w" =~ ^[0-9]+$ ]] || screen_w=0
  [[ "$screen_h" =~ ^[0-9]+$ ]] || screen_h=0

  # Right-aligned to the capture rectangle's right edge.
  OVL_X=$(( X + W - OVL_W ))

  # Prefer just above the top edge; otherwise just below the bottom edge.
  if (( Y - OVL_H - gap >= 0 )); then
    OVL_Y=$(( Y - OVL_H - gap ))
  elif (( screen_h == 0 || Y + H + gap + OVL_H <= screen_h )); then
    OVL_Y=$(( Y + H + gap ))
  else
    # No room outside (fullscreen): tuck inside the top-right corner.
    OVL_Y=$(( Y + gap ))
    OVL_INSIDE=1
  fi

  # Clamp to the screen so the window is always reachable.
  (( OVL_X < 0 )) && OVL_X=0
  (( OVL_Y < 0 )) && OVL_Y=0
  if (( screen_w > 0 && OVL_X + OVL_W > screen_w )); then OVL_X=$(( screen_w - OVL_W )); fi
  if (( screen_h > 0 && OVL_Y + OVL_H > screen_h )); then OVL_Y=$(( screen_h - OVL_H )); fi
}

# Background process: stream blinking dot + elapsed timer into the FIFO that
# yad reads. Uses yad's --progress stdin protocol ('#text' updates the label).
overlay_feeder() {
  local fifo="$1"
  local start elapsed mm ss dot=1
  start="$(date +%s)"
  # Keep the FIFO open for writing for the whole loop.
  exec 3>"$fifo"
  while :; do
    elapsed=$(( $(date +%s) - start ))
    mm=$(( elapsed / 60 )); ss=$(( elapsed % 60 ))
    if (( dot )); then
      printf '#<span foreground="#ff3b30">●</span>  <b>REC</b>  %d:%02d\n' "$mm" "$ss" >&3
      dot=0
    else
      printf '#<span foreground="#ff3b30"> </span>  <b>REC</b>  %d:%02d\n' "$mm" "$ss" >&3
      dot=1
    fi
    sleep 0.5
  done
}

# Launch the indicator. No-op (returns 0) when unavailable.
start_overlay() {
  overlay_available || return 0
  overlay_geometry

  if (( OVL_INSIDE == 1 )); then
    echo "Note: fullscreen capture leaves no off-screen space — the recording indicator will be visible in this recording." >&2
  fi

  OVERLAY_FIFO="$(mktemp -u --tmpdir rec-overlay.XXXXXX.fifo)"
  mkfifo "$OVERLAY_FIFO" 2>/dev/null || { OVERLAY_FIFO=""; return 0; }

  # yad reads the feeder's stream; pango markup in labels gives us the red dot.
  yad --progress --pulsate --undecorated --skip-taskbar --on-top --sticky \
      --no-buttons --no-escape --skip-pager \
      --geometry="${OVL_W}x${OVL_H}+${OVL_X}+${OVL_Y}" \
      --title="rec-indicator" --text="REC" \
      <"$OVERLAY_FIFO" >/dev/null 2>&1 &
  OVERLAY_YAD_PID=$!

  overlay_feeder "$OVERLAY_FIFO" &
  OVERLAY_FEEDER_PID=$!
}

# Tear down the indicator. Safe to call multiple times / when never started.
stop_overlay() {
  [[ -n "$OVERLAY_FEEDER_PID" ]] && kill "$OVERLAY_FEEDER_PID" >/dev/null 2>&1 || true
  [[ -n "$OVERLAY_YAD_PID" ]] && kill "$OVERLAY_YAD_PID" >/dev/null 2>&1 || true
  [[ -n "$OVERLAY_FIFO" && -p "$OVERLAY_FIFO" ]] && rm -f "$OVERLAY_FIFO" || true
  OVERLAY_FEEDER_PID=""; OVERLAY_YAD_PID=""; OVERLAY_FIFO=""
}
