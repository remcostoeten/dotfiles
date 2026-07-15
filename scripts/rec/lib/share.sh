# rec engine — sharing. Upload a recording to a file host and copy the link.
#
# Default host is 0x0.st (anonymous, public, temporary). Override with:
#   REC_UPLOAD_HOST=transfer.sh            # swap the simple curl -F target
#   REC_UPLOAD_CMD='curl -fsS ... "$REC_FILE"'   # full custom command; must
#                                                # print the URL on stdout and
#                                                # read the file path from
#                                                # $REC_FILE.

share_available() {
  command -v curl >/dev/null 2>&1
}

# Upload "$1" and copy the resulting URL to the clipboard. Asks for explicit
# confirmation first, since this publishes the file publicly.
share_upload() {
  local out="$1" host url reply
  share_available || { echo "Upload needs curl." >&2; return 1; }
  setup_colors

  host="${UPLOAD_HOST:-0x0.st}"
  printf '\n%sUpload%s  %s  ->  https://%s\n' "$BOLD$CYAN" "$RESET" "$(basename -- "$out")" "$host"
  printf '%sThis makes the file publicly downloadable by anyone who has the link.%s\n' "$DIM" "$RESET"
  printf 'Proceed? [y/N]: '
  IFS= read -r reply
  case "$reply" in
    y|Y|yes|YES) ;;
    *) echo "Upload cancelled."; return 0;;
  esac

  printf 'Uploading...\n'
  if [[ -n "${REC_UPLOAD_CMD:-}" ]]; then
    url="$(REC_FILE="$out" bash -c "$REC_UPLOAD_CMD" 2>/dev/null)"
  else
    # -A: some hosts reject the default libcurl user agent.
    url="$(curl -fsS -A "rec/1.0" -F "file=@${out}" "https://${host}" 2>/dev/null)"
  fi
  url="$(printf '%s' "$url" | tr -d '\r\n')"

  [[ -n "$url" ]] || { echo "Upload failed (no URL returned)." >&2; return 1; }

  printf '\n%sUploaded:%s %s\n' "$BOLD$GREEN" "$RESET" "$url"
  if copy_to_clipboard "$url" 2>/dev/null; then
    printf '%sLink copied to clipboard.%s\n' "$DIM" "$RESET"
  fi
}
