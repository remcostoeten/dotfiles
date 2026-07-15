# rec engine — argument parsing and "did you mean" suggestions.
# parse_args consumes the CLI, applying history replay then option flags,
# mutating the capture globals (and ACTION/INTERACTIVE).

suggest_arg() {
  local arg="$1"
  local options=(--fps --audio --name --class --active --region --dora --output-dir --prefix --countdown --copy-path --play --notify --no-notify --indicator --no-indicator --interactive --help)
  local commands=(master deliver region gif clip upload edit latest list open play config help)
  local opt

  if [[ "$arg" != --* ]]; then
    for opt in "${options[@]}"; do
      if [[ "--$arg" == "$opt" ]]; then
        printf "%s\n" "$opt"
        return 0
      fi
    done
  fi

  awk -v target="$arg" -v opts="${options[*]} ${commands[*]}" '
    function min(a, b, c) {
      m = a < b ? a : b
      return m < c ? m : c
    }
    function dist(a, b, i, j, cost, la, lb) {
      la = length(a); lb = length(b)
      for (i = 0; i <= la; i++) d[i,0] = i
      for (j = 0; j <= lb; j++) d[0,j] = j
      for (i = 1; i <= la; i++) {
        for (j = 1; j <= lb; j++) {
          cost = substr(a, i, 1) == substr(b, j, 1) ? 0 : 1
          d[i,j] = min(d[i-1,j] + 1, d[i,j-1] + 1, d[i-1,j-1] + cost)
        }
      }
      return d[la,lb]
    }
    BEGIN {
      gsub(/^--/, "", target)
      split(opts, candidates, " ")
      best = 99; suggestion = ""
      for (i in candidates) {
        candidate = candidates[i]
        raw = candidate
        gsub(/^--/, "", raw)
        distance = dist(target, raw)
        if (distance < best) {
          best = distance
          suggestion = candidate
        }
      }
      if (best <= 2) print suggestion
    }
  '
}

unknown_arg() {
  local arg="$1"
  local suggestion
  suggestion="$(suggest_arg "$arg")"

  echo "unknown arg: $arg" >&2
  [[ -n "$suggestion" ]] && echo "Did you mean '$suggestion'?" >&2
  echo "Run 'rec --help' for usage." >&2
  exit 1
}

need_number() {
  local opt="$1" value="$2"
  [[ "$value" =~ ^[0-9]+$ ]] || { echo "$opt expects a whole number, got '$value'" >&2; exit 1; }
  printf '%s\n' "$value"
}

parse_args() {
  local replay_index

  if [[ $# -gt 0 ]]; then
    if replay_index="$(history_index_from_arg "$1")"; then
      if [[ "${2-}" == "--help" || "${2-}" == "help" ]]; then
        show_history
        exit 0
      fi
      apply_history_entry "$replay_index"
      shift
    fi
  fi

  while [[ $# -gt 0 ]]; do
    case "$1" in
      -h|--help|help) usage; exit 0;;
      -i|--interactive|menu) INTERACTIVE=1; shift;;
      master|deliver) QUALITY="$1"; shift;;
      gif|clip|upload|edit) apply_preset "$1"; shift;;
      latest|list|open|play|config) ACTION="$1"; shift;;
      region) REGION=1; shift;;
      --fps) FPS="$(need_number "$1" "$(need_value "$1" "${2-}")")"; shift 2;;
      --audio) AUDIO=1; shift;;
      --active) NAME=""; CLASS=""; REGION=0; shift;;
      --name) NAME="$(need_value "$1" "${2-}")"; shift 2;;
      --class) CLASS="$(need_value "$1" "${2-}")"; shift 2;;
      --region) REGION=1; shift;;
      --dora) CLASS="dora"; NAME=""; REGION=0; PREFIX="dora"; shift;;
      --output-dir) OUTDIR="$(need_value "$1" "${2-}")"; shift 2;;
      --prefix) PREFIX="$(need_value "$1" "${2-}")"; shift 2;;
      --countdown) COUNTDOWN="$(need_number "$1" "$(need_value "$1" "${2-}")")"; shift 2;;
      --copy-path) COPY_PATH=1; shift;;
      --play) PLAY_AFTER=1; shift;;
      --notify) NOTIFY=1; shift;;
      --no-notify) NOTIFY=0; shift;;
      --indicator) INDICATOR=1; shift;;
      --no-indicator) INDICATOR=0; shift;;
      *) unknown_arg "$1";;
    esac
  done

  if [[ "$FPS" -eq 0 ]]; then
    echo "--fps must be at least 1" >&2
    exit 1
  fi
}
