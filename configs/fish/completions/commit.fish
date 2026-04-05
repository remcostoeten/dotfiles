# Fish shell completions for commit
# Install: symlink or copy to ~/.config/fish/completions/commit.fish

# Disable default file completion (we handle it ourselves)
complete -c commit -f

# ── Flags ──────────────────────────────────────────────────────────────────────

complete -c commit -s h -l help -d "Show help"
complete -c commit -s n -l dry-run -d "Preview without executing"
complete -c commit -s v -l verbose -d "Show detailed output"
complete -c commit -s i -l interactive -d "Interactive file picker"
complete -c commit -l no-verify -d "Skip pre-commit hooks"
complete -c commit -l allow-empty -d "Allow empty commits"

# ── Post-commit actions ───────────────────────────────────────────────────────

complete -c commit -l push -d "Push to upstream after commit"
complete -c commit -l push-to -x -d "Push to specific branch" \
    -a "(git branch -r 2>/dev/null | string trim | string replace -r 'origin/' '')"
complete -c commit -l checkout -x -d "Checkout branch before commit" \
    -a "(git branch 2>/dev/null | string replace -r '^\*?\s*' '')"
complete -c commit -l create-branch -x -d "Create & switch to new branch"
complete -c commit -l set-upstream -d "Set upstream when pushing"

# ── Exclude flag ───────────────────────────────────────────────────────────────

complete -c commit -l exclude -d "Exclude files from commit" -r \
    -a "(git diff --name-only 2>/dev/null; git diff --cached --name-only 2>/dev/null; git ls-files --others --exclude-standard 2>/dev/null)"

# Short form -ex is non-standard but supported by the parser
# Fish can't easily add completions for multi-char short flags,
# so we rely on --exclude for completion support.

# ── File argument completion ───────────────────────────────────────────────────

# After typing the message, suggest changed files
complete -c commit -a "(git diff --name-only 2>/dev/null; git diff --cached --name-only 2>/dev/null; git ls-files --others --exclude-standard 2>/dev/null)" \
    -d "Changed file"
