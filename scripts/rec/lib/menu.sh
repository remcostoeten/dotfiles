# rec engine — reusable keyboard TUI primitives.
# choose_menu sets MENU_CHOICE to the selected option string. Returns:
#   0  option selected (Enter)
#   1  go back one step (← / h / Backspace)
#   2  cancel the wizard (Esc / q)

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
  printf '%s↑/↓ or j/k move · 1-9 jump · Enter select · ←/h back · Esc/q cancel%s\n\n' "$DIM" "$RESET"

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
  local key seq

  while true; do
    draw_menu "$prompt" "$selected" "${options[@]}"
    # On read failure (EOF / no tty) fall through to selecting the current
    # option, so scripted/piped runs complete with defaults instead of hanging.
    IFS= read -rsn1 key || key=""

    case "$key" in
      "")
        MENU_CHOICE="${options[$selected]}"
        return 0
        ;;
      $'\033')
        if IFS= read -rsn2 -t 0.05 seq; then
          case "$seq" in
            "[A") selected=$(((selected + ${#options[@]} - 1) % ${#options[@]}));;
            "[B") selected=$(((selected + 1) % ${#options[@]}));;
            "[D") return 1;;
          esac
        else
          return 2
        fi
        ;;
      k|K)
        selected=$(((selected + ${#options[@]} - 1) % ${#options[@]}))
        ;;
      j|J)
        selected=$(((selected + 1) % ${#options[@]}))
        ;;
      h|H|$'\177')
        return 1
        ;;
      q|Q)
        return 2
        ;;
      [1-9])
        if (( key >= 1 && key <= ${#options[@]} )); then
          selected=$((key - 1))
        fi
        ;;
    esac
  done
}
