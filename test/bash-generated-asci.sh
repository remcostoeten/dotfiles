#!/usr/bin/env bash

# Pastel colors matching cfg/docker scripts
PASTEL_PINK='\033[38;2;250;162;193m'
PASTEL_MAGENTA='\033[38;2;212;187;248m'
PASTEL_PURPLE='\033[38;2;165;216;255m'
PASTEL_BLUE='\033[38;2;178;242;187m'
PASTEL_CYAN='\033[38;2;255;236;153m'
PASTEL_GREEN='\033[38;2;255;216;168m'
NC='\033[0m' # No Color

# Default tagline
defaultTagline="Welcome to the dotfiles experience!"

get_version() {
  local version_file="$(dirname "$0")/../VERSION"
  if [ -f "$version_file" ]; then
    cat "$version_file" | tr -d '\n'
  else
    echo "unknown"
  fi
}

remove_ansi() {
  echo -e "$1" | sed 's/\x1b\[[0-9;]*m//g'
}

create_gradient_text() {
  local text="$1"
  local colors=("$PASTEL_PINK" "$PASTEL_MAGENTA" "$PASTEL_PURPLE" "$PASTEL_BLUE" "$PASTEL_CYAN" "$PASTEL_GREEN")
  local result=""
  local text_len=${#text}

  if [ $text_len -eq 0 ]; then
    echo "$text"
    return
  fi

  for ((i = 0; i < text_len; i++)); do
    local position=$((i * 100 / (text_len - 1)))
    local color_index=$((position * (${#colors[@]} - 1) / 100))
    result+="${colors[$color_index]}${text:$i:1}"
  done
  printf '%b' "${result}${NC}"
}

show_banner() {
  local version=$(get_version)
  local tagline="${tagline:-"$defaultTagline"}"
  local gradient_tagline=$(create_gradient_text "$tagline")

  # ASCII art with gradient colors
  local ascii_lines=(
    "${PASTEL_PINK}    ██████╗  ██████╗  ██████╗██╗  ██╗███████╗██████╗ ${NC}"
    "${PASTEL_MAGENTA}    ██╔══██╗██╔═══██╗██╔════╝██║ ██╔╝██╔════╝██╔══██╗${NC}"
    "${PASTEL_PURPLE}    ██║  ██║██║   ██║██║     █████╔╝ █████╗  ██████╔╝${NC}"
    "${PASTEL_BLUE}    ██║  ██║██║   ██║██║     ██╔═██╗ ██╔══╝  ██╔══██╗${NC}"
    "${PASTEL_CYAN}    ██████╔╝╚██████╔╝╚██████╗██║  ██╗███████╗██║  ██║${NC}"
    "${PASTEL_GREEN}    ╚═════╝  ╚═════╝  ╚═════╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝${NC}")

  # Calculate padding for centered tagline
  local max_width=0
  for line in "${ascii_lines[@]}"; do
    local clean_line=$(remove_ansi "$line")
    local line_length=${#clean_line}
    if [ $line_length -gt $max_width ]; then
      max_width=$line_length
    fi
  done

  local tagline_length=${#tagline}
  local left_pad=$(((max_width - tagline_length) / 2))

  # Print ASCII art and tagline
  for line in "${ascii_lines[@]}"; do
    echo -e "$line"
  done
  echo "$(printf ' %.0s' $(seq 1 $((left_pad + 1))))$gradient_tagline"
  echo ""
}

# Usage: show_banner
show_banner
