# rec engine — orchestration: defaults, the latest/open/play actions, and the
# top-level rec_main entrypoint that ties the modules together.

# Default capture configuration. Env vars override where noted.
set_defaults() {
  QUALITY="deliver"; FPS=60; AUDIO=0; NAME=""; CLASS=""; REGION=0; INTERACTIVE=0
  ACTION="record"; PRESET="standard"; COUNTDOWN=0; COPY_PATH=0; PLAY_AFTER=0; NOTIFY=0; GIF=0
  INDICATOR="${REC_INDICATOR:-1}"
  OUTDIR="${REC_DIR:-${DORA_REC_DIR:-$HOME/Videos/recordings}}"
  PREFIX="${REC_PREFIX:-recording}"
  HISTORY_FILE="${REC_HISTORY_FILE:-$HOME/.config/.dotfiles/rec}"
  HISTORY_LIMIT="${REC_HISTORY_LIMIT:-11}"
}

# Handle the non-recording subcommands (latest/open/play). Exits when one runs.
handle_action() {
  case "$ACTION" in
    latest)
      latest="$(latest_recording)"
      [[ -n "${latest:-}" ]] || { echo "No recordings found in $OUTDIR" >&2; exit 1; }
      echo "$latest"
      exit 0
      ;;
    open)
      mkdir -p "$OUTDIR"
      open_path "$OUTDIR"
      exit 0
      ;;
    play)
      latest="$(latest_recording)"
      [[ -n "${latest:-}" ]] || { echo "No recordings found in $OUTDIR" >&2; exit 1; }
      open_path "$latest"
      exit 0
      ;;
  esac
}

rec_main() {
  set_defaults
  parse_args "$@"
  handle_action
  [[ "$INTERACTIVE" -eq 1 ]] && run_interactive_setup
  do_record
}
