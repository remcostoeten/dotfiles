#!/usr/bin/env bash
case "${1:-all}" in
  ram)
    awk '/MemTotal/{t=$2}/MemAvailable/{a=$2}END{printf "RAM %d%%", 100*(t-a)/t}' /proc/meminfo
    exit
    ;;
esac

read -r _ u1 n1 s1 i1 w1 x1 y1 _ < /proc/stat
sleep 1
read -r _ u2 n2 s2 i2 w2 x2 y2 _ < /proc/stat
busy=$(( (u2+n2+s2+x2+y2) - (u1+n1+s1+x1+y1) ))
total=$(( busy + (i2+w2) - (i1+w1) ))
printf 'CPU %s%%' "$(( total > 0 ? 100 * busy / total : 0 ))"
