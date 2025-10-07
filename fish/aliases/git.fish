#!/usr/bin/env fish

# Git aliases

alias checkout='git checkout'
alias newbranch='git checkout -b'
alias push='git push'
alias pull='git pull'
alias add=' git add .'
alias commit='git commit -m'
alias gc='git add . ; git commit -m'
alias repo='gh repo view -w'
alias remote='git remote -v'
alias stash='git add . ; git stash'
alias pop='git stash pop'
alias reset='git reset --hard'
alias g='git' # Short git command

