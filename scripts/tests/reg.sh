#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
reg="$repo_root/bin/reg"

tmp_dir="$(mktemp -d "$repo_root/.reg-test.XXXXXX")"
trap 'rm -rf "$tmp_dir"' EXIT

mkdir -p "$tmp_dir/src" "$tmp_dir/node_modules" "$tmp_dir/dist" "$tmp_dir/json_stuff"

cat >"$tmp_dir/src/keep.ts" <<'EOF'
needle outside svg
<svg>
needle inside svg
</svg>
EOF

cat >"$tmp_dir/node_modules/ignored.ts" <<'EOF'
needle in node_modules
EOF

cat >"$tmp_dir/dist/ignored.ts" <<'EOF'
needle in dist
EOF

cat >"$tmp_dir/json_stuff/data.json" <<'EOF'
needle in json
EOF

# 1. Basic SVG skip + default ignores
echo "=== test 1: svg skip + default ignores ==="
output="$("$reg" -n needle -- "$tmp_dir")"
grep -Fq "$tmp_dir/src/keep.ts:1:needle outside svg" <<<"$output"
! grep -Fq "$tmp_dir/src/keep.ts:3:needle inside svg" <<<"$output"
! grep -Fq "$tmp_dir/node_modules/ignored.ts" <<<"$output"
! grep -Fq "$tmp_dir/dist/ignored.ts" <<<"$output"

# 2. Multi-word sentence (no quotes)
echo "=== test 2: multi-word sentence ==="
echo "hello world test" > "$tmp_dir/src/hello.txt"
output="$("$reg" hello world test -- "$tmp_dir")"
grep -Fq "hello world test" <<<"$output"

# 3. Inline directive: x:json excludes .json files
echo "=== test 3: x:json directive ==="
output="$("$reg" -n needle x:json -- "$tmp_dir")"
grep -Fq "$tmp_dir/src/keep.ts:1:needle outside svg" <<<"$output"
! grep -Fq "needle in json" <<<"$output"

# 4. Inline directive: in:src scopes to src/
echo "=== test 4: in:src directive ==="
output="$("$reg" -n needle in:src -- "$tmp_dir")"
grep -Fq "$tmp_dir/src/keep.ts:1:needle outside svg" <<<"$output"
! grep -Fq "needle in json" <<<"$output"

# 5. Inline directive: o:ts limits to .ts files
echo "=== test 5: o:ts directive ==="
output="$("$reg" -n needle o:ts -- "$tmp_dir")"
grep -Fq "$tmp_dir/src/keep.ts:1:needle outside svg" <<<"$output"
! grep -Fq "needle in json" <<<"$output"

# 6. No pattern + no flags shows help
echo "=== test 6: no pattern shows help ==="
output="$("$reg" 2>&1 || true)"
grep -Fq "Usage:" <<<"$output"

# 7. Directive anywhere in sentence
echo "=== test 7: directive mid-sentence ==="
output="$("$reg" -n x:json needle -- "$tmp_dir")"
grep -Fq "$tmp_dir/src/keep.ts:1:needle outside svg" <<<"$output"
! grep -Fq "needle in json" <<<"$output"

# 8. except: alias works like x:
echo "=== test 8: except: directive ==="
output="$("$reg" -n needle except:json -- "$tmp_dir")"
grep -Fq "$tmp_dir/src/keep.ts:1:needle outside svg" <<<"$output"
! grep -Fq "needle in json" <<<"$output"

# 9. Smart-case survives the svg-skip prefix
echo "=== test 9: smart-case despite svg skip ==="
echo "Needle Mixed" > "$tmp_dir/src/case.txt"
output="$("$reg" needle mixed -- "$tmp_dir/src/case.txt")"
grep -Fq "Needle Mixed" <<<"$output"
! "$reg" NEEDLE MIXED -- "$tmp_dir/src/case.txt" >/dev/null 2>&1
! "$reg" -s needle mixed -- "$tmp_dir/src/case.txt" >/dev/null 2>&1

# 10. Pretty output: header, footer counts, no-match footer, exit codes
echo "=== test 10: pretty output ==="
output="$(REG_PRETTY=1 "$reg" needle -- "$tmp_dir/src/keep.ts")"
grep -q "╭─" <<<"$output"
grep -q "▍" <<<"$output"
grep -q "╰─ 1 match in 1 file" <<<"$output"
output="$(REG_PRETTY=1 "$reg" zzz_nomatch -- "$tmp_dir" || true)"
grep -q "╰─ no matches" <<<"$output"
! REG_PRETTY=1 "$reg" zzz_nomatch -- "$tmp_dir" >/dev/null 2>&1

# 11. Pretty output stays off when piped (REG_PRETTY unset)
echo "=== test 11: plain output when piped ==="
output="$("$reg" needle -- "$tmp_dir/src/keep.ts")"
! grep -q "╭─" <<<"$output"

# 12. Hidden-results hint (capitalization) + reg -r rerun
echo "=== test 12: hidden hint + rerun ==="
state_a="$tmp_dir/state-a"
printf 'Foo bar\nfoo bar\n' > "$tmp_dir/src/case2.txt"
output="$(XDG_STATE_HOME="$state_a" REG_PRETTY=1 "$reg" Foo bar -- "$tmp_dir/src/case2.txt")"
grep -q "1 found · 1 hidden by capitalization" <<<"$output"
output="$(XDG_STATE_HOME="$state_a" REG_PRETTY=1 "$reg" -r)"
grep -Fq "Foo bar" <<<"$output"
grep -Fq "foo bar" <<<"$output"
grep -q "2 matches" <<<"$output"

# 13. Hidden-results hint for directives
echo "=== test 13: directive hint ==="
state_b="$tmp_dir/state-b"
output="$(XDG_STATE_HOME="$state_b" REG_PRETTY=1 "$reg" needle o:ts -- "$tmp_dir")"
grep -q "hidden by directives" <<<"$output"
output="$(XDG_STATE_HOME="$state_b" REG_PRETTY=1 "$reg" rerun | sed 's/\x1b\[[0-9;]*m//g')"
grep -Fq "needle in json" <<<"$output"
! grep -Fq "needle in node_modules" <<<"$output"
! grep -Fq "needle in dist" <<<"$output"

# 14. No hint when nothing is hidden; no state saved
echo "=== test 14: no hint when nothing hidden ==="
state_c="$tmp_dir/state-c"
output="$(XDG_STATE_HOME="$state_c" REG_PRETTY=1 "$reg" needle -- "$tmp_dir/src/keep.ts")"
! grep -q "hidden by" <<<"$output"
! XDG_STATE_HOME="$state_c" "$reg" -r >/dev/null 2>&1

# 15. Nothing to rerun in a fresh state
echo "=== test 15: nothing to rerun ==="
! XDG_STATE_HOME="$tmp_dir/state-fresh" "$reg" -r >/dev/null 2>&1

# 16. Close-match (typo) hint + rerun
echo "=== test 16: close-match hint + rerun ==="
state_d="$tmp_dir/state-d"
printf 'const n = parseFloat(input)\n' > "$tmp_dir/src/typo.ts"
output="$(XDG_STATE_HOME="$state_d" REG_PRETTY=1 "$reg" paresFloat -- "$tmp_dir/src/typo.ts" || true)"
grep -q "close match" <<<"$output"
output="$(XDG_STATE_HOME="$state_d" REG_PRETTY=1 "$reg" -r | sed 's/\x1b\[[0-9;]*m//g')"
grep -Fq "parseFloat" <<<"$output"

# 17. No close-match hint for gibberish with no near matches
echo "=== test 17: no hint for gibberish ==="
output="$(XDG_STATE_HOME="$tmp_dir/state-e" REG_PRETTY=1 "$reg" zzqqxxyy -- "$tmp_dir/src/typo.ts" || true)"
! grep -q "close match" <<<"$output"
! XDG_STATE_HOME="$tmp_dir/state-e" "$reg" -r >/dev/null 2>&1

echo "ALL TESTS PASSED"
