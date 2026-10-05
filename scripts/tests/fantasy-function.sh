#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
function_file="$repo_root/aliases/system.fish"

grep -Fq "function fantasy" "$function_file"
grep -Fq 'sudo "$HOME/Downloads/fantasy.earthbound.out" $argv' "$function_file"
if grep -Fq 'sudo -S' "$function_file"; then exit 1; fi
grep -Fq 'tee -a "$log_file"' "$function_file"
grep -Fq "return \$statuses[1]" "$function_file"
