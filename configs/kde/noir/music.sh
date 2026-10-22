#!/usr/bin/env bash
player=spotify
pc() { playerctl -p "$player" "$@" 2>/dev/null; }

case "$1" in
  shuffle)
    [ "$2" = toggle ] && pc shuffle Toggle
    [ "$(pc shuffle)" = On ] && printf '󰒟' || printf '󰒞'
    ;;
  loop)
    if [ "$2" = toggle ]; then
      case "$(pc loop)" in
        None) pc loop Playlist ;;
        Playlist) pc loop Track ;;
        *) pc loop None ;;
      esac
    fi
    case "$(pc loop)" in
      Playlist) printf '󰑖' ;;
      Track) printf '󰑘' ;;
      *) printf '󰑗' ;;
    esac
    ;;
  volume)
    case "$2" in
      up) pc volume 0.05+ ;;
      down) pc volume 0.05- ;;
    esac
    vol=$(pc volume)
    [ -n "$vol" ] && awk -v v="$vol" 'BEGIN{printf "󰕾 %d%%", v*100}'
    ;;
esac
