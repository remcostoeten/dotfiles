#!/usr/bin/env fish

# System aliases

# DOCSTRING: Clear terminal screen
alias c='clear'

# DOCSTRING: Show disk usage in human-readable format
alias du='du -h'

# DOCSTRING: Show disk free space
alias df='df -h'

# DOCSTRING: Show running processes
alias ps='ps aux'

# DOCSTRING: Grep with color
alias grep='grep --color=auto'

# DOCSTRING: rm + folder removal
alias rm='rm -rf'

# DOCSTRING: Create parent directories as needed
alias mkdir='mkdir -p'

# DOCSTRING: Go back one directory
alias ..='cd ..'

# DOCSTRING: Go back two directories
alias ...='cd ../..'

# DOCSTRING: Go back three directories
alias ....='cd ../../..'

# DOCSTRING: Replace ls with exa
alias ls='exa'

# DOCSTRING: Custom l alias with icons (backup - replaced by function)
alias l_orig='exa -l --no-permissions --no-user --no-time --group-directories-first --icons'
# alias l='exa -l --no-permissions --no-user --no-time --group-directories-first --icons'
