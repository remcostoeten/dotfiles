# rec engine — orchestration: defaults, the non-recording actions, and the
# top-level rec_main entrypoint that ties the modules together.

# Capture configuration. Precedence: built-in defaults < config file
# (~/.config/rec/config) < REC_* env vars < CLI flags (applied in parse_args).
set_defaults() {
  QUALITY="deliver"; FPS=60; AUDIO=0; NAME=""; CLASS=""; REGION=0; INTERACTIVE=0
  ACTION="record"; PRESET="standard"; COUNTDOWN=0; COPY_PATH=0; PLAY_AFTER=0; NOTIFY=0; GIF=0
  INDICATOR=1
  OUTDIR="$HOME/Videos/recordings"
  PREFIX="recording"
  UPLOAD_HOST="0x0.st"
  HISTORY_FILE="${XDG_CONFIG_HOME:-$HOME/.config}/rec/history"
  HISTORY_LIMIT=11

  load_config_file

  INDICATOR="${REC_INDICATOR:-$INDICATOR}"
  OUTDIR="${REC_DIR:-${DORA_REC_DIR:-$OUTDIR}}"
  PREFIX="${REC_PREFIX:-$PREFIX}"
  UPLOAD_HOST="${REC_UPLOAD_HOST:-$UPLOAD_HOST}"
  HISTORY_FILE="${REC_HISTORY_FILE:-$HISTORY_FILE}"
  HISTORY_LIMIT="${REC_HISTORY_LIMIT:-$HISTORY_LIMIT}"

  migrate_history_file
}

# Handle the non-recording subcommands. Exits when one runs.
handle_action() {
  case "$ACTION" in
    latest)
      latest="$(latest_recording)"
      [[ -n "${latest:-}" ]] || { echo "No recordings found in $OUTDIR" >&2; exit 1; }
      echo "$latest"
      exit 0
      ;;
    list)
      list_recordings
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
    config)
      edit_config
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
