#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
rec="$repo_root/bin/rec"

tmp_home="$(mktemp -d "$repo_root/.rec-test-home.XXXXXX")"
trap 'rm -rf "$tmp_home"' EXIT

# Wizard input: Mode(deliver), Target(region), fps(30), audio(on), countdown(3),
# after(copy path), notify(on), indicator(on), Output(edit) -> dir + prefix.
output="$(
  HOME="$tmp_home" XDG_CONFIG_HOME="$tmp_home/.config" REC_DRY_RUN=1 "$rec" --interactive <<'EOF'

2
2
2
2
2
2
2
2
/tmp/rec-history-out
hist
EOF
)"

history_file="$tmp_home/.config/rec/history"
[[ -f "$history_file" ]]
grep -Fq "quality=deliver" "$history_file"
grep -Fq "region=1" "$history_file"
grep -Fq "fps=30" "$history_file"
grep -Fq "audio=1" "$history_file"
grep -Fq "countdown=3" "$history_file"
grep -Fq "copy_path=1" "$history_file"
grep -Fq "notify=1" "$history_file"
grep -Fq "outdir=/tmp/rec-history-out" "$history_file"
grep -Fq "prefix=hist" "$history_file"

replay="$(HOME="$tmp_home" XDG_CONFIG_HOME="$tmp_home/.config" REC_DRY_RUN=1 "$rec" '~')"
grep -Fq "quality=deliver" <<<"$replay"
grep -Fq "fps=30" <<<"$replay"
grep -Fq "audio=1" <<<"$replay"
grep -Fq "countdown=3" <<<"$replay"
grep -Fq "copy=1" <<<"$replay"
grep -Fq "notify=1" <<<"$replay"
grep -Fq "region=1" <<<"$replay"
grep -Fq "output='/tmp/rec-history-out/hist-" <<<"$replay"

help_output="$(HOME="$tmp_home" XDG_CONFIG_HOME="$tmp_home/.config" "$rec" '~' --help)"
grep -Fq "rec history" <<<"$help_output"
grep -Fq "~" <<<"$help_output"
grep -Fq "hist" <<<"$help_output"

# A second wizard run accepting every default (EOF selects the highlighted
# option) becomes ~, pushing the previous config to ~1.
output2="$(
  HOME="$tmp_home" XDG_CONFIG_HOME="$tmp_home/.config" REC_DRY_RUN=1 "$rec" --interactive <<'EOF'







EOF
)"

latest="$(HOME="$tmp_home" XDG_CONFIG_HOME="$tmp_home/.config" REC_DRY_RUN=1 "$rec" '~')"
previous="$(HOME="$tmp_home" XDG_CONFIG_HOME="$tmp_home/.config" REC_DRY_RUN=1 "$rec" '~1')"

grep -Fq "region=0" <<<"$latest"
grep -Fq "prefix=recording" <<<"$latest" || grep -Fq "recording-" <<<"$latest"
grep -Fq "region=1" <<<"$previous"
grep -Fq "output='/tmp/rec-history-out/hist-" <<<"$previous"

# Migration: a legacy history file at ~/.config/.dotfiles/rec moves to the
# new location on the next run.
migrate_home="$(mktemp -d "$repo_root/.rec-test-home.XXXXXX")"
trap 'rm -rf "$tmp_home" "$migrate_home"' EXIT
mkdir -p "$migrate_home/.config/.dotfiles"
cp "$history_file" "$migrate_home/.config/.dotfiles/rec"
migrated="$(HOME="$migrate_home" XDG_CONFIG_HOME="$migrate_home/.config" REC_DRY_RUN=1 "$rec" '~')"
grep -Fq "region=0" <<<"$migrated"
[[ -f "$migrate_home/.config/rec/history" ]]
[[ ! -e "$migrate_home/.config/.dotfiles/rec" ]]
