# Fish completions for reg — ripgrep with superpowers
# Install: symlink or copy to ~/.config/fish/completions/reg.fish

# ── Detect directive context from current token ─────────────────────────────

function __reg_has_prefix
    string match -qr '^(x|except|xd|o|only|in):' -- (commandline -ct)
end

function __reg_prefix_is
    string match -qr "^$argv[1]:" -- (commandline -ct)
end

# ── Text (pre-":" context) ──────────────────────────────────────────────────

complete -c reg -n 'not __reg_has_prefix' -a "x:\tExclude extension"
complete -c reg -n 'not __reg_has_prefix' -a "except:\tExclude extension"
complete -c reg -n 'not __reg_has_prefix' -a "xd:\tExclude directory"
complete -c reg -n 'not __reg_has_prefix' -a "o:\tOnly extension"
complete -c reg -n 'not __reg_has_prefix' -a "only:\tOnly extension"
complete -c reg -n 'not __reg_has_prefix' -a "in:\tScope to path"

# ── Value (post-":" context) ─────────────────────────────────────────────────

complete -c reg -n '__reg_prefix_is x or __reg_prefix_is except' \
    -a "json ts js jsx tsx css scss less html md yaml yml toml conf \
        log env py rs go rb java kt swift vue svelte graphql gql sql \
        sh bash zsh fish node_modules dist build out vendor tmp"

complete -c reg -n '__reg_prefix_is xd' \
    -a "node_modules dist build .git .next .nuxt .svelte-kit .turbo \
        .cache coverage out vendor tmp temp target"

complete -c reg -n '__reg_prefix_is o or __reg_prefix_is only' \
    -a "json ts js jsx tsx css scss less html md yaml yml toml conf \
        log env py rs go rb java kt swift vue svelte graphql gql sql sh"

complete -c reg -n '__reg_prefix_is in' \
    -a "(__fish_complete_directories)" -d "path"

# ── Standard rg flags ────────────────────────────────────────────────────────

complete -c reg -s i -l ignore-case -d "Case-insensitive search"
complete -c reg -s S -l smart-case -d "Case-insensitive if pattern is lowercase"
complete -c reg -s n -l line-number -d "Show line numbers"
complete -c reg -s N -l no-line-number -d "Suppress line numbers"
complete -c reg -s v -l invert-match -d "Invert match"
complete -c reg -s w -l word-regexp -d "Match whole words"
complete -c reg -s l -l files-with-matches -d "Show only filenames with matches"
complete -c reg -s L -l files-without-match -d "Show only filenames without matches"
complete -c reg -s c -l count -d "Show match count per file"
complete -c reg -l count-matches -d "Show total match count"
complete -c reg -s o -l only-matching -d "Show only the matching part"
complete -c reg -s F -l fixed-strings -d "Literal string matching"
complete -c reg -s P -l pcre2 -d "PCRE2 regex engine"
complete -c reg -s U -l multiline -d "Multiline mode"
complete -c reg -l multiline-dotall -d "Dot matches newlines"
complete -c reg -s C -l context -r -d "Show N lines of context"
complete -c reg -s B -l before-context -r -d "Show N lines before"
complete -c reg -s A -l after-context -r -d "Show N lines after"
complete -c reg -s g -l glob -r -d "Glob pattern (file filter)"
complete -c reg -s t -l type -r -d "File type filter" \
    -a "all js jsx ts tsx json css scss html md py rs go c cpp java rb sh bash fish"
complete -c reg -s T -l type-not -r -d "Exclude file type"
complete -c reg -s M -l max-filesize -r -d "Max file size (e.g. 10M)"
complete -c reg -s m -l max-count -r -d "Max matches per file"
complete -c reg -l sort -r -d "Sort results" -a "path modified accessed created none"
complete -c reg -s h -l help -d "Show help"
complete -c reg -s V -l version -d "Show version"
complete -c reg -l hidden -d "Search hidden files"
complete -c reg -l no-ignore -d "Don't respect .gitignore"
complete -c reg -l follow -d "Follow symlinks"
complete -c reg -l no-ignore-vcs -d "Respect .gitignore but not .ignore"
complete -c reg -l no-ignore-global -d "Respect .gitignore but not global"
complete -c reg -l no-ignore-parent -d "Don't respect parent .gitignore"
complete -c reg -s a -l text -d "Search binary files as text"
complete -c reg -l path-filter -r -d "Filter by path regex"
complete -c reg -s E -l encoding -r -d "File encoding"
complete -c reg -l trim -d "Trim whitespace around matches"
complete -c reg -l no-filename -d "Don't show filenames"
complete -c reg -l no-heading -d "Don't group matches by file"
complete -c reg -l no-messages -d "Suppress error messages"
complete -c reg -l pretty -d "Colorized, line-numbered output"
complete -c reg -s j -l threads -r -d "Number of threads"
