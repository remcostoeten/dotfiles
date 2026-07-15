# rec engine — help text.

usage() {
  setup_colors
  printf '%srec%s %s— Record any X11 window or selected region with high-quality NVENC%s\n\n' "$BOLD$CYAN" "$RESET" "$DIM" "$RESET"
  printf '%sUSAGE%s\n' "$BOLD$YELLOW" "$RESET"
  printf '  %srec%s [quality] [options]\n' "$GREEN" "$RESET"
  printf '  %srec region%s [options]\n' "$GREEN" "$RESET"
  printf '  %srec gif|clip|upload|edit%s [options]\n' "$GREEN" "$RESET"
  printf '  %srec ~|~1|...|~10%s       Re-run saved interactive configs\n' "$GREEN" "$RESET"
  printf '  %srec latest|list|open|play|config%s\n\n' "$GREEN" "$RESET"

  printf '%sQUALITY%s %s(positional, default: deliver)%s\n' "$BOLD$YELLOW" "$RESET" "$DIM" "$RESET"
  printf '  %sdeliver%s            High quality, smaller files, ready to upload (default)\n' "$MAGENTA" "$RESET"
  printf '  %smaster%s             Near-lossless capture — big files, best for editing\n\n' "$MAGENTA" "$RESET"

  printf '%sPRESETS%s\n' "$BOLD$YELLOW" "$RESET"
  printf '  %sgif%s                Animated GIF (15fps, palette-optimized, no audio)\n' "$MAGENTA" "$RESET"
  printf '  %sclip%s               General clip preset with a short countdown\n' "$MAGENTA" "$RESET"
  printf '  %supload%s             Upload-ready preset, copies the path afterward\n' "$MAGENTA" "$RESET"
  printf '  %sedit%s               Near-lossless editing preset\n\n' "$MAGENTA" "$RESET"

  printf '%sCOMMANDS%s\n' "$BOLD$YELLOW" "$RESET"
  printf '  %slatest%s             Print the newest recording path\n' "$MAGENTA" "$RESET"
  printf '  %slist%s               List recent recordings with date and size\n' "$MAGENTA" "$RESET"
  printf '  %sopen%s               Open the recordings folder\n' "$MAGENTA" "$RESET"
  printf '  %splay%s               Open the newest recording\n' "$MAGENTA" "$RESET"
  printf '  %sconfig%s             Create/open the config file (~/.config/rec/config)\n\n' "$MAGENTA" "$RESET"

  printf '%sOPTIONS%s\n' "$BOLD$YELLOW" "$RESET"
  printf '  %s--fps <n>%s          Capture frame rate (default: 60), e.g. --fps 120\n' "$GREEN" "$RESET"
  printf '  %s--audio%s            Also capture desktop audio (default output sink monitor)\n' "$GREEN" "$RESET"
  printf '  %s--name <title>%s     Record the largest window matching a title\n' "$GREEN" "$RESET"
  printf '  %s--class <class>%s    Record the largest window matching a WM_CLASS\n' "$GREEN" "$RESET"
  printf '  %s--active%s           Record the currently active window (default)\n' "$GREEN" "$RESET"
  printf '  %s--region%s           Pick a region with the mouse instead of a window\n' "$GREEN" "$RESET"
  printf '  %s--dora%s             Shortcut for --class dora --prefix dora\n' "$GREEN" "$RESET"
  printf '  %s--output-dir <dir>%s Write recordings to this directory\n' "$GREEN" "$RESET"
  printf '  %s--prefix <name>%s    Output filename prefix (default: recording)\n' "$GREEN" "$RESET"
  printf '  %s--countdown <n>%s    Wait n seconds before recording\n' "$GREEN" "$RESET"
  printf '  %s--copy-path%s        Copy output path after recording\n' "$GREEN" "$RESET"
  printf '  %s--play%s             Open the recording after it finishes\n' "$GREEN" "$RESET"
  printf '  %s--notify%s           Send desktop notifications on start/stop\n' "$GREEN" "$RESET"
  printf '  %s--no-notify%s        Disable desktop notifications\n' "$GREEN" "$RESET"
  printf '  %s--indicator%s        Show the on-screen recording indicator (default)\n' "$GREEN" "$RESET"
  printf '  %s--no-indicator%s     Hide the on-screen recording indicator\n' "$GREEN" "$RESET"
  printf '  %s-i, --interactive%s  Keyboard-first setup before recording\n' "$GREEN" "$RESET"
  printf '  %s-h, --help%s         Show this help and exit\n\n' "$GREEN" "$RESET"

  printf '%sCONFIGURATION%s %s(rec config — persistent defaults, no env vars needed)%s\n' "$BOLD$YELLOW" "$RESET" "$DIM" "$RESET"
  printf '  %s~/.config/rec/config%s holds "key = value" lines: quality, fps, audio,\n' "$CYAN" "$RESET"
  printf '  countdown, notify, indicator, copy_path, play, output_dir, prefix,\n'
  printf '  upload_host. Precedence: config file < REC_* env vars < CLI flags.\n\n'

  printf '%sENVIRONMENT%s\n' "$BOLD$YELLOW" "$RESET"
  printf '  %sREC_DIR%s            Output directory (default: $HOME/Videos/recordings)\n' "$CYAN" "$RESET"
  printf '  %sREC_PREFIX%s         Output filename prefix (default: recording)\n' "$CYAN" "$RESET"
  printf '  %sREC_INDICATOR%s      Set to 0 to hide the on-screen recording indicator\n' "$CYAN" "$RESET"
  printf '  %sREC_UPLOAD_HOST%s    Upload host for the share action (default: 0x0.st)\n' "$CYAN" "$RESET"
  printf '  %sREC_UPLOAD_CMD%s     Custom upload command; prints URL, reads $REC_FILE\n' "$CYAN" "$RESET"
  printf '  %sREC_CONFIG%s         Alternate config file location\n' "$CYAN" "$RESET"
  printf '  %sDORA_REC_DIR%s       Backward-compatible output directory override\n\n' "$CYAN" "$RESET"

  printf '%sCONTROLS%s\n' "$BOLD$YELLOW" "$RESET"
  printf '  While recording: %sspace%s pause/resume, %sq%s or %sEnter%s stop, %sCtrl-C%s stop\n' \
    "$MAGENTA" "$RESET" "$MAGENTA" "$RESET" "$MAGENTA" "$RESET" "$MAGENTA" "$RESET"
  printf '  A live status line shows elapsed time and file size.\n'
  printf '  Interactive mode: arrows/j/k move, Enter selects, %s←/h%s back, %sEsc/q%s cancel\n\n' \
    "$MAGENTA" "$RESET" "$MAGENTA" "$RESET"

  printf '%sAFTER CAPTURE%s %s(prompt shown once the recording finishes)%s\n' "$BOLD$YELLOW" "$RESET" "$DIM" "$RESET"
  printf '  %se%s open in file manager  %sv%s play in vlc  %sb%s open in browser\n' "$MAGENTA" "$RESET" "$MAGENTA" "$RESET" "$MAGENTA" "$RESET"
  printf '  %st%s trim in mpv  %sa%s strip audio  %sc%s compress  %su%s upload + copy link\n' "$MAGENTA" "$RESET" "$MAGENTA" "$RESET" "$MAGENTA" "$RESET" "$MAGENTA" "$RESET"
  printf '  Edit/upload actions return to this menu so they can be chained.\n'
  printf '  %sd%s delete (asks first)  %sq%s or %sEnter%s keep and exit\n\n' "$MAGENTA" "$RESET" "$MAGENTA" "$RESET" "$MAGENTA" "$RESET"

  printf '%sEXAMPLES%s\n' "$BOLD$YELLOW" "$RESET"
  printf '  %srec%s                          Record the active window, 60fps, deliver quality\n' "$GREEN" "$RESET"
  printf '  %srec region%s                   Select a screen region by mouse\n' "$GREEN" "$RESET"
  printf '  %srec --dora%s                   Auto-find Dora window\n' "$GREEN" "$RESET"
  printf '  %srec --class firefox%s          Record the largest Firefox window\n' "$GREEN" "$RESET"
  printf '  %srec --name "Terminal"%s        Record the largest terminal title match\n' "$GREEN" "$RESET"
  printf '  %srec master%s                   Near-lossless capture for editing\n' "$GREEN" "$RESET"
  printf '  %srec --fps 120 --audio%s        120fps with desktop audio\n' "$GREEN" "$RESET"
  printf '  %srec gif --countdown 3%s        GIF capture after a countdown\n' "$GREEN" "$RESET"
  printf '  %srec ~%s                        Re-run last completed interactive setup\n' "$GREEN" "$RESET"
  printf '  %srec ~1%s                       Re-run previous interactive setup\n' "$GREEN" "$RESET"
  printf '  %srec ~ --help%s                 Show saved interactive setup history\n' "$GREEN" "$RESET"
  printf '  %srec list%s                     List recent recordings\n' "$GREEN" "$RESET"
  printf '  %srec config%s                   Edit persistent defaults\n' "$GREEN" "$RESET"
}
