#!/usr/bin/env fish

# FZF aliases

# DOCSTRING: Interactive file finder with preview
alias ff='fzf --preview "bat --style=numbers --color=always --line-range :500 {}"'

# DOCSTRING: Find and edit file with default editor
alias fe='$EDITOR (fzf --preview "bat --style=numbers --color=always --line-range :500 {}")'

# DOCSTRING: Find and change to directory
alias fd='cd (find . -type d -not -path "*/.*" | fzf)'

# DOCSTRING: Interactive process killer
alias fkill='ps aux | fzf | awk "{print \$2}" | xargs kill'

# DOCSTRING: Search command history interactively
alias fh='eval (history | fzf --tac --no-sort | sed "s/^[[:space:]]*[0-9]*[[:space:]]*//")'

# DOCSTRING: Interactive git branch switcher
alias fb='git checkout (git branch | fzf | sed "s/^[[:space:]]*//" | sed "s/^\\*//")'

# DOCSTRING: Interactive git log viewer
alias flog='git log --oneline --color=always | fzf --ansi --preview "git show --color=always {1}"'

# DOCSTRING: Find and open file with bat
alias fcat='fzf --preview "bat --style=numbers --color=always {}" --bind "enter:execute(bat {})"'

# DOCSTRING: Interactive directory navigation with tree preview
alias ftree='cd (find . -type d | fzf --preview "tree -C {} | head -200")'

# DOCSTRING: Search and open recent files
alias frecent='find . -type f -printf "%T@ %p\\n" | sort -nr | cut -d" " -f2- | head -50 | fzf --preview "bat --style=numbers --color=always --line-range :500 {}"'

# DOCSTRING: Interactive npm script runner
alias fnpm='npm run (cat package.json | jq -r ".scripts | keys[]" | fzf --preview "cat package.json | jq -r \".scripts.{}\"")'

# DOCSTRING: Interactive environment variable viewer
alias fenv='env | fzf'

# DOCSTRING: Find and tail log files
alias flog-tail='tail -f (find . -name "*.log" -type f | fzf --preview "tail -50 {}")'

# DOCSTRING: Interactive alias searcher
alias falias='alias | fzf'

# DOCSTRING: Find and remove files/directories
alias frm='rm -rf (find . -type f | fzf -m --preview "bat --style=numbers --color=always --line-range :500 {}")'