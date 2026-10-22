#!/usr/bin/env bash
temp=$(curl -sf --max-time 5 'https://wttr.in/?format=%t' | tr -d '+C')
[ -n "$temp" ] && printf ' %s' "$temp"
