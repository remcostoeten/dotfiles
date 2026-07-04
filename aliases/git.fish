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
# alias commit='git commit -m'

# DOCSTRING: Smart stage-and-commit helper from dotfiles/bin
function gc --description "Smart stage-and-commit helper"
    command ~/.config/dotfiles/bin/gc $argv
end

# DOCSTRING: Bitbucket PR helper — create/status/list/web for the current branch
function bpr --description "Bitbucket pull requests for the current branch"
    command ~/.config/dotfiles/bin/bpr $argv
end

# DOCSTRING: GitHub PR helper — TUI for pull requests and issues
function gpr --description "GitHub pull requests and issues helper"
    command ~/.config/dotfiles/bin/gpr $argv
end

# DOCSTRING: Open repository in browser
function repo --description "Open repository in browser (GitHub via gh, Bitbucket with sub-prompt)"
    set -l remote (git remote get-url origin 2>/dev/null)
    if test -z "$remote"
        echo "No 'origin' remote found" >&2
        return 1
    end

    switch "$remote"
        case '*github.com*'
            gh repo view -w
        case '*bitbucket.org*'
            set -l branch (git rev-parse --abbrev-ref HEAD 2>/dev/null)
            if test -z "$branch"
                echo "Could not detect current branch" >&2
                return 1
            end

            set -l repo_path (echo "$remote" | sed -E 's|^.*bitbucket\.org[/:]||; s/\.git$//')

            set -l ticket (string match -r '[A-Z]+-[0-9]+' "$branch" | head -1)
            set -l pr_id (curl -s -f "https://api.bitbucket.org/2.0/repositories/$repo_path/pullrequests?source.branch.name=$branch&state=OPEN&fields=values.id" 2>/dev/null | string match -r '"id":\s*(\d+)' | head -1 | string replace -r '.*"id":\s*(\d+).*' '$1')

            echo ""
            echo "─ Bitbucket repo detected ─"
            echo "  [R] Repo (default)"
            if test -n "$pr_id"
                echo "  [P] Pull request #$pr_id"
            end
            if test -n "$ticket"
                echo "  [J] Jira ticket ($ticket)"
            end
            read -l -p "echo 'Choice [R/p/j]: ' " choice

            switch "$choice"
                case '' R r
                    open "https://bitbucket.org/$repo_path"
                case P p
                    if test -n "$pr_id"
                        open "https://bitbucket.org/$repo_path/pull-requests/$pr_id"
                    else
                        echo "No open PR found for branch '$branch'" >&2
                        return 1
                    end
                case J j
                    if test -z "$ticket"
                        echo "No ticket ID found in branch name: $branch" >&2
                        return 1
                    end
                    open "https://concreetgeregeld.atlassian.net/browse/$ticket"
                case '*'
                    echo "Invalid choice" >&2
                    return 1
            end
        case '*'
            echo "Unsupported remote host: $remote" >&2
            return 1
    end
end

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

# DOCSTRING: Copy current branch name to clipboard
alias copybranche='copy branch'
