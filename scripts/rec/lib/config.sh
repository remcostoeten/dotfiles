# rec engine — user configuration file.
#
# Defaults live in ~/.config/rec/config as simple "key = value" lines.
# Precedence: built-in defaults < config file < REC_* env vars < CLI flags.
# `rec config` creates the file from a commented template and opens it.

config_path() {
  printf '%s\n' "${REC_CONFIG:-${XDG_CONFIG_HOME:-$HOME/.config}/rec/config}"
}

# Normalize on/off/yes/no/true/false/1/0 to 1 or 0. Fails on anything else.
parse_config_bool() {
  case "${1,,}" in
    1|on|yes|true) printf '1';;
    0|off|no|false) printf '0';;
    *) return 1;;
  esac
}

config_warn() {
  echo "rec: config: $1" >&2
}

# Strip leading/trailing whitespace.
trim_ws() {
  local s="$1"
  s="${s#"${s%%[![:space:]]*}"}"
  s="${s%"${s##*[![:space:]]}"}"
  printf '%s' "$s"
}

load_config_file() {
  local file key value bool lineno=0
  file="$(config_path)"
  [[ -f "$file" ]] || return 0

  while IFS= read -r line || [[ -n "$line" ]]; do
    lineno=$((lineno + 1))
    line="${line%%#*}"
    [[ "$line" == *=* ]] || continue
    key="$(trim_ws "${line%%=*}")"
    value="$(trim_ws "${line#*=}")"
    value="${value%\"}"; value="${value#\"}"
    [[ -n "$key" ]] || continue
    key="${key,,}"

    case "$key" in
      quality)
        if [[ "$value" == "deliver" || "$value" == "master" ]]; then QUALITY="$value"
        else config_warn "line $lineno: quality must be deliver or master (got '$value')"; fi
        ;;
      fps)
        if [[ "$value" =~ ^[0-9]+$ && "$value" -gt 0 ]]; then FPS="$value"
        else config_warn "line $lineno: fps must be a positive number (got '$value')"; fi
        ;;
      countdown)
        if [[ "$value" =~ ^[0-9]+$ ]]; then COUNTDOWN="$value"
        else config_warn "line $lineno: countdown must be a number (got '$value')"; fi
        ;;
      audio|notify|indicator|copy_path|play)
        if bool="$(parse_config_bool "$value")"; then
          case "$key" in
            audio) AUDIO="$bool";;
            notify) NOTIFY="$bool";;
            indicator) INDICATOR="$bool";;
            copy_path) COPY_PATH="$bool";;
            play) PLAY_AFTER="$bool";;
          esac
        else
          config_warn "line $lineno: $key must be on or off (got '$value')"
        fi
        ;;
      output_dir)
        [[ "$value" == "~"* ]] && value="$HOME${value:1}"
        [[ -n "$value" ]] && OUTDIR="$value"
        ;;
      prefix)
        [[ -n "$value" ]] && PREFIX="$value"
        ;;
      upload_host)
        [[ -n "$value" ]] && UPLOAD_HOST="$value"
        ;;
      *)
        config_warn "line $lineno: unknown key '$key' (run 'rec config' to see valid keys)"
        ;;
    esac
  done <"$file"
  return 0
}

config_template() {
  cat <<'TEMPLATE'
# rec configuration — loaded on every run.
# Precedence: this file < REC_* environment variables < CLI flags.
# Uncomment a line to change its default.

# quality = deliver          # deliver (upload-ready) | master (near-lossless)
# fps = 60
# audio = off                # capture desktop audio: on | off
# countdown = 0              # seconds to wait before recording starts
# notify = off               # desktop notifications on start/save
# indicator = on             # on-screen REC indicator during capture
# copy_path = off            # copy the output path to the clipboard when done
# play = off                 # open the recording when done
# output_dir = ~/Videos/recordings
# prefix = recording         # output filename prefix
# upload_host = 0x0.st       # host for the post-capture upload action
TEMPLATE
}

# `rec config` — create the file from the template if missing, then open it.
edit_config() {
  local file
  file="$(config_path)"
  if [[ ! -f "$file" ]]; then
    mkdir -p "$(dirname -- "$file")"
    config_template >"$file"
    echo "Created $file"
  fi
  if [[ -t 0 && -t 1 && -n "${EDITOR:-}" ]]; then
    "$EDITOR" "$file"
  else
    printf '%s\n' "$file"
  fi
}
