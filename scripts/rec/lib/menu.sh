# rec engine — reusable keyboard TUI primitives.
# choose_menu sets MENU_CHOICE to the selected option string.

prompt_text() {
  local prompt="$1"
  local default="$2"
  local reply

  printf '%s [%s]: ' "$prompt" "$default" >&2
  read -r reply || true
  printf '%s\n' "${reply:-$default}"
}

draw_menu() {
  local prompt="$1"
  local selected="$2"
  shift 2
  local options=("$@")
  local index

  if [[ -t 1 ]]; then
    printf '\033[2J\033[H'
  else
    printf '\n'
  fi

  printf '%s%s%s\n' "$BOLD$YELLOW" "$prompt" "$RESET"
  printf '%sKeyboard: arrows/j/k move, number jumps, Enter selects%s\n\n' "$DIM" "$RESET"

  for index in "${!options[@]}"; do
    if (( index == selected )); then
      printf '  %s>%s %s%d.%s %s%s%s\n' "$GREEN" "$RESET" "$DIM" "$((index + 1))" "$RESET" "$BOLD" "${options[$index]}" "$RESET"
    else
      printf '    %s%d.%s %s\n' "$DIM" "$((index + 1))" "$RESET" "${options[$index]}"
    fi
  done
}

choose_menu() {
  local prompt="$1"
  local selected="$2"
  shift 2
  local options=("$@")
  local key

  while true; do
    draw_menu "$prompt" "$selected" "${options[@]}"
    IFS= read -rsn1 key || key=""

    case "$key" in
      "")
        MENU_CHOICE="${options[$selected]}"
        return 0
        ;;
      $'\033')
        IFS= read -rsn2 -t 0.05 key || key=""
        case "$key" in
          "[A") selected=$(((selected + ${#options[@]} - 1) % ${#options[@]}));;
          "[B") selected=$(((selected + 1) % ${#options[@]}));;
        esac
        ;;
      k|K)
        selected=$(((selected + ${#options[@]} - 1) % ${#options[@]}))
        ;;
      j|J)
        selected=$(((selected + 1) % ${#options[@]}))
        ;;
      [1-9])
        if (( key >= 1 && key <= ${#options[@]} )); then
          selected=$((key - 1))
        fi
        ;;
    esac
  done
}
