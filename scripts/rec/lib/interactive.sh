# rec engine — the keyboard-first setup wizard (rec -i).
# Walks the menus, mutates the capture globals, and saves the result to history.

run_interactive_setup() {
  setup_colors
  printf '%srec interactive setup%s\n' "$BOLD$CYAN" "$RESET"
  printf '%sUse the keyboard to choose options. Text input is only used for custom values.%s\n' "$DIM" "$RESET"
  echo

  choose_menu "Mode" 0 "deliver" "master" "gif preset" "clip preset" "upload preset" "edit preset"
  case "$MENU_CHOICE" in
    deliver|master) QUALITY="$MENU_CHOICE";;
    "gif preset") apply_preset gif;;
    "clip preset") apply_preset clip;;
    "upload preset") apply_preset upload;;
    "edit preset") apply_preset edit;;
  esac

  choose_menu "Target" 0 "active window" "select region" "window title" "WM_CLASS" "Dora"
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

  choose_menu "Frame rate" 0 "60" "30" "120" "144" "custom"
  if [[ "$MENU_CHOICE" == "custom" ]]; then
    FPS="$(prompt_text "Frame rate (fps)" "$FPS")"
  else
    FPS="$MENU_CHOICE"
  fi
  [[ "$FPS" =~ ^[0-9]+$ ]] || { echo "invalid fps: $FPS" >&2; exit 1; }

  choose_menu "Desktop audio" "$AUDIO" "no audio" "capture audio"
  [[ "$MENU_CHOICE" == "capture audio" ]] && AUDIO=1 || AUDIO=0

  choose_menu "Countdown" 0 "none" "3 seconds" "5 seconds" "custom"
  case "$MENU_CHOICE" in
    none) COUNTDOWN=0;;
    "3 seconds") COUNTDOWN=3;;
    "5 seconds") COUNTDOWN=5;;
    custom) COUNTDOWN="$(prompt_text "Countdown seconds" "$COUNTDOWN")";;
  esac
  [[ "$COUNTDOWN" =~ ^[0-9]+$ ]] || { echo "invalid countdown: $COUNTDOWN" >&2; exit 1; }

  choose_menu "After recording" 0 "just save" "copy path" "play recording" "copy and play"
  case "$MENU_CHOICE" in
    "just save") COPY_PATH=0; PLAY_AFTER=0;;
    "copy path") COPY_PATH=1; PLAY_AFTER=0;;
    "play recording") COPY_PATH=0; PLAY_AFTER=1;;
    "copy and play") COPY_PATH=1; PLAY_AFTER=1;;
  esac

  choose_menu "Notifications" "$NOTIFY" "off" "on"
  [[ "$MENU_CHOICE" == "on" ]] && NOTIFY=1 || NOTIFY=0

  choose_menu "On-screen recording indicator" "$INDICATOR" "off" "on"
  [[ "$MENU_CHOICE" == "on" ]] && INDICATOR=1 || INDICATOR=0

  choose_menu "Output" 0 "use defaults" "edit output directory and prefix"
  if [[ "$MENU_CHOICE" == "edit output directory and prefix" ]]; then
    OUTDIR="$(prompt_text "Output directory" "$OUTDIR")"
    PREFIX="$(prompt_text "Output filename prefix" "$PREFIX")"
  fi
  save_history
  echo
}
