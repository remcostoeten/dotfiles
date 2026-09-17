# Completions for the ai-history CLI (scripts/ai-history). Projects and branches
# are read live from the session index via `ai-history --complete`.

function __ai_history_values --argument-names what
    command -q ai-history; or return
    ai-history --complete $what 2>/dev/null
end

function __ai_history_when
    printf '%s\t%s\n' \
        1d "since yesterday" \
        3d "since three days ago" \
        1w "since last week" \
        2w "since two weeks ago" \
        30d "since thirty days ago" \
        1y "since last year" \
        (date +%Y-%m-%d) "today" \
        (date -d '1 month ago' +%Y-%m-01) "start of last month"
end

complete -c ai-history -f

complete -c ai-history -l project -x -d 'Match against the session cwd' \
    -a '(__ai_history_values projects)'
complete -c ai-history -l branch -x -d 'Exact git branch match' \
    -a '(__ai_history_values branches)'
complete -c ai-history -l tool -x -d 'Only one tool' \
    -a '(__ai_history_values tools)'
complete -c ai-history -l since -x -d 'Only sessions at or after this point' \
    -a '(__ai_history_when)'
complete -c ai-history -l until -x -d 'Only sessions at or before this point' \
    -a '(__ai_history_when)'
complete -c ai-history -l grep -x -d 'Search titles, cwd, prompts and transcript bodies'
complete -c ai-history -l limit -x -d 'Maximum rows (default 50 headless)'
complete -c ai-history -l complete -x -d 'List known values for shell completion' \
    -a 'projects\t"Project names" branches\t"Git branches" tools\t"claude or codex"'

complete -c ai-history -l shallow -d 'Restrict --grep to the index; skip transcript bodies'
complete -c ai-history -l include-subagents -d 'Include subagent and sidechain sessions'
complete -c ai-history -l json -d 'Machine-readable output, for jq'
complete -c ai-history -l stats -d 'Aggregate summary instead of a list'
complete -c ai-history -l no-color -d 'Plain text output'
complete -c ai-history -l reindex -d 'Force a full cache rebuild'
complete -c ai-history -l verbose -d 'Print index counts and timing to stderr'
complete -c ai-history -s h -l help -d 'Show usage'
