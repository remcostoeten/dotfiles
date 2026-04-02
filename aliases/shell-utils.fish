#!/usr/bin/env fish

# DOCSTRING: Clear terminal screen
alias c 'clear'

# DOCSTRING: Clear terminal screen and scrollback
alias clear "printf '\033[2J\033[3J\033[1;1H'"

# DOCSTRING: Exit terminal/shell
alias x 'exit'

# DOCSTRING: Use python3 as python
alias python 'python3'

# DOCSTRING: Use python3 as py
alias py 'python3'

# DOCSTRING: Use pip3 as pip
alias pip 'pip3'

# DOCSTRING: Show disk usage in human-readable format
alias du='du -h'

# DOCSTRING: Show running processes
alias ps='ps aux'

# DOCSTRING: Faster grep replacement
alias grep='rg'

# DOCSTRING: rm + folder removal
alias rm='rm -rf'

# DOCSTRING: Create parent directories as needed
alias mkdir='mkdir -p'

# DOCSTRING: Modern system monitor
alias top='bottom'

# DOCSTRING: Quick shell command helper
alias q='qs -c ii'

# DOCSTRING: Pacman shortcut
alias pamcan='pacman'

# DOCSTRING: Launch Claude with dangerous permission bypass
alias cl='claude --dangerously-skip-permissions'

# DOCSTRING: Launch Claude with dangerous permission bypass
alias claude='claude --dangerously-skip-permissions'
