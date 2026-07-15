# rec engine — the keyboard-first setup wizard (rec -i).
# A sequence of step functions, each backed by choose_menu. ←/h/Backspace
# steps back, Esc/q cancels the whole setup. The finished config is saved
# to history so it can be replayed with `rec ~`.

step_mode() {
  local rc=0
  choose_menu "Mode" 0 "deliver" "master" "gif preset" "clip preset" "upload preset" "edit preset" || rc=$?
  (( rc == 0 )) || return "$rc"
  case "$MENU_CHOICE" in
    deliver|master) QUALITY="$MENU_CHOICE";;
    "gif preset") apply_preset gif;;
    "clip preset") apply_preset clip;;
    "upload preset") apply_preset upload;;
    "edit preset") apply_preset edit;;
  esac
}

step_target() {
  local rc=0
  choose_menu "Target" 0 "active window" "select region" "window title" "WM_CLASS" "Dora" || rc=$?
  (( rc == 0 )) || return "$rc"
  case "$MENU_CHOICE" in
    "active window")
      NAME=""; CLASS=""; REGION=0
      ;;
    "select region")
      NAME=""; CLASS=""; REGION=1
      ;;
    "window title")
      REGION=0; CLASS=""
      NAME="$(prompt_text "Window title to match" "$NAME")"
      ;;
    "WM_CLASS")
      REGION=0; NAME=""
      CLASS="$(prompt_text "WM_CLASS to match" "$CLASS")"
      ;;
    "Dora")
      REGION=0; NAME=""; CLASS="dora"; PREFIX="dora"
      ;;
  esac
}

step_fps() {
  local rc=0
  choose_menu "Frame rate" 0 "60" "30" "120" "144" "custom" || rc=$?
  (( rc == 0 )) || return "$rc"
  if [[ "$MENU_CHOICE" == "custom" ]]; then
    while :; do
      FPS="$(prompt_text "Frame rate (fps)" "$FPS")"
      [[ "$FPS" =~ ^[0-9]+$ && "$FPS" -gt 0 ]] && break
      echo "Please enter a whole number, e.g. 60."
    done
  else
    FPS="$MENU_CHOICE"
  fi
}

step_audio() {
  local rc=0
  choose_menu "Desktop audio" "$AUDIO" "no audio" "capture audio" || rc=$?
  (( rc == 0 )) || return "$rc"
  [[ "$MENU_CHOICE" == "capture audio" ]] && AUDIO=1 || AUDIO=0
}

step_countdown() {
  local rc=0
  choose_menu "Countdown" 0 "none" "3 seconds" "5 seconds" "custom" || rc=$?
  (( rc == 0 )) || return "$rc"
  case "$MENU_CHOICE" in
    none) COUNTDOWN=0;;
    "3 seconds") COUNTDOWN=3;;
    "5 seconds") COUNTDOWN=5;;
    custom)
      while :; do
        COUNTDOWN="$(prompt_text "Countdown seconds" "$COUNTDOWN")"
        [[ "$COUNTDOWN" =~ ^[0-9]+$ ]] && break
        echo "Please enter a whole number, e.g. 3."
      done
      ;;
  esac
}

step_after() {
  local rc=0
  choose_menu "After recording" 0 "just save" "copy path" "play recording" "copy and play" || rc=$?
  (( rc == 0 )) || return "$rc"
  case "$MENU_CHOICE" in
    "just save") COPY_PATH=0; PLAY_AFTER=0;;
    "copy path") COPY_PATH=1; PLAY_AFTER=0;;
    "play recording") COPY_PATH=0; PLAY_AFTER=1;;
    "copy and play") COPY_PATH=1; PLAY_AFTER=1;;
  esac
}

step_notify() {
  local rc=0
  choose_menu "Notifications" "$NOTIFY" "off" "on" || rc=$?
  (( rc == 0 )) || return "$rc"
  [[ "$MENU_CHOICE" == "on" ]] && NOTIFY=1 || NOTIFY=0
}

step_indicator() {
  local rc=0
  choose_menu "On-screen recording indicator" "$INDICATOR" "off" "on" || rc=$?
  (( rc == 0 )) || return "$rc"
  [[ "$MENU_CHOICE" == "on" ]] && INDICATOR=1 || INDICATOR=0
}

step_output() {
  local rc=0
  choose_menu "Output" 0 "use defaults" "edit output directory and prefix" || rc=$?
  (( rc == 0 )) || return "$rc"
  if [[ "$MENU_CHOICE" == "edit output directory and prefix" ]]; then
    OUTDIR="$(prompt_text "Output directory" "$OUTDIR")"
    PREFIX="$(prompt_text "Output filename prefix" "$PREFIX")"
  fi
}

run_interactive_setup() {
  setup_colors
  printf '%srec interactive setup%s\n' "$BOLD$CYAN" "$RESET"
  printf '%sPick options with the keyboard; ←/h goes back a step, Esc/q cancels.%s\n' "$DIM" "$RESET"
  echo

  local steps=(step_mode step_target step_fps step_audio step_countdown step_after step_notify step_indicator step_output)
  local i=0 rc

  while (( i < ${#steps[@]} )); do
    rc=0
    "${steps[$i]}" || rc=$?
    case "$rc" in
      0) i=$((i + 1));;
      1) if (( i > 0 )); then i=$((i - 1)); fi;;
      *)
        echo
        echo "Setup cancelled — nothing recorded."
        exit 130
        ;;
    esac
  done

  save_history
  echo
}
