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

echo "ALL TESTS PASSED"
