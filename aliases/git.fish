#!/usr/bin/env fish

# Git aliases

# Navigation
alias gs='git status'                     # Show git status
alias gl='git log --oneline --graph'      # Show compact git log
alias gb='git branch'                     # List branches
alias gbl='git branch -v'                 # List branches with last commit
alias gba='git branch -a'                 # List all branches (including remote)

# Branch operations
alias gco='git checkout'                  # Checkout branch/commit
alias gcb='git checkout -b'               # Create and checkout new branch
alias gbd='git branch -d'                 # Delete branch
alias gbD='git branch -D'                 # Force delete branch

# Changes and staging
alias ga='git add'                        # Add specific files
alias gaa='git add .'                     # Add all changes
alias gau='git add -u'                    # Add modified and deleted files
alias gap='git add -p'                    # Add changes interactively
alias grs='git restore'                   # Restore files from stage
alias grss='git restore --staged'         # Unstage files

# Commits
alias gc='git commit -m'                  # Commit with message
alias gca='git commit --amend'            # Amend last commit
alias gcam='git commit --amend --message'  # Amend last commit with new message
alias gcan='git commit --amend --no-edit' # Amend last commit without editing

# Remote operations
alias gf='git fetch'                      # Fetch from remote
alias gp='git push'                       # Push to remote
alias gpl='git pull'                      # Pull from remote
alias gpf='git push --force-with-lease'   # Force push safely

# Stash operations
alias gst='git stash'                     # Stash changes
alias gstp='git stash pop'                # Pop stashed changes
alias gstl='git stash list'               # List stashes
alias gsta='git stash apply'              # Apply stash without removing it

# Information
alias gd='git diff'                       # Show changes
alias gds='git diff --staged'             # Show staged changes
alias gwt='git worktree'                  # Manage worktrees
alias grs='git reset'                     # Reset changes

# Shortcuts
alias g='git'                             # Short git command