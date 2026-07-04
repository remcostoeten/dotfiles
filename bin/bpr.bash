#!/usr/bin/env bash

set -euo pipefail

SCRIPT_NAME="${0##*/}"
SELF="$(cd "$(dirname "$0")" && pwd)/$(basename "$0")"

DATA_DIR="${DOTFILES_DATA_DIR:-$HOME/.dotfiles}"
AUTH_FILE="$DATA_DIR/bitbucket-auth"
API="https://api.bitbucket.org/2.0"

C_RED=$'\033[0;31m'
C_GREEN=$'\033[0;32m'
C_YELLOW=$'\033[1;33m'
C_BLUE=$'\033[0;34m'
C_CYAN=$'\033[0;36m'
C_GRAY=$'\033[0;90m'
C_BOLD=$'\033[1m'
C_NC=$'\033[0m'

die() {
  printf '%s%s%s\n' "$C_RED" "$*" "$C_NC" >&2
  exit 1
}

info() {
  printf '%s%s%s\n' "$C_GRAY" "$*" "$C_NC" >&2
}

require() {
  command -v "$1" >/dev/null 2>&1 || die "Missing required command: $1"
}

have() {
  command -v "$1" >/dev/null 2>&1
}

open_url() {
  local url="$1"
  if have xdg-open; then
    xdg-open "$url" >/dev/null 2>&1 &
  elif have open; then
    open "$url"
  else
    printf 'Open: %s\n' "$url"
  fi
}

load_auth() {
  BB_USER="${BITBUCKET_USERNAME:-${BITBUCKET_USER:-}}"
  BB_PASS="${BITBUCKET_APP_PASSWORD:-${BITBUCKET_TOKEN:-}}"

  if [[ -z "$BB_USER" || -z "$BB_PASS" ]] && [[ -f "$AUTH_FILE" ]]; then
    # shellcheck disable=SC1090
    source "$AUTH_FILE"
    BB_USER="${BB_USER:-${BITBUCKET_USERNAME:-}}"
    BB_PASS="${BB_PASS:-${BITBUCKET_APP_PASSWORD:-}}"
  fi

  if [[ -z "${BB_USER:-}" || -z "${BB_PASS:-}" ]]; then
    die "No Bitbucket credentials. Run '$SCRIPT_NAME auth' to set them up."
  fi
}

api() {
  # api METHOD PATH [json-body]
  local method="$1" path="$2" body="${3:-}"
  local args=(-sS -u "$BB_USER:$BB_PASS" -X "$method" -H "Accept: application/json")
  if [[ -n "$body" ]]; then
    args+=(-H "Content-Type: application/json" -d "$body")
  fi
  curl "${args[@]}" "$API$path"
}

repo_slug() {
  local remote
  remote="$(git remote get-url origin 2>/dev/null)" || die "No 'origin' remote found"
  case "$remote" in
    *bitbucket.org*) : ;;
    *) die "origin is not a Bitbucket remote: $remote" ;;
  esac
  sed -E 's|^.*bitbucket\.org[/:]||; s/\.git$//' <<<"$remote"
}

workspace_of() {
  printf '%s\n' "${1%%/*}"
}

current_branch() {
  git rev-parse --abbrev-ref HEAD 2>/dev/null || die "Not on a branch"
}

main_branch() {
  local slug="$1" name
  name="$(api GET "/repositories/$slug" | jq -r '.mainbranch.name // empty')" || true
  if [[ -n "$name" ]]; then
    printf '%s\n' "$name"
    return
  fi
  name="$(git symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>/dev/null | sed 's|^origin/||')" || true
  printf '%s\n' "${name:-main}"
}

self_uuid() {
  api GET "/user?fields=uuid" | jq -r '.uuid // empty'
}

# Extract a JIRA-style ticket (e.g. DCR-3309) from a branch name.
branch_ticket() {
  grep -oiE '[A-Z]+-[0-9]{4}' <<<"$1" | head -1 | tr '[:lower:]' '[:upper:]'
}

# Default PR title: "<TICKET>: <last commit subject>", de-duplicating the prefix.
default_title_for() {
  local branch="$1" ticket subject
  ticket="$(branch_ticket "$branch")"
  subject="$(git log -1 --pretty=%s 2>/dev/null || printf '%s' "$branch")"
  if [[ -n "$ticket" ]] && ! grep -qiE "^${ticket}\b" <<<"$subject"; then
    printf '%s: %s' "$ticket" "$subject"
  else
    printf '%s' "$subject"
  fi
}

# All open PRs for a repo as a JSON array on stdout.
all_open_prs() {
  local slug="$1"
  api GET "/repositories/$slug/pullrequests?state=OPEN&pagelen=50&fields=values.id,values.title,values.description,values.author.display_name,values.author.uuid,values.source.branch.name,values.destination.branch.name,values.source.commit.hash,values.links.html.href,values.participants.approved,values.participants.user.display_name,values.participants.role,values.created_on,values.updated_on" \
    | jq -c '.values // []'
}

pr_for_branch() {
  local slug="$1" branch="$2"
  api GET "/repositories/$slug/pullrequests?q=source.branch.name=%22$branch%22&state=OPEN&fields=values.id,values.title,values.state,values.links.html.href,values.source.commit.hash,values.participants.approved,values.participants.role" \
    | jq -c '.values[0] // empty'
}

ci_summary() {
  local slug="$1" sha="$2"
  [[ -z "$sha" ]] && { printf 'n/a'; return; }
  local counts
  counts="$(api GET "/repositories/$slug/commit/$sha/statuses?fields=values.state" \
    | jq -r '[.values[].state] | "\(map(select(.=="SUCCESSFUL"))|length) \(map(select(.=="FAILED"))|length) \(map(select(.=="INPROGRESS"))|length) \(length)"' 2>/dev/null)" || counts="0 0 0 0"
  read -r ok fail prog total <<<"$counts"
  if [[ "${total:-0}" -eq 0 ]]; then
    printf 'no checks'
  elif [[ "$fail" -gt 0 ]]; then
    printf '%s%d failing%s' "$C_RED" "$fail" "$C_NC"
  elif [[ "$prog" -gt 0 ]]; then
    printf '%s%d running%s' "$C_YELLOW" "$prog" "$C_NC"
  else
    printf '%s%d passing%s' "$C_GREEN" "$ok" "$C_NC"
  fi
}

# ─────────────────────────────── direct commands ───────────────────────────────

cmd_status() {
  load_auth; require jq
  local slug branch pr
  slug="$(repo_slug)"; branch="$(current_branch)"
  info "Checking PR for '$branch' on $slug ..."
  pr="$(pr_for_branch "$slug" "$branch")"
  if [[ -z "$pr" ]]; then
    printf '%sNo open PR for branch %s%s%s\n' "$C_YELLOW" "$C_BOLD" "$branch" "$C_NC"
    printf "Create one with: %s%s create%s\n" "$C_CYAN" "$SCRIPT_NAME" "$C_NC"
    return
  fi
  local id title url sha approvals ci
  id="$(jq -r '.id' <<<"$pr")"
  title="$(jq -r '.title' <<<"$pr")"
  url="$(jq -r '.links.html.href' <<<"$pr")"
  sha="$(jq -r '.source.commit.hash // empty' <<<"$pr")"
  approvals="$(jq -r '[.participants[]? | select(.approved==true)] | length' <<<"$pr")"
  ci="$(ci_summary "$slug" "$sha")"
  printf '\n%s%sPR #%s%s  %s\n' "$C_BOLD" "$C_BLUE" "$id" "$C_NC" "$title"
  printf '  state     %sOPEN%s\n' "$C_GREEN" "$C_NC"
  printf '  approvals %s\n' "$approvals"
  printf '  ci        %s\n' "$ci"
  printf '  %s%s%s\n\n' "$C_GRAY" "$url" "$C_NC"
}

cmd_list() {
  load_auth; require jq
  local slug
  slug="$(repo_slug)"
  info "Open pull requests on $slug ..."
  all_open_prs "$slug" \
    | jq -r '.[] | "  #\(.id)  \(.title)  [90m[\(.source.branch.name) → \(.destination.branch.name) · \(.author.display_name)][0m"'
}

cmd_create() {
  load_auth; require jq
  local slug branch dest title body open_after=1 reviewers_json='[]'
  slug="$(repo_slug)"; branch="$(current_branch)"
  dest=""; title=""; body=""

  while [[ $# -gt 0 ]]; do
    case "$1" in
      -t|--title) title="$2"; shift 2 ;;
      -d|--dest) dest="$2"; shift 2 ;;
      -m|--message|--body) body="$2"; shift 2 ;;
      --no-open) open_after=0; shift ;;
      *) die "Unknown flag for create: $1" ;;
    esac
  done

  [[ "$branch" == "$dest" ]] && die "Source and destination branch are the same: $branch"

  if ! git ls-remote --exit-code --heads origin "$branch" >/dev/null 2>&1; then
    info "Branch '$branch' not on origin yet — pushing ..."
    git push -u origin "$branch"
  fi

  [[ -z "$dest" ]] && dest="$(main_branch "$slug")"
  [[ -z "$title" ]] && title="$(default_title_for "$branch")"

  local existing
  existing="$(pr_for_branch "$slug" "$branch")"
  if [[ -n "$existing" ]]; then
    local eid eurl
    eid="$(jq -r '.id' <<<"$existing")"; eurl="$(jq -r '.links.html.href' <<<"$existing")"
    printf '%sPR #%s already open for %s%s → %s\n' "$C_YELLOW" "$eid" "$branch" "$C_NC" "$eurl"
    [[ "$open_after" -eq 1 ]] && open_url "$eurl"
    return
  fi

  create_pr "$slug" "$branch" "$dest" "$title" "$body" "$reviewers_json" "$open_after"
}

# create_pr SLUG SRC DEST TITLE BODY REVIEWERS_JSON OPEN_AFTER
create_pr() {
  local slug="$1" branch="$2" dest="$3" title="$4" body="$5" reviewers="${6:-[]}" open_after="${7:-1}"
  info "Creating PR: $branch → $dest"
  local payload resp url err
  payload="$(jq -n --arg t "$title" --arg s "$branch" --arg d "$dest" --arg b "$body" --argjson r "$reviewers" \
    '{title:$t, source:{branch:{name:$s}}, destination:{branch:{name:$d}}, description:$b, reviewers:$r, close_source_branch:true}')"
  resp="$(api POST "/repositories/$slug/pullrequests" "$payload")"
  url="$(jq -r '.links.html.href // empty' <<<"$resp")"
  if [[ -z "$url" ]]; then
    err="$(jq -r '.error.message // "Unknown error"' <<<"$resp" 2>/dev/null || printf 'Unknown error')"
    die "Failed to create PR: $err"
  fi
  printf '%s✓ Created PR%s  %s\n' "$C_GREEN" "$C_NC" "$url"
  [[ "$open_after" -eq 1 ]] && open_url "$url"
}

cmd_web() {
  load_auth; require jq
  local slug branch pr url
  slug="$(repo_slug)"; branch="$(current_branch)"
  pr="$(pr_for_branch "$slug" "$branch")"
  if [[ -n "$pr" ]]; then
    url="$(jq -r '.links.html.href' <<<"$pr")"
  else
    info "No open PR — opening the new-PR page for '$branch'."
    url="https://bitbucket.org/$slug/pull-requests/new?source=$branch"
  fi
  printf 'Opening %s\n' "$url"
  open_url "$url"
}

# ─────────────────────────────── interactive mode ───────────────────────────────

need_fzf() {
  have fzf || die "Interactive mode needs 'fzf' (not found on PATH)."
  [[ -t 0 && -t 1 ]] || die "Interactive mode needs an interactive terminal."
}

# Hidden: render a PR detail block for the fzf preview pane.
# __preview <id> <jsonfile>
cmd_preview() {
  local id="$1" file="$2"
  [[ -f "$file" ]] || return 0
  jq -r --argjson id "$id" '
    .[] | select(.id==$id) |
    "[1m#\(.id)  \(.title)[0m\n" +
    "[90mauthor[0m   \(.author.display_name)\n" +
    "[90mbranch[0m   \(.source.branch.name) → \(.destination.branch.name)\n" +
    "[90mapproved[0m \([.participants[]? | select(.approved==true) | .user.display_name] | join(", ") // "none")\n" +
    "[90mupdated[0m  \(.updated_on // "?" | .[0:16])\n" +
    "\n\(.description // "" | if .=="" then "(no description)" else . end)"
  ' "$file" 2>/dev/null || true
}

# Pick a PR from the given json file; echoes selected id (empty on cancel).
pick_pr() {
  local file="$1" header="${2:-Enter=open in browser · Esc=back}"
  local line
  line="$(jq -r '.[] | "\(.id)\t#\(.id)  \(.title)  [90m[\(.source.branch.name) · \(.author.display_name)][0m"' "$file" \
    | fzf --ansi --delimiter='\t' --with-nth=2.. \
        --prompt='PR ❯ ' --header="$header" \
        --preview="$SELF __preview {1} $file" \
        --preview-window='right,55%,wrap' || true)"
  [[ -n "$line" ]] && printf '%s\n' "${line%%$'\t'*}"
}

# Choose an author to filter by; echoes display_name ("" = all, cancel = __cancel__).
pick_author() {
  local file="$1" sel
  sel="$( { printf 'All PRs\n'; jq -r '.[].author.display_name' "$file" | sort | uniq -c \
             | sed -E 's/^ *([0-9]+) (.*)$/\2 (\1)/'; } \
        | fzf --prompt='Author ❯ ' --header='Filter PRs by author · Esc=back' || printf '__cancel__')"
  case "$sel" in
    __cancel__) printf '__cancel__\n' ;;
    'All PRs'|'') printf '\n' ;;
    *) printf '%s\n' "$(sed -E 's/ \([0-9]+\)$//' <<<"$sel")" ;;
  esac
}

browse_prs() {
  local slug="$1" tmp
  tmp="$(mktemp "${TMPDIR:-/tmp}/gpr.XXXXXX.json")"
  trap 'rm -f "$tmp"' RETURN
  info "Loading open PRs for $slug ..."
  all_open_prs "$slug" >"$tmp"
  local count
  count="$(jq 'length' "$tmp")"
  if [[ "$count" -eq 0 ]]; then
    printf '%sNo open pull requests on %s%s\n' "$C_YELLOW" "$slug" "$C_NC"
    return
  fi

  while true; do
    local author fview="$tmp"
    author="$(pick_author "$tmp")"
    [[ "$author" == "__cancel__" ]] && return
    if [[ -n "$author" ]]; then
      fview="$(mktemp "${TMPDIR:-/tmp}/gpr.XXXXXX.json")"
      jq --arg a "$author" '[.[] | select(.author.display_name==$a)]' "$tmp" >"$fview"
    fi

    local id url
    id="$(pick_pr "$fview" "$count PRs · type to filter · Enter=open · Esc=back")"
    [[ "$fview" != "$tmp" ]] && rm -f "$fview"
    [[ -z "$id" ]] && continue
    url="$(jq -r --argjson id "$id" '.[] | select(.id==$id) | .links.html.href' "$tmp")"
    printf 'Opening PR #%s → %s\n' "$id" "$url"
    open_url "$url"
    return
  done
}

# Multi-select reviewers from workspace members; echoes a JSON array of {uuid}.
pick_reviewers() {
  local slug="$1" ws me tmp members
  ws="$(workspace_of "$slug")"
  me="$(self_uuid 2>/dev/null || true)"
  members="$(api GET "/workspaces/$ws/members?pagelen=100&fields=values.user.uuid,values.user.display_name,values.user.nickname" \
    | jq -r --arg me "$me" '.values[]?.user | select(.uuid != $me) | "\(.uuid)\t\(.display_name // .nickname)"' 2>/dev/null || true)"
  if [[ -z "$members" ]]; then
    printf '[]\n'
    info "Could not list workspace members (token may lack workspace scope) — skipping reviewers."
    return
  fi
  local picked
  picked="$(fzf --multi --ansi --delimiter='\t' --with-nth=2.. \
      --prompt='Reviewers ❯ ' \
      --header='Tab=select multiple · Enter=confirm · Esc=none' <<<"$members" || true)"
  if [[ -z "$picked" ]]; then
    printf '[]\n'
    return
  fi
  cut -f1 <<<"$picked" | jq -R '{uuid:.}' | jq -s '.'
}

interactive_create() {
  local slug="$1" branch dest title body reviewers
  branch="$(current_branch)"

  if ! git ls-remote --exit-code --heads origin "$branch" >/dev/null 2>&1; then
    printf "%sBranch '%s' isn't on origin yet.%s\n" "$C_YELLOW" "$branch" "$C_NC"
    read -rp "Push it now? [Y/n] " ans
    case "$ans" in n|N) die "Aborted — nothing to open a PR from." ;; *) git push -u origin "$branch" ;; esac
  fi

  local default_dest
  default_dest="$(main_branch "$slug")"
  printf '\n%sNew pull request%s  %s%s → ?%s\n' "$C_BOLD" "$C_NC" "$C_CYAN" "$branch" "$C_NC"
  dest="$(git branch -r --format='%(refname:short)' 2>/dev/null | sed 's|^origin/||' \
        | grep -vx 'HEAD' | sort -u \
        | fzf --prompt='Destination ❯ ' --header="Enter=pick · Esc=use default ($default_dest)" \
              --query="$default_dest" || true)"
  [[ -z "$dest" ]] && dest="$default_dest"

  local default_title
  default_title="$(default_title_for "$branch")"
  read -rep "Title: " -i "$default_title" title
  [[ -z "$title" ]] && title="$default_title"

  printf '%sDescription%s — leave empty to open $EDITOR (%s), or type one line:\n' "$C_GRAY" "$C_NC" "${EDITOR:-none}"
  read -rp "> " body
  if [[ -z "$body" && -n "${EDITOR:-}" ]]; then
    local ef
    ef="$(mktemp "${TMPDIR:-/tmp}/gpr-desc.XXXXXX.md")"
    "$EDITOR" "$ef" </dev/tty >/dev/tty || true
    body="$(cat "$ef")"; rm -f "$ef"
  fi

  reviewers="$(pick_reviewers "$slug")"
  local rcount
  rcount="$(jq 'length' <<<"$reviewers")"

  printf '\n%sReview%s  %s → %s\n  title:     %s\n  reviewers: %s\n' \
    "$C_BOLD" "$C_NC" "$branch" "$dest" "$title" "$rcount selected"
  read -rp "Create this PR? [Y/n] " ok
  case "$ok" in n|N) die "Aborted." ;; esac

  create_pr "$slug" "$branch" "$dest" "$title" "$body" "$reviewers" 1
}

menu() {
  load_auth; require jq; need_fzf
  local slug
  slug="$(repo_slug)"
  while true; do
    local choice
    choice="$(printf '%s\n' \
        'Browse / filter PRs' \
        'Create a PR from this branch' \
        'Status of current branch' \
        'Open current-branch PR in browser' \
        'Quit' \
      | fzf --prompt='gpr ❯ ' --header="Bitbucket · $slug" --height=~60% || printf 'Quit')"
    case "$choice" in
      'Browse'*) browse_prs "$slug" ;;
      'Create'*) interactive_create "$slug" ;;
      'Status'*) cmd_status ;;
      'Open'*)   cmd_web ;;
      'Quit'|'') return ;;
    esac
    printf '\n'
  done
}

# ─────────────────────────────── auth + help ───────────────────────────────

cmd_auth() {
  mkdir -p "$DATA_DIR"
  printf '%sBitbucket credentials%s\n' "$C_BOLD" "$C_NC"
  printf 'App password:  https://bitbucket.org/account/settings/app-passwords/  (username + password)\n'
  printf 'API token:     https://id.atlassian.com/manage-profile/security/api-tokens  (email + token, needs Bitbucket scopes)\n'
  printf 'Scopes needed: Pull requests read+write, Repositories read.\n\n'
  local user pass
  read -rp "Username or email: " user
  read -rsp "App password / API token: " pass
  printf '\n'
  [[ -z "$user" || -z "$pass" ]] && die "Both fields are required."
  umask 077
  cat >"$AUTH_FILE" <<EOF
BB_USER="$user"
BB_PASS="$pass"
EOF
  chmod 600 "$AUTH_FILE"
  printf '%s✓ Saved to %s%s (chmod 600)\n' "$C_GREEN" "$AUTH_FILE" "$C_NC"
  require jq
  if BB_USER="$user" BB_PASS="$pass" api GET "/user?fields=username,display_name" | jq -e '.username // .display_name' >/dev/null 2>&1; then
    local who
    who="$(BB_USER="$user" BB_PASS="$pass" api GET "/user?fields=username" | jq -r '.username')"
    printf '%s✓ Verified — authenticated as %s%s\n' "$C_GREEN" "$who" "$C_NC"
  else
    printf '%s! Saved, but could not verify. Check scopes/identity.%s\n' "$C_YELLOW" "$C_NC"
  fi
}

usage() {
  cat <<EOF
${C_BOLD}$SCRIPT_NAME${C_NC} — Bitbucket pull requests for the current branch

  ${C_CYAN}$SCRIPT_NAME${C_NC}                 interactive menu (browse/create/status/open)
  ${C_CYAN}$SCRIPT_NAME status${C_NC}          PR status for the current branch
  ${C_CYAN}$SCRIPT_NAME create${C_NC} [opts]   create a PR from the current branch
      -t, --title <s>    PR title (default: last commit subject)
      -d, --dest  <s>    destination branch (default: repo main branch)
      -m, --body  <s>    PR description
          --no-open      don't open the browser after creating
  ${C_CYAN}$SCRIPT_NAME list${C_NC}            list open PRs on this repo (plain)
  ${C_CYAN}$SCRIPT_NAME browse${C_NC}          interactive PR browser (filter by name/author)
  ${C_CYAN}$SCRIPT_NAME web${C_NC}             open the PR (or new-PR page) in the browser
  ${C_CYAN}$SCRIPT_NAME auth${C_NC}            store your username/email + app password/token
  ${C_CYAN}$SCRIPT_NAME help${C_NC}            this help

Credentials: \$BITBUCKET_USERNAME / \$BITBUCKET_APP_PASSWORD, or $AUTH_FILE.
EOF
}

require curl
cmd="${1:-menu}"
[[ $# -gt 0 ]] && shift || true
case "$cmd" in
  menu|ui|i|interactive) menu "$@" ;;
  status|st)             cmd_status "$@" ;;
  create|new|pr)         cmd_create "$@" ;;
  list|ls)               cmd_list "$@" ;;
  browse|b)              load_auth; require jq; need_fzf; browse_prs "$(repo_slug)" ;;
  web|open|o)            cmd_web "$@" ;;
  auth|login)            cmd_auth "$@" ;;
  __preview)             cmd_preview "$@" ;;
  help|-h|--help)        usage ;;
  *) die "Unknown command: $cmd (try '$SCRIPT_NAME help')" ;;
esac
