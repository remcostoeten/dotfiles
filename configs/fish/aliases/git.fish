#!/usr/bin/env fish

# Git aliases

# DOCSTRING: Checkout git branch
alias checkout='git checkout'

# DOCSTRING: Create and checkout new branch
alias newbranch='git checkout -b'

# DOCSTRING: Push changes to remote
alias push='git push'

# DOCSTRING: Pull changes from remote
alias pull='git pull'

# DOCSTRING: Stage all changes
alias add=' git add .'

# DOCSTRING: Commit with message
alias commit='git commit -m'

# DOCSTRING: Stage and commit in one command
alias gc='git add . ; git commit -m'

# DOCSTRING: Open repository in browser
alias repo='gh repo view -w'

# DOCSTRING: Show remote repositories
alias remote='git remote -v'

# DOCSTRING: Stage and stash changes
alias stash='git add . ; git stash'

# DOCSTRING: Apply most recent stash
alias pop='git stash pop'

# DOCSTRING: Reset to last commit (hard)
alias reset='git reset --hard'

# DOCSTRING: Short git command
alias g='git'

