# rec engine — capture presets. Each preset adjusts the global capture
# settings. Add new presets here and expose them in args.sh + interactive.sh.

apply_preset() {
  PRESET="$1"
  case "$PRESET" in
    gif)
      GIF=1; FPS=15; AUDIO=0; PREFIX="gif"; COUNTDOWN="${COUNTDOWN:-0}"
      ;;
    clip)
      QUALITY="deliver"; FPS=60; PREFIX="clip"; COUNTDOWN="${COUNTDOWN:-3}"
      if [[ "$COUNTDOWN" -eq 0 ]]; then COUNTDOWN=3; fi
      ;;
    upload)
      QUALITY="deliver"; FPS=60; PREFIX="upload"; COPY_PATH=1; NOTIFY=1
      ;;
    edit)
      QUALITY="master"; FPS=60; PREFIX="edit"
      ;;
  esac
}
