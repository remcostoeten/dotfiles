# rec engine — terminal color setup.
# Sets the BOLD/DIM/RESET/RED/CYAN/GREEN/YELLOW/MAGENTA globals used throughout.
# REC_COLOR=always forces color, REC_COLOR=never or NO_COLOR disables it,
# otherwise color is used only on a terminal.

setup_colors() {
  local want=0
  if [[ "${REC_COLOR-}" == "always" ]]; then
    want=1
  elif [[ "${REC_COLOR-}" != "never" && -z "${NO_COLOR-}" && -t 1 ]]; then
    want=1
  fi

  if (( want )); then
    BOLD=$'\033[1m'
    DIM=$'\033[2m'
    RESET=$'\033[0m'
    RED=$'\033[31m'
    CYAN=$'\033[36m'
    GREEN=$'\033[32m'
    YELLOW=$'\033[33m'
    MAGENTA=$'\033[35m'
  else
    BOLD=""; DIM=""; RESET=""; RED=""; CYAN=""; GREEN=""; YELLOW=""; MAGENTA=""
  fi
}
