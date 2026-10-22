#!/usr/bin/env bash
read -r _ u1 n1 s1 i1 w1 x1 y1 _ < /proc/stat
sleep 0.4
read -r _ u2 n2 s2 i2 w2 x2 y2 _ < /proc/stat
busy=$(( (u2+n2+s2+x2+y2) - (u1+n1+s1+x1+y1) ))
total=$(( busy + (i2+w2) - (i1+w1) ))
cpu=$(( total > 0 ? 100 * busy / total : 0 ))
mem=$(awk '/MemTotal/{t=$2}/MemAvailable/{a=$2}END{printf "%d", 100*(t-a)/t}' /proc/meminfo)
up=$(awk '{s=int($1); h=int(s/3600); m=int(s%3600/60); if (h>0) printf "%dh%02dm", h, m; else printf "%dm", m}' /proc/uptime)
printf ' %s%%   %s%%  \U000f0379 %s' "$cpu" "$mem" "$up"
