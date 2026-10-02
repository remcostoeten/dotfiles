#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/../.." && pwd)"
cd "$root"

failed=0

mapfile -t tracked < <(git ls-files -- . ':!configs/agents' | while IFS= read -r f; do
    [[ -f "$f" && ! -L "$f" ]] && printf '%s\n' "$f"
done)

fish_files=()
sh_files=()
for f in "${tracked[@]}"; do
    case "$f" in
        *.fish) fish_files+=("$f"); continue ;;
    esac
    first="$(head -c 128 "$f" 2>/dev/null | tr -d '\0' | head -n1 || true)"
    case "$first" in
        '#!'*fish*) fish_files+=("$f") ;;
        '#!'*bash*|'#!'*/sh|'#!'*' sh') sh_files+=("$f") ;;
        *) [[ "$f" == *.sh ]] && sh_files+=("$f") ;;
    esac
done

echo "fish -n: ${#fish_files[@]} files"
for f in "${fish_files[@]}"; do
    fish -n "$f" || { echo "fish syntax error: $f"; failed=1; }
done

echo "shellcheck: ${#sh_files[@]} files"
shellcheck --severity=error --shell=bash --exclude=SC2148 "${sh_files[@]}" || failed=1

exit "$failed"
