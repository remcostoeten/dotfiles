#!/usr/bin/env bash
cache=${XDG_CACHE_HOME:-$HOME/.cache}/noir-weather
if [ ! -f "$cache" ] || [ -n "$(find "$cache" -mmin +15)" ]; then
  temp=$(curl -sf --max-time 4 'https://wttr.in/?format=%t' | tr -d '+')
  [ -n "$temp" ] && printf '%s' "$temp" > "$cache"
fi
weather=$(cat "$cache" 2>/dev/null)
printf '%s%s' "${weather:+ $weather   }" "$(date '+%b %d, %H:%M')"
