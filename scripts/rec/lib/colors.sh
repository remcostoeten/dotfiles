# rec engine — terminal color setup.
# Sets the BOLD/DIM/RESET/CYAN/GREEN/YELLOW/MAGENTA globals used throughout.

setup_colors() {
  if [[ "${REC_COLOR-}" == "never" ]]; then
    BOLD=""; DIM=""; RESET=""; CYAN=""; GREEN=""; YELLOW=""; MAGENTA=""
  elif [[ "${REC_COLOR-}" == "always" || -t 1 ]]; then
    BOLD=$'\033[1m'
    DIM=$'\033[2m'
    RESET=$'\033[0m'
    CYAN=$'\033[36m'
    GREEN=$'\033[32m'
    YELLOW=$'\033[33m'
    MAGENTA=$'\033[35m'
  elif [[ -n "${NO_COLOR-}" ]]; then
    BOLD=""; DIM=""; RESET=""; CYAN=""; GREEN=""; YELLOW=""; MAGENTA=""
  else
    BOLD=""; DIM=""; RESET=""; CYAN=""; GREEN=""; YELLOW=""; MAGENTA=""
  fi
}
